"use client"

import React, { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Shield, CheckCircle } from "lucide-react"
import { track } from '@vercel/analytics'

import { OTP_ENABLED } from "@/lib/feature-flags"
import { PhoneInput } from "@/components/phone-input"
import { isValidQuebecPhone } from "@/lib/phone"
import { getCurrentUTMParameters, type UTMParameters } from "@/lib/utm-utils"
import { buildV1AnswersFromV2, type V2Answers } from "@/lib/funnel-config"
import { calculateInsulationPricing } from "@/lib/insulation-calculator"
import { META_PIXEL_DEDIE } from "@/components/meta-pixel-router"

declare global {
  interface Window {
    fbq: (...args: any[]) => void
  }
}

export interface LeadData {
  firstName: string
  lastName: string
  email: string
  phone: string
  leadId?: string
}

interface LeadCaptureFormProps {
  roofData: any
  v2Answers: V2Answers
  onComplete: (pricingData: any, leadData: LeadData, leadId: string) => void
}

export function LeadCaptureForm({ roofData, v2Answers, onComplete }: LeadCaptureFormProps) {
  const router = useRouter()
  const firstNameRef = useRef<HTMLInputElement | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [utmParams, setUtmParams] = useState<UTMParameters>({})
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  })

  useEffect(() => {
    setUtmParams(getCurrentUTMParameters())
    // Focus first input on mount for a11y (P2-3).
    firstNameRef.current?.focus()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const isFormValid = Boolean(
    formData.firstName.trim() &&
    formData.lastName.trim() &&
    formData.email.trim() &&
    isValidQuebecPhone(formData.phone)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid || isSubmitting) return
    setErrorMessage(null)
    setIsSubmitting(true)

    track('Lead Form Submitted', { intent: v2Answers.intent })

    const v1ForPricing = buildV1AnswersFromV2(v2Answers)
    const clientLeadId = `LEAD${Date.now()}${Math.random().toString(36).substring(2, 10)}`
    const eventId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Pricing calc with V1 mapping — degraded but compatible (P0-3).
    let pricingData: any
    try {
      pricingData = calculateInsulationPricing({
        roofArea: roofData?.roofArea || 2000,
        roofPitch: roofData?.pitch,
        currentInsulation: v1ForPricing.currentInsulation,
        atticAccess: v1ForPricing.atticAccess,
        heatingSystem: v1ForPricing.heatingSystem,
        identifiedProblems: v1ForPricing.identifiedProblems,
      })
    } catch (pricingError) {
      console.error('💥 Pricing calculation error in LeadCaptureForm:', pricingError)
      setErrorMessage("Une erreur est survenue lors du calcul. Réessaie dans un instant.")
      setIsSubmitting(false)
      return
    }

    // Backward-compatible payload (P0-4): V1 defaults + V2 passthrough.
    const userAnswersPayload = {
      heatingSystem: v1ForPricing.heatingSystem,
      currentInsulation: v1ForPricing.currentInsulation,
      atticAccess: v1ForPricing.atticAccess,
      identifiedProblems: v1ForPricing.identifiedProblems,
      // V2 passthrough — Phase 2 wires these into GHL/Make.
      symptoms: v2Answers.symptoms,
      hydroBracket: v2Answers.hydroBracket,
      intent: v2Answers.intent,
    }

    // Estimated lead value (standard range midpoint) — carried in pending.meta
    // so /verifier-telephone can fire the post-OTP Lead pixel with the same value.
    const estimatedValue = pricingData?.ranges?.standard
      ? (pricingData.ranges.standard.totalCost.min + pricingData.ranges.standard.totalCost.max) / 2
      : 0

    const leadPayload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      leadId: clientLeadId,
      roofData,
      userAnswers: userAnswersPayload,
      pricingData,
      utmParams,
      // eventId stays top-level: /api/leads reads leadData.eventId for the CAPI
      // Lead, and /verifier-telephone reads pending.eventId for the browser
      // Lead → same id → Meta dedups browser↔CAPI (P0-3).
      eventId,
      // Phase 2: drives the post-OTP browser Lead gate + value on /verifier-telephone.
      meta: {
        intent: v2Answers.intent,
        estimatedValue,
      },
    }

    // NOTE (Phase 2): the Meta browser Lead pixel is NO LONGER fired here.
    // It moved past the OTP gate — qualified + form submitted + OTP confirmed —
    // so we never declare a Lead for an unverified phone. Fired from
    // /verifier-telephone (OTP path) or after /api/leads 200 (non-OTP path below).

    const leadDataForReturn: LeadData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      leadId: clientLeadId,
    }

    try {
      if (OTP_ENABLED) {
        // Defer /api/leads to /verifier-telephone (it'll POST after OTP success).
        // Override redirectTo to the existing /pricing URL pattern so we hit
        // InsulationResults with the same encoded data the current funnel uses.
        const urlData = btoa(JSON.stringify({
          roofArea: roofData?.roofArea,
          pitch: roofData?.pitch,
          heatingSystem: userAnswersPayload.heatingSystem,
          currentInsulation: userAnswersPayload.currentInsulation,
          atticAccess: userAnswersPayload.atticAccess,
          identifiedProblems: userAnswersPayload.identifiedProblems,
        }))
        const pricingUrl = `/pricing?leadId=${clientLeadId}&d=${urlData}`
        sessionStorage.setItem('pending-lead', JSON.stringify(leadPayload))
        // source:'analysis' lets MetaPixelRouter load the DEDICATED pixel on the
        // shared /verifier-telephone page for THIS funnel only. Thermopompes /
        // subventions leads also land on /verifier-telephone but never set this
        // flag → they stay on the shared pixel → zero cross-funnel contamination.
        sessionStorage.setItem('otp-verify', JSON.stringify({ phone: formData.phone, redirectTo: pricingUrl, source: 'analysis' }))
        router.push('/verifier-telephone')
        return
      }

      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadPayload),
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ /api/leads error', response.status, errorText)
        throw new Error(`API call failed: ${response.status}`)
      }

      // Non-OTP path (OTP_ENABLED=false): fire the browser Lead AFTER /api/leads
      // succeeds — qualified intent only, same eventId as the CAPI Lead, targeted
      // at the dedicated pixel (trackSingle). When OTP is on, this fires from
      // /verifier-telephone instead (we return before reaching here).
      if (
        v2Answers.intent === 'qualified' &&
        typeof window !== 'undefined' &&
        typeof window.fbq === 'function' &&
        META_PIXEL_DEDIE &&
        !/^X+$/i.test(META_PIXEL_DEDIE)
      ) {
        window.fbq('trackSingle', META_PIXEL_DEDIE, 'Lead', {
          value: estimatedValue.toFixed(2),
          currency: 'CAD',
          service_type: 'isolation',
        }, { eventID: eventId })
      }

      onComplete(pricingData, leadDataForReturn, clientLeadId)
    } catch (error) {
      console.error('❌ Lead submission error:', error)
      setErrorMessage("Une erreur est survenue. Vérifie ta connexion et réessaie.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const estimatedMaxSavings = roofData?.roofArea
    ? Math.round((roofData.roofArea / 2000) * 1200)
    : 1200

  return (
    <div className="max-w-2xl mx-auto px-4 pt-3 pb-8 sm:py-[40px]">
      <div className="bg-white rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] w-full flex flex-col gap-4 sm:gap-5 p-4 sm:p-6">

        {/* Title */}
        <h1 className="font-heading font-bold text-[#10002c] text-xl sm:text-2xl text-center leading-[1.2]">
          Plus qu'une étape avant d'obtenir votre estimation
        </h1>

        {/* Cyan savings highlight */}
        <div className="bg-[#aedee5]/30 border border-[#aedee5] rounded-xl p-3 text-center">
          <p className="font-serif-body text-[#002042] font-semibold text-sm">
            Selon notre analyse, vous pouvez économiser jusqu'à{' '}
            <span className="font-bold">{estimatedMaxSavings.toLocaleString()}$ par année</span>{' '}
            sur vos factures d'énergie.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md mx-auto w-full">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="block font-serif-body font-medium text-[#375371] text-sm mb-1">
                Prénom *
              </label>
              <input
                ref={firstNameRef}
                id="firstName"
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                required
                placeholder="Jean"
                className="w-full px-3 py-2 border-2 border-[#e8e8e0] rounded-lg font-serif-body text-[#002042] focus:outline-none focus:border-[#002042] transition-colors"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block font-serif-body font-medium text-[#375371] text-sm mb-1">
                Nom *
              </label>
              <input
                id="lastName"
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                required
                placeholder="Tremblay"
                className="w-full px-3 py-2 border-2 border-[#e8e8e0] rounded-lg font-serif-body text-[#002042] focus:outline-none focus:border-[#002042] transition-colors"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block font-serif-body font-medium text-[#375371] text-sm mb-1">
              Courriel *
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              placeholder="jean@exemple.com"
              className="w-full px-3 py-2 border-2 border-[#e8e8e0] rounded-lg font-serif-body text-[#002042] focus:outline-none focus:border-[#002042] transition-colors"
            />
          </div>

          <div>
            <label className="block font-serif-body font-medium text-[#375371] text-sm mb-1">
              Téléphone *
            </label>
            <PhoneInput
              value={formData.phone}
              onChange={(value) => setFormData((prev) => ({ ...prev, phone: value }))}
              inputClassName="w-full px-3 py-2 border-2 border-[#e8e8e0] rounded-lg font-serif-body text-[#002042] focus:outline-none focus:border-[#002042] transition-colors"
              placeholder="(514) 123-4567"
              required
            />
          </div>

          {errorMessage && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg px-4 py-3">
              <p className="font-serif-body text-sm text-red-700">{errorMessage}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="w-full bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-heading font-bold py-4 px-6 rounded-full transition-all duration-300 shadow-[-2px_4px_0_0_#002042] hover:shadow-[-1px_2px_0_0_#002042] hover:translate-y-0.5 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 mt-2"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Génération en cours...
              </span>
            ) : (
              "Découvrir mon estimation maintenant"
            )}
          </button>
        </form>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-3 border-t border-[#e8e8e0]">
          <div className="flex items-center gap-1.5 font-serif-body text-sm text-[#375371]">
            <Shield className="w-4 h-4 text-[#002042]" />
            <span>100% Sécurisé</span>
          </div>
          <div className="flex items-center gap-1.5 font-serif-body text-sm text-[#375371]">
            <CheckCircle className="w-4 h-4 text-[#002042]" />
            <span>Entrepreneurs certifiés RBQ</span>
          </div>
        </div>
      </div>
    </div>
  )
}
