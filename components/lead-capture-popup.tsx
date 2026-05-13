"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useLanguage } from "@/lib/language-context"
import { X, Loader2, Shield, CheckCircle } from 'lucide-react'
import { track } from '@vercel/analytics'
import { PhoneInput } from "@/components/phone-input"
import { isValidQuebecPhone } from "@/lib/phone"

interface LeadCapturePopupProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (leadData: LeadData) => void
  isSubmitting?: boolean
  roofData?: any
}

export interface LeadData {
  firstName: string
  lastName: string
  email: string
  phone: string
  leadId?: string
}

export function LeadCapturePopup({ isOpen, onClose, onSubmit, isSubmitting = false, roofData }: LeadCapturePopupProps) {
  const { t } = useLanguage()
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [formData, setFormData] = useState<LeadData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  })

  const estimatedMaxSavings = roofData?.roofArea
    ? Math.round((roofData.roofArea / 2000) * 1200)
    : 1200

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isFormValid()) {
      track('Lead Submitted', { firstName: formData.firstName, email: formData.email })
      onSubmit(formData)
    }
  }

  const isFormValid = () => {
    return Boolean(
      formData.firstName.trim() &&
      formData.lastName.trim() &&
      formData.email.trim() &&
      isValidQuebecPhone(formData.phone)
    )
  }

  const handleClose = () => {
    if (!isSubmitting) onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full sm:max-w-lg max-h-[95vh] overflow-y-auto overflow-x-hidden border-0 shadow-2xl p-4 sm:p-6">
        {/* Logo + close */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <img src="/images/logo-icon.svg" alt="" className="h-7 md:h-[48px] w-auto" />
            <div className="font-heading font-bold text-[#002042] leading-[0.9] tracking-[-0.04em] text-[18px] md:text-[26px] whitespace-nowrap">
              <p>Soumission</p>
              <p>Confort</p>
            </div>
          </div>
          {!isSubmitting && (
            <button onClick={handleClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <X className="h-4 w-4 text-[#375371]" />
            </button>
          )}
        </div>

        {/* Header */}
        <DialogHeader className="text-center pb-3">
          <DialogTitle className="font-heading text-xl md:text-2xl font-bold text-[#10002c] text-center">
            Plus qu'une étape avant d'obtenir votre estimation
          </DialogTitle>
          <DialogDescription asChild>
            <div className="bg-[#aedee5]/30 border border-[#aedee5] rounded-xl p-3 text-center mt-2">
              <p className="font-serif-body text-[#002042] font-semibold text-sm">
                Selon notre analyse, vous pouvez économiser jusqu'à{' '}
                <span className="font-bold">{estimatedMaxSavings.toLocaleString()}$ par année</span>{' '}
                sur vos factures d'énergie.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3 max-w-md mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName" className="font-serif-body text-sm font-medium text-[#375371]">
                {t.firstName} *
              </Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                disabled={isSubmitting}
                className="mt-1 border-2 border-[#e8e8e0] focus:border-[#002042] rounded-lg font-serif-body"
                placeholder="Jean"
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName" className="font-serif-body text-sm font-medium text-[#375371]">
                {t.lastName} *
              </Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                disabled={isSubmitting}
                className="mt-1 border-2 border-[#e8e8e0] focus:border-[#002042] rounded-lg font-serif-body"
                placeholder="Tremblay"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email" className="font-serif-body text-sm font-medium text-[#375371]">
              {t.emailAddress} *
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              disabled={isSubmitting}
              className="mt-1 border-2 border-[#e8e8e0] focus:border-[#002042] rounded-lg font-serif-body"
              placeholder="jean@exemple.com"
              required
            />
          </div>

          <div>
            <Label className="font-serif-body text-sm font-medium text-[#375371]">
              {t.phoneNumber} *
            </Label>
            <div className="mt-1">
              <PhoneInput
                value={formData.phone}
                onChange={(value) => setFormData((prev) => ({ ...prev, phone: value }))}
                disabled={isSubmitting}
                inputClassName="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm border-2 border-[#e8e8e0] focus:border-[#002042] rounded-lg font-serif-body"
                placeholder="(514) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-2">
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!isFormValid() || isSubmitting}
              className="w-full bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-heading font-bold py-4 px-6 rounded-full transition-all duration-300 shadow-[-2px_4px_0_0_#002042] hover:shadow-[-1px_2px_0_0_#002042] hover:translate-y-0.5 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
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
          </div>
        </form>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 pt-3 border-t border-[#e8e8e0]">
          <div className="flex items-center space-x-1.5 font-serif-body text-sm text-[#375371]">
            <Shield className="w-4 h-4 text-[#002042]" />
            <span>100% Sécurisé</span>
          </div>
          <div className="flex items-center space-x-1.5 font-serif-body text-sm text-[#375371]">
            <CheckCircle className="w-4 h-4 text-[#002042]" />
            <span>Entrepreneurs certifiés RBQ</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
