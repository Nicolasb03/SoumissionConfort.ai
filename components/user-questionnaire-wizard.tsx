"use client"

import { useState, useEffect } from "react"
import { LeadCapturePopup, type LeadData } from "@/components/lead-capture-popup"
import { getCurrentUTMParameters, type UTMParameters } from "@/lib/utm-utils"
import { OTP_ENABLED } from "@/lib/feature-flags"
import { ArrowLeft, Check, CheckCircle, Smile } from "lucide-react"
import { track } from '@vercel/analytics'

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

interface UserQuestionnaireProps {
  roofData: any
  onComplete: (answers: any, leadData: LeadData, pricingData: any) => void
}

export function UserQuestionnaire({ roofData, onComplete }: UserQuestionnaireProps) {
  const [showLeadCapture, setShowLeadCapture] = useState(false)
  const [isSubmittingLead, setIsSubmittingLead] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [utmParams, setUtmParams] = useState<UTMParameters>({})
  const [answers, setAnswers] = useState({
    heatingSystem: "",
    currentInsulation: "",
    atticAccess: "",
    identifiedProblems: [] as string[],
  })

  // Extract UTM parameters on component mount
  useEffect(() => {
    const params = getCurrentUTMParameters()
    setUtmParams(params)
  }, [])

  const steps = [
    { 
      title: "Système de chauffage principal", 
      description: "Quel est votre système de chauffage principal?",
      key: "heatingSystem" 
    },
    { 
      title: "État de l'isolation", 
      description: "Quelle est la situation actuelle de votre isolation?",
      key: "currentInsulation" 
    },
    { 
      title: "Accès à l'entre-toit", 
      description: "Comment est l'accès à votre entre-toit?",
      key: "atticAccess" 
    },
    { 
      title: "Problèmes identifiés", 
      description: "Avez-vous identifié des problèmes? (optionnel)",
      key: "identifiedProblems" 
    },
  ]

  const getProgress = () => {
    return ((currentStep + 1) / steps.length) * 100
  }

  const canGoNext = () => {
    switch (currentStep) {
      case 0:
        return !!answers.heatingSystem
      case 1:
        return !!answers.currentInsulation
      case 2:
        return !!answers.atticAccess
      case 3:
        return true // Problems step is optional
      default:
        return false
    }
  }

  const handleNext = () => {
    // Track step completion
    track('Questionnaire Step Completed', {
      step: currentStep + 1,
      stepName: steps[currentStep].key
    })
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      track('Questionnaire Completed')
      handleGetPricing()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Auto-advance for radio steps (0-2)
  const selectAndAdvance = (field: 'heatingSystem' | 'currentInsulation' | 'atticAccess', value: string) => {
    setAnswers((prev) => ({ ...prev, [field]: value }))
    setTimeout(() => {
      track('Questionnaire Step Completed', { step: currentStep + 1, stepName: steps[currentStep].key })
      setCurrentStep((s) => s + 1)
    }, 250)
  }

  const isFormValid = () => {
    return (
      answers.heatingSystem &&
      answers.currentInsulation &&
      answers.atticAccess
    )
  }

  const handleGetPricing = () => {
    if (isFormValid()) {
      track('Lead Capture Popup Opened')
      setShowLeadCapture(true)
    }
  }

  const handleProblemToggle = (problemValue: string) => {
    const current = answers.identifiedProblems || []
    const newProblems = current.includes(problemValue)
      ? current.filter((p) => p !== problemValue)
      : [...current, problemValue]
    setAnswers((prev) => ({ ...prev, identifiedProblems: newProblems }))
  }

  const handleLeadSubmit = async (leadData: LeadData) => {
    setIsSubmittingLead(true)

    try {
      // First calculate pricing
      let pricingData = null
      
      try {
        // Utiliser le calculateur d'isolation côté client
        const { calculateInsulationPricing } = await import('@/lib/insulation-calculator')
        
        const calculationInputs = {
          roofArea: roofData.roofArea || 2000,
          roofPitch: roofData.pitch,
          currentInsulation: answers.currentInsulation || 'partielle',
          atticAccess: answers.atticAccess || 'facile',
          heatingSystem: answers.heatingSystem || 'electricite',
          identifiedProblems: answers.identifiedProblems || [],
        }
        
        pricingData = calculateInsulationPricing(calculationInputs)
        
      } catch (pricingError) {
        console.error('💥 Pricing calculation error, using fallback:', pricingError)
        const area = roofData?.roofArea || 1500
        pricingData = {
          adjustedArea: area,
          ranges: {
            economique: {
              name: 'Économique', type: 'Cellulose soufflée', rValue: 50,
              thickness: '14 pouces', durability: '20-30 ans', icon: '🥉',
              features: ['Valeur R: 3,6-3,8 par pouce', 'Matériau 100% recyclé', 'Installation rapide'],
              totalCost: { min: Math.max(1500, Math.round(area * 0.90)), max: Math.round(area * 1.50) },
              annualSavings: { min: 350, max: 600 },
              heatingReduction: { min: 15, max: 25 },
              paybackPeriod: { min: 3, max: 6 },
              savings25Years: { min: 8750, max: 15000 },
              netGain25Years: { min: 5000, max: 12000 },
            },
            standard: {
              name: 'Standard', type: 'Fibre de verre soufflée', rValue: 55,
              thickness: '18 pouces', durability: '20-25 ans', icon: '🥈',
              features: ['Valeur R: 2,6-2,9 par pouce', 'Non combustible', 'Installation certifiée RBQ'],
              totalCost: { min: Math.max(2000, Math.round(area * 1.40)), max: Math.round(area * 2.80) },
              annualSavings: { min: 450, max: 750 },
              heatingReduction: { min: 20, max: 35 },
              paybackPeriod: { min: 3, max: 6 },
              savings25Years: { min: 11250, max: 18750 },
              netGain25Years: { min: 6000, max: 15000 },
            },
            premium: {
              name: 'Premium', type: 'Hybride : mousse projetée + soufflé', rValue: 60,
              thickness: '12 pouces', durability: '30-50 ans', icon: '🥇',
              features: ['Valeur R: 6,0+ par pouce (mousse)', 'Barrière d\'air et d\'humidité', 'Performance maximale'],
              totalCost: { min: Math.max(3500, Math.round(area * 3.00)), max: Math.round(area * 5.00) },
              annualSavings: { min: 600, max: 1000 },
              heatingReduction: { min: 25, max: 45 },
              paybackPeriod: { min: 5, max: 10 },
              savings25Years: { min: 15000, max: 25000 },
              netGain25Years: { min: 8000, max: 20000 },
            },
          }
        }
      }

      // Generate shared eventId for client/server deduplication
      const eventId = crypto.randomUUID();

      // Fire Meta Pixel event (client-side)
      if (typeof window.fbq === 'function' && pricingData?.ranges?.standard) {
        const standardRange = pricingData.ranges.standard
        const estimatedValue = (standardRange.totalCost.min + standardRange.totalCost.max) / 2;
        window.fbq('track', 'Lead', {
            value: estimatedValue.toFixed(2),
            currency: 'CAD',
            service_type: 'isolation'
        }, { eventID: eventId });
      }

      // Pre-generate a client lead ID so the funnel can route to /pricing
      // before /api/leads is actually called (when OTP_ENABLED=true, the
      // POST is deferred until after OTP success on /verifier-telephone).
      const clientLeadId = `LEAD${Date.now()}${Math.random().toString(36).substring(2, 10)}`

      // Now prepare complete lead data with pricing included
      const leadPayload = {
        firstName: leadData.firstName,
        lastName: leadData.lastName,
        email: leadData.email,
        phone: leadData.phone,
        leadId: clientLeadId,
        roofData,
        userAnswers: answers,
        pricingData,
        utmParams,
        eventId
      }

      if (OTP_ENABLED) {
        // Defer the submission: stash the payload, then let /verifier-telephone
        // submit it (with otpToken) after Twilio confirms the SMS code.
        sessionStorage.setItem('pending-lead', JSON.stringify(leadPayload))
        sessionStorage.setItem('otp-verify', JSON.stringify({ phone: leadData.phone, redirectTo: '/success' }))
      } else {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadPayload),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('❌ API ERROR - Status:', response.status)
          console.error('❌ API ERROR - Text:', errorText)
          throw new Error(`API call failed: ${response.status}`)
        }
      }

      const leadDataWithId = {
        ...leadData,
        leadId: clientLeadId
      }

      setShowLeadCapture(false)
      onComplete(answers, leadDataWithId, pricingData)
      
    } catch (error) {
      console.error('❌ CRITICAL ERROR in popup submission:', error)
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        name: error instanceof Error ? error.name : 'Unknown error type'
      })
      const area = roofData?.roofArea || 1500
      const fallbackPricing = {
        adjustedArea: area,
        ranges: {
          economique: {
            name: 'Économique', type: 'Cellulose soufflée', rValue: 50,
            thickness: '14 pouces', durability: '20-30 ans', icon: '🥉',
            features: ['Valeur R: 3,6-3,8 par pouce', 'Matériau 100% recyclé', 'Installation rapide'],
            totalCost: { min: Math.max(1500, Math.round(area * 0.90)), max: Math.round(area * 1.50) },
            annualSavings: { min: 350, max: 600 },
            heatingReduction: { min: 15, max: 25 },
            paybackPeriod: { min: 3, max: 6 },
            savings25Years: { min: 8750, max: 15000 },
            netGain25Years: { min: 5000, max: 12000 },
          },
          standard: {
            name: 'Standard', type: 'Fibre de verre soufflée', rValue: 55,
            thickness: '18 pouces', durability: '20-25 ans', icon: '🥈',
            features: ['Valeur R: 2,6-2,9 par pouce', 'Non combustible', 'Installation certifiée RBQ'],
            totalCost: { min: Math.max(2000, Math.round(area * 1.40)), max: Math.round(area * 2.80) },
            annualSavings: { min: 450, max: 750 },
            heatingReduction: { min: 20, max: 35 },
            paybackPeriod: { min: 3, max: 6 },
            savings25Years: { min: 11250, max: 18750 },
            netGain25Years: { min: 6000, max: 15000 },
          },
          premium: {
            name: 'Premium', type: 'Hybride : mousse projetée + soufflé', rValue: 60,
            thickness: '12 pouces', durability: '30-50 ans', icon: '🥇',
            features: ['Valeur R: 6,0+ par pouce (mousse)', 'Barrière d\'air et d\'humidité', 'Performance maximale'],
            totalCost: { min: Math.max(3500, Math.round(area * 3.00)), max: Math.round(area * 5.00) },
            annualSavings: { min: 600, max: 1000 },
            heatingReduction: { min: 25, max: 45 },
            paybackPeriod: { min: 5, max: 10 },
            savings25Years: { min: 15000, max: 25000 },
            netGain25Years: { min: 8000, max: 20000 },
          },
        }
      }
      const fallbackLeadId = `LEAD${Date.now()}${Math.random().toString(36).substring(2, 10)}`
      const fallbackPayload = {
        firstName: leadData.firstName,
        lastName: leadData.lastName,
        email: leadData.email,
        phone: leadData.phone,
        leadId: fallbackLeadId,
        roofData,
        userAnswers: answers,
        pricingData: fallbackPricing,
        utmParams,
      }
      if (OTP_ENABLED) {
        sessionStorage.setItem('pending-lead', JSON.stringify(fallbackPayload))
        sessionStorage.setItem('otp-verify', JSON.stringify({ phone: leadData.phone, redirectTo: '/success' }))
      } else {
        try {
          await fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackPayload),
          })
        } catch (fallbackErr) {
          console.error('❌ Fallback lead submission failed:', fallbackErr)
        }
      }
      setShowLeadCapture(false)
      onComplete(answers, { ...leadData, leadId: fallbackLeadId }, fallbackPricing)
    } finally {
      setIsSubmittingLead(false)
    }
  }

  return (
    <>
      <div className="max-w-3xl mx-auto px-4 pt-3 pb-4 sm:py-[60px] flex flex-col items-center gap-4 sm:gap-8">

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 bg-[#aedee5] rounded-full px-4 py-2 sm:py-2.5 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
          <span className="font-serif-body font-bold text-[#002042] text-base sm:text-xl leading-none tracking-[-0.8px]">
            Question {currentStep + 1}/{steps.length}
          </span>
          <Smile className="w-5 h-5 sm:w-6 sm:h-6 text-[#002042]" />
        </div>

        {/* Progress bar */}
        <div className="w-full bg-[#eef5fc] rounded-[100px] h-3 sm:h-4 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-[100px] transition-[width] duration-500"
            style={{
              width: `${getProgress()}%`,
              background: "linear-gradient(7.67deg, #aedee5 0%, #b9e15c 99.27%)",
            }}
          />
        </div>

        {/* Card */}
        <div className="bg-white rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] w-full flex flex-col gap-4 sm:gap-6 p-4 sm:p-8">

          {/* Title + description */}
          <div className="flex flex-col gap-1.5 sm:gap-3">
            <h2 className="font-heading font-bold text-[20px] sm:text-[24px] text-[#002042] tracking-[-0.72px] leading-[1.2]">
              {steps[currentStep].title}
            </h2>
            <p className="font-serif-body text-[14px] sm:text-[18px] text-[#002042] tracking-[-0.04em] leading-[1.2]">
              {steps[currentStep].description}
            </p>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-2 sm:gap-4">

            {/* Step 0: Système de chauffage */}
            {currentStep === 0 && [
              { value: "electricite", label: "Électricité (plinthes, air pulsé, thermopompe)" },
              { value: "bi-energie", label: "Bi-énergie (Hydro + combustible)" },
              { value: "gaz", label: "Gaz naturel" },
              { value: "mazout", label: "Mazout" },
              { value: "eau-chaude", label: "Système à eau chaude (chaudière/radiateurs)" },
              { value: "autre", label: "Autre / Je ne sais pas" },
            ].map((option) => {
              const selected = answers.heatingSystem === option.value
              return (
                <div
                  key={option.value}
                  onClick={() => selectAndAdvance('heatingSystem', option.value)}
                  className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-[20px] cursor-pointer transition-all ${
                    selected ? "bg-[#ecf8cf] border-2 border-[#86a735]" : "bg-white border border-[#aedee5] hover:border-[#375371]"
                  }`}
                >
                  {selected ? (
                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#86a735] flex items-center justify-center">
                      <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white stroke-[3]" />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-[#aedee5]" />
                  )}
                  <span className="font-serif-body font-semibold text-sm sm:text-[20px] text-[#002042] tracking-[-0.05em] leading-[1.2]">
                    {option.label}
                  </span>
                </div>
              )
            })}

            {/* Step 1: État de l'isolation */}
            {currentStep === 1 && [
              { value: "aucune", label: "Aucune isolation ou très peu" },
              { value: "partielle", label: "Isolation partielle" },
              { value: "complete", label: "Isolation complète mais ancienne" },
              { value: "recente", label: "Isolation récente" },
              { value: "inconnue", label: "Je ne sais pas" },
            ].map((option) => {
              const selected = answers.currentInsulation === option.value
              return (
                <div
                  key={option.value}
                  onClick={() => selectAndAdvance('currentInsulation', option.value)}
                  className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-[20px] cursor-pointer transition-all ${
                    selected ? "bg-[#ecf8cf] border-2 border-[#86a735]" : "bg-white border border-[#aedee5] hover:border-[#375371]"
                  }`}
                >
                  {selected ? (
                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#86a735] flex items-center justify-center">
                      <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white stroke-[3]" />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-[#aedee5]" />
                  )}
                  <span className="font-serif-body font-semibold text-sm sm:text-[20px] text-[#002042] tracking-[-0.05em] leading-[1.2]">
                    {option.label}
                  </span>
                </div>
              )
            })}

            {/* Step 2: Accès à l'entre-toit */}
            {currentStep === 2 && [
              { value: "facile", label: "Accès facile depuis l'intérieur" },
              { value: "trappe", label: "Trappe d'accès disponible" },
              { value: "difficile", label: "Accès difficile ou limité" },
              { value: "aucun", label: "Aucun accès direct" },
              { value: "inconnue", label: "Je ne sais pas" },
            ].map((option) => {
              const selected = answers.atticAccess === option.value
              return (
                <div
                  key={option.value}
                  onClick={() => selectAndAdvance('atticAccess', option.value)}
                  className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-[20px] cursor-pointer transition-all ${
                    selected ? "bg-[#ecf8cf] border-2 border-[#86a735]" : "bg-white border border-[#aedee5] hover:border-[#375371]"
                  }`}
                >
                  {selected ? (
                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#86a735] flex items-center justify-center">
                      <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white stroke-[3]" />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-[#aedee5]" />
                  )}
                  <span className="font-serif-body font-semibold text-sm sm:text-[20px] text-[#002042] tracking-[-0.05em] leading-[1.2]">
                    {option.label}
                  </span>
                </div>
              )
            })}

            {/* Step 3: Problèmes identifiés (multi-select) */}
            {currentStep === 3 && [
              { value: "moisissure", label: "Moisissure ou humidité" },
              { value: "courants-air", label: "Courants d'air" },
              { value: "factures-elevees", label: "Factures d'énergie élevées" },
              { value: "temperature-inegale", label: "Température inégale entre les pièces" },
              { value: "glace", label: "Formation de glace sur le toit" },
              { value: "aucun", label: "Aucun problème identifié" },
            ].map((problem) => {
              const checked = answers.identifiedProblems.includes(problem.value)
              return (
                <div
                  key={problem.value}
                  onClick={() => handleProblemToggle(problem.value)}
                  className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-[20px] cursor-pointer transition-all ${
                    checked ? "bg-[#ecf8cf] border-2 border-[#86a735]" : "bg-white border border-[#aedee5] hover:border-[#375371]"
                  }`}
                >
                  {checked ? (
                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-[6px] bg-[#86a735] flex items-center justify-center">
                      <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white stroke-[3]" />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-[6px] border-2 border-[#aedee5]" />
                  )}
                  <span className="font-serif-body font-semibold text-sm sm:text-[20px] text-[#002042] tracking-[-0.05em] leading-[1.2]">
                    {problem.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center pt-2 sm:pt-0 border-t border-[#e8e8e0]">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2 font-serif-body font-bold text-[#375371] hover:text-[#002042] disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-1 py-2 sm:py-3 text-sm sm:text-[18px]"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              Précédent
            </button>

            {currentStep === steps.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={!canGoNext()}
                className="flex items-center gap-1.5 bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-heading font-bold py-2 px-4 sm:py-3 sm:px-8 rounded-full shadow-[-2px_4px_0_0_#002042] hover:shadow-[-1px_2px_0_0_#002042] hover:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 text-sm sm:text-[18px]"
              >
                Obtenir ma soumission
                <CheckCircle className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-[90px] sm:w-[120px]" />
            )}
          </div>
        </div>
      </div>

      {/* Lead Capture Popup */}
      {showLeadCapture && (
        <LeadCapturePopup
          isOpen={showLeadCapture}
          onClose={() => setShowLeadCapture(false)}
          onSubmit={handleLeadSubmit}
          isSubmitting={isSubmittingLead}
          roofData={roofData}
        />
      )}
    </>
  )
}
