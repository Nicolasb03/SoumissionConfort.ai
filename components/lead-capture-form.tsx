"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { OTP_ENABLED } from "@/lib/feature-flags"
import { PhoneInput } from "@/components/phone-input"
import { isValidQuebecPhone } from "@/lib/phone"

interface LeadCaptureFormProps {
  roofData: any
  userAnswers: any
  leadData: any
  onComplete: (pricingData: any) => void
}

export function LeadCaptureForm({ roofData, userAnswers, leadData, onComplete }: LeadCaptureFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const clientLeadId = `LEAD${Date.now()}${Math.random().toString(36).substring(2, 10)}`
    const leadPayload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      leadId: clientLeadId,
      roofData,
      userAnswers,
    }

    try {
      if (OTP_ENABLED) {
        // Defer the /api/leads call until OTP is verified.
        sessionStorage.setItem('pending-lead', JSON.stringify(leadPayload))
      } else {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadPayload),
        }).catch(fetchError => {
          console.error('🔥 FETCH ERROR:', fetchError.message)
          throw fetchError
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('❌ API ERROR - Status:', response.status, errorText)
          throw new Error(`API call failed: ${response.status}`)
        }
      }
    } catch (error) {
      console.error('❌ CRITICAL ERROR submitting lead:', error)
    } finally {
      setIsSubmitting(false)
    }

    if (OTP_ENABLED) {
      sessionStorage.setItem('otp-verify', JSON.stringify({ phone: formData.phone, redirectTo: '/success' }))
      router.push('/verifier-telephone')
    } else {
      router.push('/success')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const isFormValid = Boolean(formData.firstName && formData.lastName && formData.email && isValidQuebecPhone(formData.phone))

  if (isSubmitting) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Envoi en cours...</h2>
        <p className="text-gray-600">Nous transmettons vos informations aux entrepreneurs</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">🎯 Obtenez vos soumissions</h1>
        <p className="text-xl text-gray-600">
          Entrez vos coordonnées pour recevoir des soumissions personnalisées de nos entrepreneurs certifiés
        </p>
      </div>

      <Card className="shadow-2xl border-0">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl">Vos informations de contact</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prénom *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Jean"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom *</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Dupont"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="jean.dupont@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone *</label>
              <PhoneInput
                value={formData.phone}
                onChange={(value) => setFormData((prev) => ({ ...prev, phone: value }))}
                inputClassName="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="(514) 555-0123"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={!isFormValid}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              🚀 Obtenir mes soumissions gratuites
            </Button>

            <p className="text-sm text-gray-500 text-center">
              ⚡ Résultats instantanés • 🔒 100% sécurisé • 📞 Aucun appel non sollicité
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
