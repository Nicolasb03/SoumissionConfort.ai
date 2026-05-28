"use client"

import type React from "react"
import { Suspense, useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle, Loader2, MapPin } from "lucide-react"
import { getCurrentUTMParameters, type UTMParameters } from "@/lib/utm-utils"
import { getMunicipalityBySlug } from "@/lib/municipalities"
import { useAddressAutocomplete } from "@/hooks/use-address-autocomplete"
import { OTP_ENABLED } from "@/lib/feature-flags"
import { PhoneInput } from "@/components/phone-input"
import { isValidQuebecPhone } from "@/lib/phone"
import {
  SYMPTOMS_OPTIONS,
  HYDRO_BRACKETS,
  INTENT_OPTIONS,
  SESSION_STORAGE_KEYS,
  type SymptomCode,
  type HydroBracketCode,
  type IntentCode,
} from "@/lib/funnel-config"

declare global {
  interface Window {
    fbq: (...args: any[]) => void
    gtag: (...args: any[]) => void
    dataLayer: any[]
  }
}

/* ────────────────────────────────────────────
   Step config (Funnel V2: address → symptoms → hydro → intent)
   ──────────────────────────────────────────── */

type StepType = "address" | "multiselect" | "colorradio" | "intent"

interface StepConfig {
  key: "address" | "symptoms" | "hydroBracket" | "intent"
  title: string
  subtitle: string
  type: StepType
  helperText?: string
}

const STEP_CONFIG: readonly StepConfig[] = [
  {
    key: "address",
    title: "Où se trouve ta propriété?",
    subtitle: "On a besoin de ton adresse pour matcher avec des entrepreneurs dans ta région.",
    type: "address",
    helperText:
      "🔒 Ton adresse reste confidentielle — on la partage uniquement avec les entrepreneurs si tu décides d'avoir des soumissions.",
  },
  {
    key: "symptoms",
    title: "Quels symptômes tu vis en ce moment dans ta maison?",
    subtitle:
      "Sélectionne tout ce qui s'applique — un mauvais isolant cause souvent plusieurs problèmes en même temps.",
    type: "multiselect",
    helperText: "Tu peux en cocher autant que tu veux.",
  },
  {
    key: "hydroBracket",
    title: "Combien tu payes en moyenne pour l'Hydro par mois?",
    subtitle: "Prends la moyenne sur l'année (l'hiver coûte plus cher, l'été moins).",
    type: "colorradio",
    helperText:
      "Pas sûr du montant exact? Donne ton meilleur estimé — on s'en sert juste pour personnaliser ton estimation.",
  },
  {
    key: "intent",
    title: "Une dernière question :",
    subtitle: "Tu cherches à changer ton isolation, ou tu veux juste avoir une idée du coût?",
    type: "intent",
    helperText:
      "Les deux te donnent une estimation. La différence : si tu veux faire faire les travaux, on te match avec 3 entrepreneurs.",
  },
] as const

const STEPS_TOTAL = STEP_CONFIG.length

interface Selections {
  symptoms: SymptomCode[]
  hydroBracket?: HydroBracketCode
  intent?: IntentCode
}

/* ────────────────────────────────────────────
   Analytics helpers
   ──────────────────────────────────────────── */

function trackStepEvent(stepNumber: number, stepName: string, stepValue: string) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "questionnaire_step", {
      event_category: "pSEO Questionnaire",
      step_number: stepNumber,
      step_name: stepName,
      step_value: stepValue,
    })
  }
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("trackCustom", "QuestionnaireStep", {
      step_number: stepNumber,
      step_name: stepName,
      step_value: stepValue,
      source: "soumission-rapide",
    })
  }
}

function trackQuestionnaireStart(ville: string) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "questionnaire_start", {
      event_category: "pSEO Questionnaire",
      ville: ville,
    })
  }
}

function trackQuestionnaireComplete(ville: string) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "questionnaire_complete", {
      event_category: "pSEO Questionnaire",
      ville: ville,
    })
  }
}

function trackLeadSubmit(ville: string, eventId: string) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "generate_lead", {
      event_category: "pSEO Questionnaire",
      ville: ville,
      event_id: eventId,
    })
  }
}

