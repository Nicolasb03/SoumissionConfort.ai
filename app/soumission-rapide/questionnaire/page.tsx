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
import { computeLeadEventId } from "@/lib/event-id"

declare global {
  interface Window {
    fbq: (...args: any[]) => void
    gtag: (...args: any[]) => void
    dataLayer: any[]
  }
}

/* ────────────────────────────────────────────
   Step option data
   ──────────────────────────────────────────── */

const HABITATION_OPTIONS = [
  { value: "unifamiliale", label: "Maison unifamiliale", sub: null as null | string, icon: "/images/icon-habitation-unifamiliale.svg" },
  { value: "multiplex", label: "Multiplex", sub: null as null | string, icon: "/images/icon-habitation-multiplex.svg" },
]

const OWNERSHIP_OPTIONS = [
  { value: "proprietaire", label: "Je suis déjà propriétaire", sub: null as null | string, icon: "/images/icon-proprietaire-oui.svg" },
  { value: "achat", label: "En processus d'achat", sub: null as null | string, icon: "/images/icon-proprietaire-achat.svg" },
  { value: "vente", label: "En processus de vente", sub: null as null | string, icon: "/images/icon-proprietaire-vente.svg" },
]

const INSULATION_STATUS_OPTIONS = [
  { value: "insuffisante", label: "Oui, mais l'isolation est insuffisante", sub: null as null | string, icon: "/images/icon-isolation-insuffisante.svg" },
  { value: "non", label: "Non / très peu isolé", sub: null as null | string, icon: "/images/icon-isolation-non.svg" },
  { value: "inconnue", label: "Je ne sais pas", sub: null as null | string, icon: "/images/icon-isolation-inconnue.svg" },
]

const PROJECT_TYPE_OPTIONS = [
  { value: "nouvelle", label: "Nouvelle isolation", sub: "Combles non isolés", icon: null as null | string },
  { value: "amelioration", label: "Amélioration", sub: "Augmenter la performance", icon: null as null | string },
  { value: "reparation", label: "Réparation", sub: "Problème existant", icon: null as null | string },
  { value: "not-sure", label: "Pas certain", sub: "Je veux juste comparer", icon: null as null | string },
]

const CURRENT_INSULATION_OPTIONS = [
  { value: "aucune", label: "Aucune isolation", sub: "Combles vides", icon: null as null | string },
  { value: "partielle", label: "Isolation partielle", sub: "Insuffisante ou vieille", icon: null as null | string },
  { value: "complete", label: "Isolation complète", sub: "Mais à remplacer", icon: null as null | string },
  { value: "inconnue", label: "Je ne sais pas", sub: "À évaluer", icon: null as null | string },
]

const PROBLEMS_OPTIONS = [
  { value: "maison-froide", label: "Maison froide", sub: "En hiver surtout", icon: null as null | string },
  { value: "factures-elevees", label: "Factures élevées", sub: "Chauffage ou clim", icon: null as null | string },
  { value: "moisissures", label: "Moisissures / humidité", sub: "Dans les combles", icon: null as null | string },
  { value: "courants-air", label: "Courants d'air", sub: "Infiltrations", icon: null as null | string },
  { value: "aucun", label: "Aucun problème", sub: "Projet préventif", icon: null as null | string },
]

const TIMELINE_OPTIONS = [
  { value: "urgent", label: "Dès que possible", sub: null as null | string, icon: "/images/icon-timeline-urgent.svg" },
  { value: "soon", label: "3 prochains mois", sub: null as null | string, icon: "/images/icon-timeline-soon.svg" },
  { value: "later", label: "Dans l'année", sub: null as null | string, icon: "/images/icon-timeline-later.svg" },
  { value: "exploring", label: "Je magasine seulement", sub: null as null | string, icon: "/images/icon-timeline-exploring.svg" },
]

const CONTACT_TIME_OPTIONS = [
  { value: "morning", label: "Matin", sub: "8h à 12h", icon: null as null | string },
  { value: "afternoon", label: "Après-midi", sub: "12h à 17h", icon: null as null | string },
  { value: "evening", label: "Soirée", sub: "17h à 20h", icon: null as null | string },
  { value: "anytime", label: "N'importe quand", sub: "Je suis flexible", icon: null as null | string },
]