/* ────────────────────────────────────────────
   Questionnaire content (reads search params)
   ──────────────────────────────────────────── */

function QuestionnaireContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const villeSlug = searchParams.get("ville") || ""
  const timeline = searchParams.get("timeline") || "exploring"

  const municipality = getMunicipalityBySlug(villeSlug)
  const cityName = municipality?.name || villeSlug

  const [currentStep, setCurrentStep] = useState(0)
  const [selections, setSelections] = useState<Selections>({ symptoms: [] })
  const [addressInput, setAddressInput] = useState("")
  const [validAddress, setValidAddress] = useState("")
  const [addressCity, setAddressCity] = useState("")
  const [addressPostalCode, setAddressPostalCode] = useState("")
  const [addressCoordinates, setAddressCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [addressProvince, setAddressProvince] = useState("")
  const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false)
  const [addressSelectedIndex, setAddressSelectedIndex] = useState(-1)
  const addressInputRef = useRef<HTMLInputElement>(null)
  const addressDropdownRef = useRef<HTMLDivElement>(null)
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [isSubmittingLead, setIsSubmittingLead] = useState(false)
  const submittingRef = useRef(false)
  const [utmParams, setUtmParams] = useState<UTMParameters>({})

  const {
    predictions: addressPredictions,
    isLoading: isLoadingAddressPredictions,
    fetchPredictions: fetchAddressPredictions,
    clearPredictions: clearAddressPredictions,
  } = useAddressAutocomplete()

  // Lead form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  })

  useEffect(() => {
    setUtmParams(getCurrentUTMParameters())
    trackQuestionnaireStart(villeSlug)
  }, [villeSlug])

  // Address autocomplete handlers (unchanged from V1)
  const handleAddressInputChange = (value: string) => {
    setAddressInput(value)
    setValidAddress("")
    setAddressCity("")
    setAddressPostalCode("")
    setAddressCoordinates(null)
    setAddressProvince("")
    if (value.length >= 2) {
      fetchAddressPredictions(value)
      setIsAddressDropdownOpen(true)
      setAddressSelectedIndex(-1)
    } else {
      clearAddressPredictions()
      setIsAddressDropdownOpen(false)
    }
  }

  const handleAddressPredictionSelect = async (prediction: {
    place_id: string
    description: string
    main_text: string
    secondary_text: string
  }) => {
    setAddressInput(prediction.description)
    setValidAddress(prediction.description)
    setIsAddressDropdownOpen(false)
    clearAddressPredictions()
    addressInputRef.current?.focus()
    if (prediction.place_id) {
      try {
        const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(prediction.place_id)}`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.address) {
            setAddressCity(data.address.city || "")
            setAddressPostalCode(data.address.postalCode || "")
            setAddressCoordinates(data.address.coordinates || null)
            setAddressProvince(data.address.province || "")
          }
        }
      } catch (e) {
        console.error("Failed to fetch place details:", e)
      }
    }
  }

  const handleAddressKeyDown = (e: React.KeyboardEvent) => {
    if (!isAddressDropdownOpen || addressPredictions.length === 0) return
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setAddressSelectedIndex((prev) => (prev < addressPredictions.length - 1 ? prev + 1 : 0))
        break
      case "ArrowUp":
        e.preventDefault()
        setAddressSelectedIndex((prev) => (prev > 0 ? prev - 1 : addressPredictions.length - 1))
        break
      case "Enter":
        e.preventDefault()
        if (addressSelectedIndex >= 0 && addressPredictions[addressSelectedIndex]) {
          handleAddressPredictionSelect(addressPredictions[addressSelectedIndex])
        }
        break
      case "Escape":
        setIsAddressDropdownOpen(false)
        setAddressSelectedIndex(-1)
        break
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        addressDropdownRef.current &&
        !addressDropdownRef.current.contains(event.target as Node) &&
        !addressInputRef.current?.contains(event.target as Node)
      ) {
        setIsAddressDropdownOpen(false)
        setAddressSelectedIndex(-1)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (addressPredictions.length > 0) setIsAddressDropdownOpen(true)
  }, [addressPredictions])

  // Navigation helpers
  const advanceStep = useCallback(() => {
    if (currentStep < STEPS_TOTAL - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      trackQuestionnaireComplete(villeSlug)
      setShowLeadForm(true)
    }
  }, [currentStep, villeSlug])

  const handleAddressNext = useCallback(() => {
    if (!validAddress) return
    trackStepEvent(currentStep + 1, "address", validAddress)
    advanceStep()
  }, [currentStep, validAddress, advanceStep])

  const handleSymptomToggle = useCallback((code: SymptomCode) => {
    setSelections((prev) => {
      const next = prev.symptoms.includes(code)
        ? prev.symptoms.filter((s) => s !== code)
        : [...prev.symptoms, code]
      return { ...prev, symptoms: next }
    })
  }, [])

  const handleSymptomsNext = useCallback(() => {
    if (selections.symptoms.length === 0) return
    trackStepEvent(currentStep + 1, "symptoms", selections.symptoms.join(","))
    advanceStep()
  }, [currentStep, selections.symptoms, advanceStep])

  const handleHydroSelect = useCallback(
    (code: HydroBracketCode) => {
      setSelections((prev) => ({ ...prev, hydroBracket: code }))
      trackStepEvent(currentStep + 1, "hydroBracket", code)
      setTimeout(advanceStep, 250)
    },
    [currentStep, advanceStep]
  )

  const handleIntentSelect = useCallback(
    (code: IntentCode) => {
      setSelections((prev) => ({ ...prev, intent: code }))
      trackStepEvent(currentStep + 1, "intent", code)
      setTimeout(advanceStep, 250)
    },
    [currentStep, advanceStep]
  )

  const isFormValid = () => {
    return Boolean(
      formData.firstName.trim() &&
      formData.lastName.trim() &&
      formData.email.trim() &&
      isValidQuebecPhone(formData.phone)
    )
  }

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid() || submittingRef.current) return
    submittingRef.current = true

    setIsSubmittingLead(true)
    const eventId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const clientLeadId = `LEAD${Date.now()}${Math.random().toString(36).substring(2, 10)}`

    // Funnel V2: fall back to defaults if reached lead form without filling all answers
    // (shouldn't happen in normal flow but defensive)
    const intent: IntentCode = selections.intent ?? "qualified"
    const hydroBracket: HydroBracketCode = selections.hydroBracket ?? "under_150"
    const symptoms = selections.symptoms

    // Store estimate inputs in a SEPARATE sessionStorage key so /merci can read them
    // (this key survives the verifier-telephone cleanup in the OTP flow).
    try {
      sessionStorage.setItem(
        SESSION_STORAGE_KEYS.ESTIMATE_INPUTS,
        JSON.stringify({ hydroBracket, symptoms, intent })
      )
    } catch {
      // sessionStorage might be unavailable in some embedded contexts
    }

    const leadPayload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      leadId: clientLeadId,
      ville: villeSlug,
      address: validAddress,
      city: addressCity,
      postalCode: addressPostalCode,
      coordinates: addressCoordinates,
      province: addressProvince,
      source: "soumission-rapide",
      leadType: "isolation_soumission_rapide",
      userAnswers: {
        // Funnel V2 fields
        symptoms,
        hydroBracket,
        intent,
        address: validAddress,
        timeline,
        // API compat — neutral defaults for legacy backend fields
        habitationType: "unifamiliale",
        projectType: "unifamiliale",
        ownershipStatus: "proprietaire",
        insulationStatus: "inconnue",
        currentInsulation: "inconnue",
        contactTime: timeline,
      },
      utmParams,
      eventId,
    }

    try {
      if (OTP_ENABLED) {
        sessionStorage.setItem("pending-lead", JSON.stringify(leadPayload))
      } else {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(leadPayload),
        })
        if (!res.ok) throw new Error(`leads api ${res.status}`)
      }

      // Phase 1 gate: only fire browser Lead pixel for qualified intent.
      // Curieux path doesn't pollute Meta pixel with Lead events.
      // (Phase 2 will also gate the server-side CAPI Lead.)
      if (intent === "qualified" && typeof window.fbq === "function") {
        window.fbq(
          "track",
          "Lead",
          {
            currency: "CAD",
            content_name: "isolation-soumission-rapide",
            ...(utmParams.utm_source && { utm_source: utmParams.utm_source }),
            ...(utmParams.utm_campaign && { utm_campaign: utmParams.utm_campaign }),
            ...(utmParams.utm_medium && { utm_medium: utmParams.utm_medium }),
            ...(utmParams.utm_content && { utm_content: utmParams.utm_content }),
          },
          { eventID: eventId }
        )
      }

      trackLeadSubmit(villeSlug, eventId)

      sessionStorage.setItem(
        "soumission-rapide-lead",
        JSON.stringify({
          firstName: formData.firstName,
          phone: formData.phone,
          ville: cityName,
          villeSlug,
          leadId: clientLeadId,
          address: validAddress,
          timeline,
          intent,
        })
      )

      router.push(OTP_ENABLED ? "/soumission-rapide/verifier-telephone" : "/soumission-rapide/merci")
    } catch (err) {
      console.error("Lead submission error:", err)
      sessionStorage.setItem(
        "soumission-rapide-lead",
        JSON.stringify({
          firstName: formData.firstName,
          phone: formData.phone,
          ville: cityName,
          villeSlug,
          address: validAddress,
          timeline,
          intent,
        })
      )
      router.push(OTP_ENABLED ? "/soumission-rapide/verifier-telephone" : "/soumission-rapide/merci")
    } finally {
      setIsSubmittingLead(false)
    }
  }

  const progressPercent = showLeadForm ? 100 : Math.min((currentStep + 1) * 25, 75)
  const currentStepCfg = STEP_CONFIG[currentStep]
  const isQualifiedIntent = selections.intent === "qualified"

  const leadFormTitle = isQualifiedIntent
    ? "Parfait! Comment on te rejoint pour finaliser ta soumission?"
    : "Cool! On t'envoie ton estimation."
  const leadFormSubtitle = isQualifiedIntent
    ? "Tu vas recevoir 3 soumissions d'entrepreneurs spécialistes près de chez toi."
    : "Pas d'engagement — un conseiller peut te contacter si tu veux pousser plus loin."
  const submitLabel = isQualifiedIntent ? "Recevoir mes 3 soumissions" : "Voir mon estimation"

  return (
    <div
      className="min-h-screen bg-[#FFFFF6] flex flex-col items-center"
      style={{ fontFamily: "'Source Serif Pro', Georgia, serif" }}
    >
      {/* Header */}
      <div className="w-full px-4 lg:px-[60px] py-4">
        <Link href="/" className="flex items-center gap-3">
          <img src="/images/logo-icon.svg" alt="" className="h-[48px] md:h-[62px] w-auto" />
          <div
            className="font-bold text-[#002042] leading-[0.9] tracking-[-0.04em] text-[18px] md:text-[26px]"
            style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
          >
            <p>Soumission</p>
            <p>Confort</p>
          </div>
        </Link>
      </div>

      {/* Main content */}
      <div className="flex-1 w-full max-w-[700px] px-4 pb-20 flex flex-col gap-[32px] items-center">
        {!showLeadForm && (
          <div className="bg-[#aedee5] flex gap-[4px] items-center justify-center px-[16px] py-[10px] rounded-full shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
            <p
              className="font-bold text-[20px] text-[#002042] text-center tracking-[-0.8px] leading-[1.2]"
              style={{ fontFamily: "'Source Serif Pro', serif" }}
            >
              Question {currentStep + 1}/{STEPS_TOTAL}
            </p>
            <img src="/images/icon-question-badge.svg" alt="" className="w-[24px] h-[24px]" />
          </div>
        )}

        <div className="w-full h-[16px] bg-[#eef5fc] rounded-[100px] relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-[100px] transition-[width] duration-700 ease-in-out"
            style={{
              width: `${progressPercent}%`,
              background: "linear-gradient(2.57deg, #AEDEE5 0%, #b9e15c 99.27%)",
            }}
          />
        </div>

        {!showLeadForm && (
          <div className="bg-white border-4 border-[#aedee5] rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-[32px] w-full flex flex-col gap-[24px]">
            <div className="flex flex-col gap-[16px] items-start w-full text-[#002042] tracking-[-0.72px] leading-[1.2]">
              <h2
                className="font-bold text-[24px] w-full"
                style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
              >
                {currentStepCfg.title}
              </h2>
              <p
                className="text-[18px] w-full"
                style={{ fontFamily: "'Source Serif Pro', serif" }}
              >
                {currentStepCfg.subtitle}
              </p>
            </div>

            {/* ── Step type: address ── */}
            {currentStepCfg.type === "address" && (
              <div className="flex flex-col gap-[16px] w-full">
                <div className="relative w-full">
                  <div className="flex items-center w-full bg-[#f6f8fb] border border-[#dbe0ec] rounded-full px-[16px] py-[16px] gap-[10px]">
                    {isLoadingAddressPredictions ? (
                      <Loader2 className="w-[20px] h-[20px] shrink-0 text-[#6c6c6c] animate-spin" />
                    ) : (
                      <img src="/images/icon-search.svg" alt="" className="w-[20px] h-[20px] shrink-0" />
                    )}
                    <input
                      ref={addressInputRef}
                      type="text"
                      value={addressInput}
                      onChange={(e) => handleAddressInputChange(e.target.value)}
                      onKeyDown={handleAddressKeyDown}
                      placeholder="Ex : 123 rue Principale, Alma, QC"
                      className="flex-1 bg-transparent outline-none text-[#002042] text-[16px] tracking-[-0.64px] leading-none placeholder:text-[#6c6c6c]"
                      style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 500 }}
                    />
                    {validAddress && (
                      <CheckCircle className="w-[20px] h-[20px] shrink-0 text-[#b9e15c]" />
                    )}
                  </div>
                  {isAddressDropdownOpen && addressPredictions.length > 0 && (
                    <div
                      ref={addressDropdownRef}
                      className="absolute z-40 w-full mt-2 bg-white border border-[#dbe0ec] rounded-[16px] shadow-lg overflow-hidden"
                    >
                      {addressPredictions.map((prediction, index) => (
                        <button
                          key={prediction.place_id}
                          onClick={() => handleAddressPredictionSelect(prediction)}
                          className={`w-full px-[16px] py-[12px] text-left flex items-start gap-3 border-b border-[#eef5fc] last:border-b-0 transition-colors ${
                            index === addressSelectedIndex ? "bg-[#eef5fc]" : "hover:bg-[#f6f8fb]"
                          }`}
                        >
                          <MapPin className="w-[16px] h-[16px] mt-[2px] shrink-0 text-[#aedee5]" />
                          <div className="flex-1 min-w-0">
                            <p
                              className="font-medium text-[#002042] text-[14px] truncate"
                              style={{ fontFamily: "'Source Serif Pro', serif" }}
                            >
                              {prediction.main_text}
                            </p>
                            {prediction.secondary_text && (
                              <p
                                className="text-[12px] text-[#375371] truncate"
                                style={{ fontFamily: "'Source Serif Pro', serif" }}
                              >
                                {prediction.secondary_text}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {currentStepCfg.helperText && (
                  <p className="text-[14px] text-[#375371] leading-[1.4] tracking-[-0.42px]">
                    {currentStepCfg.helperText}
                  </p>
                )}
              </div>
            )}

            {/* ── Step type: multiselect (symptoms) ── */}
            {currentStepCfg.type === "multiselect" && (
              <div className="flex flex-col gap-[16px] w-full">
                <div className="flex flex-col gap-[12px] w-full">
                  {SYMPTOMS_OPTIONS.map((opt) => {
                    const isSelected = selections.symptoms.includes(opt.code)
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => handleSymptomToggle(opt.code)}
                        className={`flex flex-row items-center gap-[16px] w-full p-[16px] rounded-[20px] transition-all text-left ${
                          isSelected
                            ? "border-2 border-[#b9e15c] bg-[#f4fce4]"
                            : "border-2 border-[#aedee5] bg-white hover:border-[#b9e15c]/60"
                        }`}
                      >
                        <span className="text-[24px] shrink-0">{opt.emoji}</span>
                        <span
                          className="text-[#002042] text-[16px] tracking-[-0.56px] leading-[1.2] flex-1"
                          style={{ fontFamily: "'Source Serif Pro', serif" }}
                        >
                          {opt.label}
                        </span>
                        {isSelected && (
                          <CheckCircle className="w-[24px] h-[24px] shrink-0 text-[#b9e15c]" />
                        )}
                      </button>
                    )
                  })}
                </div>
                {currentStepCfg.helperText && (
                  <p className="text-[14px] text-[#375371] italic leading-[1.4] tracking-[-0.42px]">
                    {currentStepCfg.helperText}
                  </p>
                )}
              </div>
            )}

            {/* ── Step type: colorradio (hydro brackets) ── */}
            {currentStepCfg.type === "colorradio" && (
              <div className="flex flex-col gap-[16px] w-full">
                <div className="flex flex-col gap-[12px] w-full">
                  {HYDRO_BRACKETS.map((opt) => {
                    const isSelected = selections.hydroBracket === opt.code
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => handleHydroSelect(opt.code)}
                        className={`flex flex-row items-center gap-[16px] w-full p-[16px] rounded-[20px] border-2 transition-all text-left ${opt.colorClass} ${
                          isSelected ? "border-[#002042] scale-[0.99]" : ""
                        }`}
                      >
                        <span className="text-[20px] shrink-0">{opt.emoji}</span>
                        <span
                          className="text-[16px] font-semibold tracking-[-0.56px] leading-[1.2] flex-1"
                          style={{ fontFamily: "'Source Serif Pro', serif" }}
                        >
                          {opt.label}
                        </span>
                        {isSelected && (
                          <CheckCircle className="w-[24px] h-[24px] shrink-0 text-[#002042]" />
                        )}
                      </button>
                    )
                  })}
                </div>
                {currentStepCfg.helperText && (
                  <p className="text-[14px] text-[#375371] italic leading-[1.4] tracking-[-0.42px]">
                    {currentStepCfg.helperText}
                  </p>
                )}
              </div>
            )}

            {/* ── Step type: intent ── */}
            {currentStepCfg.type === "intent" && (
              <div className="flex flex-col gap-[16px] w-full">
                <div className="flex flex-col gap-[12px] w-full">
                  {INTENT_OPTIONS.map((opt) => {
                    const isSelected = selections.intent === opt.code
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => handleIntentSelect(opt.code)}
                        className={`flex flex-row items-start gap-[16px] w-full p-[20px] rounded-[20px] border-2 transition-all text-left ${
                          isSelected
                            ? "border-[#b9e15c] bg-[#f4fce4]"
                            : "border-[#aedee5] bg-white hover:border-[#b9e15c]/60"
                        }`}
                      >
                        <span className="text-[32px] shrink-0">{opt.emoji}</span>
                        <div className="flex flex-col gap-[4px] flex-1">
                          <span
                            className="text-[18px] font-bold text-[#002042] tracking-[-0.72px] leading-[1.2]"
                            style={{ fontFamily: "'Source Serif Pro', serif" }}
                          >
                            {opt.label}
                          </span>
                          <span className="text-[14px] text-[#375371] italic tracking-[-0.42px] leading-[1.2]">
                            {opt.description}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
                {currentStepCfg.helperText && (
                  <p className="text-[14px] text-[#375371] italic leading-[1.4] tracking-[-0.42px]">
                    {currentStepCfg.helperText}
                  </p>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => {
                  if (showLeadForm) setShowLeadForm(false)
                  else if (currentStep > 0) setCurrentStep((p) => p - 1)
                  else router.back()
                }}
                className="flex items-center gap-[10px] h-[56px] py-[16px] text-[#375371] hover:text-[#002042] transition-colors"
              >
                <ArrowLeft className="w-[24px] h-[24px]" />
                <span
                  className="font-bold text-[18px]"
                  style={{ fontFamily: "'Source Serif Pro', serif" }}
                >
                  Précédent
                </span>
              </button>

              {currentStepCfg.type === "address" && (
                <button
                  type="button"
                  onClick={handleAddressNext}
                  disabled={!validAddress}
                  className="bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-bold text-[18px] h-[56px] px-[32px] rounded-full shadow-[-2px_4px_0px_0px_#002042] hover:shadow-[-1px_2px_0px_0px_#002042] hover:translate-y-[1px] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
                  style={{ fontFamily: "'Source Serif Pro', serif" }}
                >
                  Continuer
                </button>
              )}
              {currentStepCfg.type === "multiselect" && (
                <button
                  type="button"
                  onClick={handleSymptomsNext}
                  disabled={selections.symptoms.length === 0}
                  className="bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-bold text-[18px] h-[56px] px-[32px] rounded-full shadow-[-2px_4px_0px_0px_#002042] hover:shadow-[-1px_2px_0px_0px_#002042] hover:translate-y-[1px] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
                  style={{ fontFamily: "'Source Serif Pro', serif" }}
                >
                  {selections.symptoms.length === 0 ? "Sélectionne au moins un" : "Continuer"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Inline lead form */}
        {showLeadForm && (
          <div className="bg-white border-4 border-[#aedee5] rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-[32px] w-full flex flex-col gap-[24px]">
            <div className="flex flex-col gap-[16px] items-center text-center w-full">
              <h2
                className="font-bold text-[24px] text-[#002042] tracking-[-0.72px] leading-[1.2] w-full"
                style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
              >
                {leadFormTitle}
              </h2>
              <p className="text-[18px] text-[#375371] leading-[1.2] tracking-[-0.72px] w-full">
                {leadFormSubtitle}
              </p>
            </div>

            {process.env.NODE_ENV === "development" && (
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    firstName: "Jean",
                    lastName: "Tremblay",
                    email: "jean.tremblay@test.com",
                    phone: "5145551234",
                  })
                }
                className="self-end text-[11px] font-mono bg-yellow-100 border border-yellow-400 text-yellow-800 px-2 py-1 rounded hover:bg-yellow-200 transition-colors"
              >
                [DEV] Remplir le formulaire
              </button>
            )}

            <form onSubmit={handleLeadSubmit} className="flex flex-col gap-[16px] w-full">
              <div className="flex gap-[16px] w-full">
                <div className="flex flex-col gap-[4px] flex-1 min-w-0">
                  <label
                    htmlFor="firstName"
                    className="text-[14px] text-[#375371] leading-[1.2] tracking-[-0.56px]"
                  >
                    Prénom*
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                    disabled={isSubmittingLead}
                    className="w-full bg-[#f6f8fb] border border-[#dbe0ec] rounded-[10px] h-[56px] px-[16px] text-[#002042] text-[16px] outline-none focus:border-[#aedee5] transition-colors placeholder:text-[#6c6c6c]"
                    style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 500 }}
                    placeholder="Ex : Marc"
                    required
                  />
                </div>
                <div className="flex flex-col gap-[4px] flex-1 min-w-0">
                  <label
                    htmlFor="lastName"
                    className="text-[14px] text-[#375371] leading-[1.2] tracking-[-0.56px]"
                  >
                    Nom de famille*
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                    disabled={isSubmittingLead}
                    className="w-full bg-[#f6f8fb] border border-[#dbe0ec] rounded-[10px] h-[56px] px-[16px] text-[#002042] text-[16px] outline-none focus:border-[#aedee5] transition-colors placeholder:text-[#6c6c6c]"
                    style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 500 }}
                    placeholder="Ex : Tremblay"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-[4px] w-full">
                <label
                  htmlFor="email"
                  className="text-[14px] text-[#375371] leading-[1.2] tracking-[-0.56px]"
                >
                  Courriel*
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  disabled={isSubmittingLead}
                  className="w-full bg-[#f6f8fb] border border-[#dbe0ec] rounded-[10px] h-[56px] px-[16px] text-[#002042] text-[16px] outline-none focus:border-[#aedee5] transition-colors placeholder:text-[#6c6c6c]"
                  style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 500 }}
                  placeholder="ton@courriel.com"
                  required
                />
              </div>

              <div className="flex flex-col gap-[4px] w-full">
                <label
                  htmlFor="phone"
                  className="text-[14px] text-[#375371] leading-[1.2] tracking-[-0.56px]"
                >
                  Téléphone*
                </label>
                <PhoneInput
                  id="phone"
                  value={formData.phone}
                  onChange={(value) => setFormData((prev) => ({ ...prev, phone: value }))}
                  disabled={isSubmittingLead}
                  inputClassName="w-full bg-[#f6f8fb] border border-[#dbe0ec] rounded-[10px] h-[56px] px-[16px] text-[#002042] text-[16px] outline-none focus:border-[#aedee5] transition-colors placeholder:text-[#6c6c6c]"
                  style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 500 }}
                  placeholder="(514) 555-1234"
                  required
                />
              </div>

              <p className="text-[13px] text-[#375371] italic text-center leading-[1.4] tracking-[-0.42px]">
                En continuant, tu acceptes qu&apos;on te contacte par téléphone, courriel ou texto.
              </p>

              <button
                type="submit"
                disabled={!isFormValid() || isSubmittingLead}
                className="w-full h-[56px] bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-bold text-[18px] rounded-full px-[32px] shadow-[-2px_4px_0_0_#002042] hover:shadow-[-1px_2px_0_0_#002042] hover:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
                style={{ fontFamily: "'Source Serif Pro', serif" }}
              >
                {isSubmittingLead ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    On prépare ton dossier...
                  </span>
                ) : (
                  submitLabel
                )}
              </button>
            </form>

            {/* Trust badges — only for qualified intent */}
            {isQualifiedIntent && (
              <div className="flex flex-wrap justify-center gap-x-[24px] gap-y-[8px]">
                {["Gratuit et sans obligation", "Entrepreneurs certifiés RBQ", "Soumissions en 48h"].map(
                  (label) => (
                    <div key={label} className="flex items-center gap-[6px]">
                      <img src="/images/icon-check-green.svg" alt="" className="w-[24px] h-[24px] shrink-0" />
                      <span className="text-[18px] text-[#10002c] leading-[1.2] tracking-[-0.72px]">
                        {label}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}

            {/* "Que se passe-t-il ensuite?" — only for qualified intent */}
            {isQualifiedIntent && (
              <div className="bg-[#eef5fc] rounded-[20px] p-[16px] flex flex-col gap-[16px] w-full">
                <p className="text-[14px] font-semibold text-[#002042] text-center leading-[1.2] tracking-[-0.56px]">
                  Que se passe-t-il ensuite ?
                </p>
                <div className="flex flex-col sm:flex-row gap-[12px]">
                  {[
                    {
                      title: "1. Nous lançons la recherche",
                      desc:
                        "Notre équipe analyse votre projet et lance la recherche dans notre réseau d'entrepreneurs certifiés près de chez vous.",
                    },
                    {
                      title: "2. Nous discutons avec les entrepreneurs",
                      desc:
                        "Nous validons avec eux les détails de votre projet pour trouver les entrepreneurs les plus pertinents.",
                    },
                    {
                      title: "3. Vous recevez jusqu'à 3 soumissions",
                      desc:
                        "Nous vous faisons parvenir jusqu'à 3 soumissions d'entrepreneurs prêts à prendre en charge votre projet.",
                    },
                  ].map((step) => (
                    <div
                      key={step.title}
                      className="bg-white border border-[#aedee5] rounded-[20px] p-[16px] flex-1 flex flex-col gap-[16px]"
                    >
                      <p className="font-semibold text-[14px] text-[#10002c] leading-[1.2] tracking-[-0.56px]">
                        {step.title}
                      </p>
                      <p className="text-[14px] text-[#375371] leading-[1.2] tracking-[-0.56px]">
                        {step.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────
   Page wrapper with Suspense
   ──────────────────────────────────────────── */

export default function QuestionnairePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FFFFF6] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#b9e15c] border-t-[#002042] rounded-full animate-spin" />
        </div>
      }
    >
      <QuestionnaireContent />
    </Suspense>
  )
}