const STEP_CONFIG = [
  { key: "habitationType", title: "Type d'habitation", subtitle: "Quel type d'habitation souhaitez-vous isoler ?", iconSize: 48, labelSize: 14, type: "options" as const, options: HABITATION_OPTIONS },
  { key: "ownershipStatus", title: "Êtes-vous propriétaire ?", subtitle: "Êtes-vous en processus d'achat ou de vente de l'habitation ?", iconSize: 48, labelSize: 14, type: "options" as const, options: OWNERSHIP_OPTIONS },
  { key: "insulationStatus", title: "État de l'isolation", subtitle: "Savez-vous si votre entretoit est déjà isolé ?", iconSize: 80, labelSize: 14, type: "options" as const, options: INSULATION_STATUS_OPTIONS },
  { key: "address", title: "Où se trouve votre propriété ?", subtitle: "Pour trouver des entrepreneurs près de chez vous et estimer vos économies potentielles.", iconSize: 0, labelSize: 0, type: "address" as const, options: [] },
]

const STEPS_TOTAL = STEP_CONFIG.length

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
  const [selections, setSelections] = useState<Record<string, string>>({})
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

  // Address autocomplete handlers
  const handleAddressInputChange = (value: string) => {
    setAddressInput(value)
    setValidAddress("") // reset on typing
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

  const handleAddressPredictionSelect = async (prediction: { place_id: string; description: string; main_text: string; secondary_text: string }) => {
    setAddressInput(prediction.description)
    setValidAddress(prediction.description)
    setIsAddressDropdownOpen(false)
    clearAddressPredictions()
    addressInputRef.current?.focus()
    // Fetch structured address data (city, postalCode) from place details
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

  const handleSelect = useCallback((stepKey: string, value: string) => {
    setSelections((prev) => ({ ...prev, [stepKey]: value }))
    trackStepEvent(currentStep + 1, stepKey, value)
    setTimeout(() => {
      if (currentStep < STEPS_TOTAL - 1) {
        setCurrentStep((prev) => prev + 1)
      } else {
        trackQuestionnaireComplete(villeSlug)
        setShowLeadForm(true)
      }
    }, 250)
  }, [currentStep, villeSlug])

  const handleAddressNext = useCallback(() => {
    if (!validAddress) return
    trackStepEvent(currentStep + 1, "address", validAddress)
    if (currentStep < STEPS_TOTAL - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      trackQuestionnaireComplete(villeSlug)
      setShowLeadForm(true)
    }
  }, [currentStep, villeSlug, validAddress])

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
    const eventId = await computeLeadEventId(formData.phone, formData.email)

    const clientLeadId = `LEAD${Date.now()}${Math.random().toString(36).substring(2, 10)}`
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
        habitationType: selections.habitationType || "",
        projectType: selections.habitationType || "", // API compat
        ownershipStatus: selections.ownershipStatus || "",
        insulationStatus: selections.insulationStatus || "",
        currentInsulation: selections.insulationStatus || "", // API compat
        address: validAddress,
        timeline: timeline,
        contactTime: timeline, // API compat
      },
      utmParams,
      eventId,
    }

    try {
      if (OTP_ENABLED) {
        // Defer the submission until OTP is verified; stash the payload
        // so /soumission-rapide/verifier-telephone can POST it with the token.
        sessionStorage.setItem("pending-lead", JSON.stringify(leadPayload))
      } else {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(leadPayload),
        })
        if (!res.ok) throw new Error(`leads api ${res.status}`)
      }

      // Meta Pixel — Lead event (fire client-side regardless of when the
      // API call happens; final dedup via server-side eventId).
      if (typeof window.fbq === "function") {
        window.fbq("track", "Lead", {
          currency: "CAD",
          content_name: "isolation-soumission-rapide",
          ...(utmParams.utm_source && { utm_source: utmParams.utm_source }),
          ...(utmParams.utm_campaign && { utm_campaign: utmParams.utm_campaign }),
          ...(utmParams.utm_medium && { utm_medium: utmParams.utm_medium }),
          ...(utmParams.utm_content && { utm_content: utmParams.utm_content }),
        }, { eventID: eventId })
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
          habitationType: selections.habitationType,
          address: validAddress,
          timeline,
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
          habitationType: selections.habitationType,
          address: validAddress,
          timeline,
        })
      )
      router.push(OTP_ENABLED ? "/soumission-rapide/verifier-telephone" : "/soumission-rapide/merci")
    } finally {
      setIsSubmittingLead(false)
    }
  }

  // Q4 address shows 75% (3/4 done), lead form fills to 100%
  const progressPercent = showLeadForm ? 100 : Math.min((currentStep + 1) * 25, 75)

  return (
    <div className="min-h-screen bg-[#FFFFF6] flex flex-col items-center" style={{ fontFamily: "'Source Serif Pro', Georgia, serif" }}>

      {/* Header */}
      <div className="w-full px-4 lg:px-[60px] py-4">
        <Link href="/" className="flex items-center gap-3">
          <img src="/images/logo-icon.svg" alt="" className="h-[48px] md:h-[62px] w-auto" />
          <div className="font-bold text-[#002042] leading-[0.9] tracking-[-0.04em] text-[18px] md:text-[26px]" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>
            <p>Soumission</p>
            <p>Confort</p>
          </div>
        </Link>
      </div>

      {/* Main content */}
      <div className="flex-1 w-full max-w-[700px] px-4 pb-20 flex flex-col gap-[32px] items-center">

        {/* "Question X/4" badge */}
        {!showLeadForm && (
          <div className="bg-[#aedee5] flex gap-[4px] items-center justify-center px-[16px] py-[10px] rounded-full shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
            <p className="font-bold text-[20px] text-[#002042] text-center tracking-[-0.8px] leading-[1.2]" style={{ fontFamily: "'Source Serif Pro', serif" }}>
              Question {currentStep + 1}/{STEPS_TOTAL}
            </p>
            <img src="/images/icon-question-badge.svg" alt="" className="w-[24px] h-[24px]" />
          </div>
        )}

        {/* Progress bar */}
        <div className="w-full h-[16px] bg-[#eef5fc] rounded-[100px] relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-[100px] transition-[width] duration-700 ease-in-out"
            style={{ width: `${progressPercent}%`, background: "linear-gradient(2.57deg, #AEDEE5 0%, #b9e15c 99.27%)" }}
          />
        </div>

        {/* ── Option steps ── */}
        {!showLeadForm && (
          <div className="bg-white border-4 border-[#aedee5] rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-[32px] w-full flex flex-col gap-[24px]">

            {/* Title + subtitle */}
            <div className="flex flex-col gap-[16px] items-start w-full text-[#002042] tracking-[-0.72px] leading-[1.2]">
              <h2 className="font-bold text-[24px] w-full" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>
                {STEP_CONFIG[currentStep].title}
              </h2>
              <p className="text-[18px] w-full" style={{ fontFamily: "'Source Serif Pro', serif" }}>
                {STEP_CONFIG[currentStep].subtitle}
              </p>
            </div>

            {/* Options grid (Q1–Q3) */}
            {STEP_CONFIG[currentStep].type === "options" && (
              <div className="flex flex-wrap gap-[16px] items-start w-full">
                {STEP_CONFIG[currentStep].options.map((opt) => {
                  const isSelected = selections[STEP_CONFIG[currentStep].key] === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleSelect(STEP_CONFIG[currentStep].key, opt.value)}
                      className={`flex flex-col items-center justify-center gap-[12px] flex-[1_0_0] min-w-[160px] p-[16px] rounded-[20px] border transition-all ${
                        isSelected
                          ? "border-2 border-[#b9e15c] bg-[#f4fce4]"
                          : "border border-[#aedee5] bg-white hover:border-[#b9e15c]/60"
                      }`}
                    >
                      {opt.icon && (
                        <img src={opt.icon} alt="" style={{ width: STEP_CONFIG[currentStep].iconSize, height: STEP_CONFIG[currentStep].iconSize }} className="object-contain" />
                      )}
                      <p className="text-[#002042] tracking-[-0.56px] leading-[1.2] text-center" style={{ fontFamily: "'Source Serif Pro', serif", fontSize: STEP_CONFIG[currentStep].labelSize }}>
                        {opt.label}
                      </p>
                      {opt.sub && (
                        <p className="text-[12px] text-[#375371] leading-[1.2] text-center" style={{ fontFamily: "'Source Serif Pro', serif" }}>
                          {opt.sub}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Address input with autocomplete (Q4) */}
            {STEP_CONFIG[currentStep].type === "address" && (
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
                    placeholder="Entrez votre adresse"
                    className="flex-1 bg-transparent outline-none text-[#002042] text-[16px] tracking-[-0.64px] leading-none placeholder:text-[#6c6c6c]"
                    style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 500 }}
                  />
                  {validAddress && (
                    <CheckCircle className="w-[20px] h-[20px] shrink-0 text-[#b9e15c]" />
                  )}
                </div>
                {/* Autocomplete dropdown */}
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
                          <p className="font-medium text-[#002042] text-[14px] truncate" style={{ fontFamily: "'Source Serif Pro', serif" }}>{prediction.main_text}</p>
                          {prediction.secondary_text && (
                            <p className="text-[12px] text-[#375371] truncate" style={{ fontFamily: "'Source Serif Pro', serif" }}>{prediction.secondary_text}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between w-full">
              <button
                onClick={() => {
                  if (showLeadForm) setShowLeadForm(false)
                  else if (currentStep > 0) setCurrentStep((p) => p - 1)
                  else router.back()
                }}
                className="flex items-center gap-[10px] h-[56px] py-[16px] text-[#375371] hover:text-[#002042] transition-colors"
              >
                <ArrowLeft className="w-[24px] h-[24px]" />
                <span className="font-bold text-[18px]" style={{ fontFamily: "'Source Serif Pro', serif" }}>Précédent</span>
              </button>

              {STEP_CONFIG[currentStep].type === "address" && (
                <button
                  onClick={handleAddressNext}
                  disabled={!validAddress}
                  className="bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-bold text-[18px] h-[56px] px-[32px] rounded-full shadow-[-2px_4px_0px_0px_#002042] hover:shadow-[-1px_2px_0px_0px_#002042] hover:translate-y-[1px] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
                  style={{ fontFamily: "'Source Serif Pro', serif" }}
                >
                  Suivant
                </button>
              )}
            </div>

          </div>
        )}

          {/* ── Inline lead form ── */}
          {showLeadForm && (
            <div className="bg-white border-4 border-[#aedee5] rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-[32px] w-full flex flex-col gap-[24px]">

              {/* Heading */}
              <div className="flex flex-col gap-[16px] items-center text-center w-full">
                <h2
                  className="font-bold text-[24px] text-[#002042] tracking-[-0.72px] leading-[1.2] w-full"
                  style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
                >
                  Recevez jusqu'à 3 soumissions d'entrepreneurs certifiés
                </h2>
                <p className="text-[18px] text-[#375371] leading-[1.2] tracking-[-0.72px] w-full">
                  Entrez vos coordonnées pour recevoir vos soumissions et discuter de votre projet.
                </p>
              </div>

              {/* DEV ONLY — autofill button */}
              {process.env.NODE_ENV === "development" && (
                <button
                  type="button"
                  onClick={() => setFormData({
                    firstName: "Jean",
                    lastName: "Tremblay",
                    email: "jean.tremblay@test.com",
                    phone: "5145551234",
                  })}
                  className="self-end text-[11px] font-mono bg-yellow-100 border border-yellow-400 text-yellow-800 px-2 py-1 rounded hover:bg-yellow-200 transition-colors"
                >
                  [DEV] Remplir le formulaire
                </button>
              )}

              {/* Form */}
              <form onSubmit={handleLeadSubmit} className="flex flex-col gap-[16px] w-full">

                {/* Name row */}
                <div className="flex gap-[16px] w-full">
                  <div className="flex flex-col gap-[4px] flex-1 min-w-0">
                    <label htmlFor="firstName" className="text-[14px] text-[#375371] leading-[1.2] tracking-[-0.56px]">
                      Votre prénom*
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                      disabled={isSubmittingLead}
                      className="w-full bg-[#f6f8fb] border border-[#dbe0ec] rounded-[10px] h-[56px] px-[16px] text-[#002042] text-[16px] outline-none focus:border-[#aedee5] transition-colors placeholder:text-[#6c6c6c]"
                      style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 500 }}
                      placeholder="Jean"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-[4px] flex-1 min-w-0">
                    <label htmlFor="lastName" className="text-[14px] text-[#375371] leading-[1.2] tracking-[-0.56px]">
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
                      placeholder="Tremblay"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-[4px] w-full">
                  <label htmlFor="email" className="text-[14px] text-[#375371] leading-[1.2] tracking-[-0.56px]">
                    Adresse courriel*
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    disabled={isSubmittingLead}
                    className="w-full bg-[#f6f8fb] border border-[#dbe0ec] rounded-[10px] h-[56px] px-[16px] text-[#002042] text-[16px] outline-none focus:border-[#aedee5] transition-colors placeholder:text-[#6c6c6c]"
                    style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 500 }}
                    placeholder="jean@exemple.com"
                    required
                  />
                </div>

                <div className="flex flex-col gap-[4px] w-full">
                  <label htmlFor="phone" className="text-[14px] text-[#375371] leading-[1.2] tracking-[-0.56px]">
                    Numéro de téléphone*
                  </label>
                  <PhoneInput
                    id="phone"
                    value={formData.phone}
                    onChange={(value) => setFormData((prev) => ({ ...prev, phone: value }))}
                    disabled={isSubmittingLead}
                    inputClassName="w-full bg-[#f6f8fb] border border-[#dbe0ec] rounded-[10px] h-[56px] px-[16px] text-[#002042] text-[16px] outline-none focus:border-[#aedee5] transition-colors placeholder:text-[#6c6c6c]"
                    style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 500 }}
                    placeholder="(514) 555-5555"
                    required
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!isFormValid() || isSubmittingLead}
                  className="w-full h-[56px] bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-bold text-[18px] rounded-full px-[32px] shadow-[-2px_4px_0_0_#002042] hover:shadow-[-1px_2px_0_0_#002042] hover:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
                  style={{ fontFamily: "'Source Serif Pro', serif" }}
                >
                  {isSubmittingLead ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Envoi en cours...
                    </span>
                  ) : (
                    "Obtenir mes 3 soumissions"
                  )}
                </button>
              </form>

              {/* Trust badges */}
              <div className="flex flex-wrap justify-center gap-x-[24px] gap-y-[8px]">
                {["Gratuit et sans obligation", "Entrepreneurs certifiés RBQ", "Soumissions en 48h"].map((label) => (
                  <div key={label} className="flex items-center gap-[6px]">
                    <img src="/images/icon-check-green.svg" alt="" className="w-[24px] h-[24px] shrink-0" />
                    <span className="text-[18px] text-[#10002c] leading-[1.2] tracking-[-0.72px]">{label}</span>
                  </div>
                ))}
              </div>

              {/* "Que se passe-t-il ensuite?" */}
              <div className="bg-[#eef5fc] rounded-[20px] p-[16px] flex flex-col gap-[16px] w-full">
                <p className="text-[14px] font-semibold text-[#002042] text-center leading-[1.2] tracking-[-0.56px]">
                  Que se passe-t-il ensuite ?
                </p>
                <div className="flex flex-col sm:flex-row gap-[12px]">
                  {[
                    { title: "1. Nous lançons la recherche", desc: "Notre équipe analyse votre projet et lance la recherche dans notre réseau d'entrepreneurs certifiés près de chez vous." },
                    { title: "2. Nous discutons avec les entrepreneurs", desc: "Nous validons avec eux les détails de votre projet pour trouver les entrepreneurs les plus pertinents." },
                    { title: "3. Vous recevez jusqu'à 3 soumissions", desc: "Nous vous faisons parvenir jusqu'à 3 soumissions d'entrepreneurs prêts à prendre en charge votre projet." },
                  ].map((step) => (
                    <div key={step.title} className="bg-white border border-[#aedee5] rounded-[20px] p-[16px] flex-1 flex flex-col gap-[16px]">
                      <p className="font-semibold text-[14px] text-[#10002c] leading-[1.2] tracking-[-0.56px]">{step.title}</p>
                      <p className="text-[14px] text-[#375371] leading-[1.2] tracking-[-0.56px]">{step.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

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
