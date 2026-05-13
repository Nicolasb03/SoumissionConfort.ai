"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AddressInput } from "@/components/address-input"
import { HowItWorks } from "@/components/how-it-works"
import { ReviewsSection } from "@/components/reviews-section"
import { getCurrentUTMParameters, type UTMParameters } from "@/lib/utm-utils"
import { track } from "@vercel/analytics"
import { OTP_ENABLED } from "@/lib/feature-flags"
import { PhoneInput } from "@/components/phone-input"
import { isValidQuebecPhone } from "@/lib/phone"
import {
  Home,
  Building2,
  Zap,
  Flame,
  HelpCircle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Star,
  Users,
  Award,
  Shield,
  Clock,
  Search,
  Layers,
  ThermometerSnowflake,
  Loader2,
  Phone,
  Mail,
  User,
  Calculator,
  Leaf,
  MessageCircle,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FunnelStep = "hero" | "q1" | "q2" | "q3" | "q4" | "lead" | "result"

interface Answers {
  owner: string        // "oui" | "non"
  buildingType: string // "unifamiliale" | "jumelee" | "condo" | "autre"
  heating: string      // "oui" | "non" | "nsp"
  insulation: string   // "aucune" | "partielle" | "ancienne" | "recente" | "nsp"
}

// ---------------------------------------------------------------------------
// Eligibility logic
// ---------------------------------------------------------------------------

function computeEligibility(answers: Answers) {
  const criteria = [
    {
      label: "Propriétaire occupant de la résidence",
      met: answers.owner === "oui",
    },
    {
      label: "Maison unifamiliale, jumelée ou en rangée",
      met: ["unifamiliale", "jumelee"].includes(answers.buildingType),
    },
    {
      label: "Chauffage principal à l'électricité (Hydro-Québec)",
      met: answers.heating === "oui" || answers.heating === "nsp",
    },
    {
      label: "Isolation de l'entretoit à améliorer",
      met: answers.insulation !== "recente",
    },
  ]

  const eligible = criteria.every((c) => c.met)
  return { eligible, criteria }
}

// ---------------------------------------------------------------------------
// Reusable option card
// ---------------------------------------------------------------------------

function OptionCard({
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ElementType
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group flex items-center gap-4 w-full p-5 rounded-2xl border-2 text-left
        transition-all duration-200 cursor-pointer
        ${
          selected
            ? "border-green-500 bg-green-50 shadow-lg scale-[1.02]"
            : "border-gray-200 bg-white hover:border-green-300 hover:shadow-md hover:scale-[1.01]"
        }
      `}
    >
      <div
        className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
          selected
            ? "bg-green-500 text-white"
            : "bg-gray-100 text-gray-600 group-hover:bg-green-100 group-hover:text-green-600"
        }`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-base md:text-lg font-semibold text-gray-900">{label}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function SubventionsPage() {
  const router = useRouter()

  // Funnel state
  const [step, setStep] = useState<FunnelStep>("hero")
  const [address, setAddress] = useState("")
  const [answers, setAnswers] = useState<Answers>({
    owner: "",
    buildingType: "",
    heating: "",
    insulation: "",
  })
  const [isSubmittingLead, setIsSubmittingLead] = useState(false)
  const [utmParams, setUtmParams] = useState<UTMParameters>({})
  const [leadForm, setLeadForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  })
  const [phoneError, setPhoneError] = useState<string | null>(null)

  // Capture UTMs on mount
  useEffect(() => {
    const params = getCurrentUTMParameters()
    if (Object.keys(params).length > 0) setUtmParams(params)
  }, [])

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior })
  }, [step])

  // -----------------------------------------------------------------------
  // Navigation helpers
  // -----------------------------------------------------------------------

  const stepOrder: FunnelStep[] = ["hero", "q1", "q2", "q3", "q4", "lead", "result"]

  const goBack = useCallback(() => {
    const idx = stepOrder.indexOf(step)
    if (idx > 0) setStep(stepOrder[idx - 1])
  }, [step])

  const progress = (() => {
    const idx = stepOrder.indexOf(step)
    if (idx <= 0) return 0
    // hero=0%, q1=20%, q2=40%, q3=60%, q4=80%, lead=90%, result=100%
    const map: Record<FunnelStep, number> = {
      hero: 0,
      q1: 20,
      q2: 40,
      q3: 60,
      q4: 80,
      lead: 90,
      result: 100,
    }
    return map[step]
  })()

  // -----------------------------------------------------------------------
  // Auto-advance helpers for questions
  // -----------------------------------------------------------------------

  const selectAnswer = (key: keyof Answers, value: string, nextStep: FunnelStep) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
    track("Subvention Question Answered", { question: key, answer: value })
    // Small delay for visual feedback before advancing
    setTimeout(() => setStep(nextStep), 250)
  }

  // -----------------------------------------------------------------------
  // Lead submission
  // -----------------------------------------------------------------------

  const isLeadFormValid = () => {
    return Boolean(
      leadForm.firstName.trim() &&
      leadForm.lastName.trim() &&
      leadForm.email.trim() &&
      isValidQuebecPhone(leadForm.phone)
    )
  }

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidQuebecPhone(leadForm.phone)) {
      setPhoneError("Veuillez entrer un numéro de téléphone québécois valide (ex: 514-555-1234).")
      return
    }
    setPhoneError(null)
    if (!isLeadFormValid()) return

    setIsSubmittingLead(true)

    const { eligible, criteria } = computeEligibility(answers)
    const eventId = crypto.randomUUID()

    try {
      // Fire Meta Pixel (client-side) with shared eventId for dedup
      if (typeof window !== "undefined" && (window as any).fbq) {
        ;(window as any).fbq(
          "track",
          "Lead",
          { service_type: "subvention" },
          { eventID: eventId }
        )
      }

      track("Lead Submitted", {
        firstName: leadForm.firstName,
        email: leadForm.email,
      })

      const clientLeadId = `LEAD${Date.now()}${Math.random().toString(36).substring(2, 10)}`
      const leadPayload = {
        ...leadForm,
        leadId: clientLeadId,
        leadType: "subvention",
        address,
        subventionAnswers: answers,
        eligible,
        eligibilityCriteria: criteria,
        utmParams,
        eventId,
      }

      if (OTP_ENABLED) {
        // Defer /api/leads until OTP success on /verifier-telephone, and
        // route the user there IMMEDIATELY. Previous behaviour showed the
        // eligibility result step with a CTA to OTP — but a user who
        // bounced after seeing the result would silently lose their lead
        // because no /api/leads call ever fired. Forcing the OTP step
        // closes that gap. The result page still displays after OTP
        // success (see /success), so the user still sees their outcome.
        sessionStorage.setItem("pending-lead", JSON.stringify(leadPayload))
        sessionStorage.setItem(
          "otp-verify",
          JSON.stringify({ phone: leadForm.phone, redirectTo: "/success" }),
        )
        track("Subvention Lead Captured", { eligible })
        router.push("/verifier-telephone")
        return
      }

      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadPayload),
      })

      track("Subvention Lead Captured", { eligible })
    } catch (error) {
      console.error("Error submitting subvention lead:", error)
    } finally {
      setIsSubmittingLead(false)
      setStep("result")
    }
  }

  // When Q4 is answered, go to inline lead capture
  const handleQ4Answer = (value: string) => {
    setAnswers((prev) => ({ ...prev, insulation: value }))
    track("Subvention Question Answered", { question: "insulation", answer: value })
    setTimeout(() => {
      setStep("lead")
    }, 250)
  }

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const isQuestionStep = ["q1", "q2", "q3", "q4"].includes(step)

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#fffff6]">
      {/* Header — always visible */}
      <header className="sticky top-0 z-50 bg-[#fffff6] border-b border-[#e8e8e0]">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between max-w-7xl">
          <a href="/" className="flex items-center gap-3">
            <img src="/images/logo-icon.svg" alt="" className="h-7 md:h-[48px] w-auto" />
            <div className="font-heading font-bold text-[#002042] leading-[0.9] tracking-[-0.04em] text-[18px] md:text-[26px] whitespace-nowrap">
              <p>Soumission</p>
              <p>Confort</p>
            </div>
          </a>
          {step !== "hero" && (
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Retour</span>
            </button>
          )}
        </div>

        {/* Progress bar */}
        {step !== "hero" && (
          <div className="h-1 bg-gray-100">
            <div
              className="h-full bg-[#b9e15c] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </header>

      {/* ================================================================= */}
      {/* STEP: HERO                                                        */}
      {/* ================================================================= */}
      {step === "hero" && (
        <>
          <section className="relative bg-gray-900 overflow-hidden min-h-[600px] md:min-h-[700px] flex items-center">
            {/* Background */}
            <div className="absolute inset-0 z-0">
              <img
                src="/images/Soumissioconfort-hero.jpeg"
                alt="Maison avec isolation"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50" />
            </div>

            {/* Content */}
            <div className="container mx-auto px-4 sm:px-6 max-w-4xl py-16 sm:py-20 relative z-10">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white text-center mb-4 leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                Le gouvernement vous rembourse{" "}
                <span className="text-[#EEED32]">1&nbsp;500$</span> pour réduire votre
                facture Hydro
              </h1>

              <p className="text-lg sm:text-xl text-gray-200 text-center mb-8 md:mb-12 max-w-2xl mx-auto">
                Seulement certaines maisons qualifient. Découvrez si vous êtes admissible en
                répondant à 4 questions simples.
              </p>

              {/* Form Card */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xl max-w-2xl mx-auto">
                <div className="space-y-4">
                  <AddressInput
                    onAddressSelect={(selectedAddress) => setAddress(selectedAddress)}
                    onAnalyze={() => {
                      if (address.trim()) {
                        track("Subvention Address Entered", { address: address.trim() })
                        setStep("q1")
                      }
                    }}
                    className="w-full"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (address.trim()) {
                        track("Subvention Address Entered", { address: address.trim() })
                        setStep("q1")
                      }
                    }}
                    disabled={!address.trim()}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 text-base md:text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Search className="w-5 h-5" />
                      <span>Vérifier mon admissibilité maintenant</span>
                    </div>
                  </button>

                  {/* Trust features */}
                  <div className="flex items-center justify-center flex-wrap gap-4 pt-2 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>100% Gratuit</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Shield className="w-4 h-4 text-green-600" />
                      <span>Sans engagement</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4 text-green-600" />
                      <span>Résultat en 30 secondes</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subsidy logos */}
              <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
                <div className="flex items-center bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
                  <img src="/hydro-quebec.svg" alt="Hydro-Québec" className="h-6 w-auto" />
                </div>
                <div className="flex items-center bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
                  <img src="/Rénoclimat.jpg" alt="Rénoclimat" className="h-6 w-auto" />
                </div>
                <div className="flex items-center bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
                  <img
                    src="/Gouvernement_du_Canada_logo.svg"
                    alt="Gouvernement du Canada"
                    className="h-6 w-auto"
                  />
                </div>
              </div>

              {/* Social proof */}
              <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-white">
                <div className="flex items-center space-x-2">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  <span className="font-bold text-lg">4.8/5</span>
                  <span className="text-gray-300 text-sm">(800+ avis)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-teal-400" />
                  <span className="font-semibold">150+ Entrepreneurs certifiés</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-teal-400" />
                  <span className="font-semibold">Service #1 au Québec</span>
                </div>
              </div>
            </div>
          </section>

          {/* Below-the-fold sections */}
          <HowItWorks />
          <ReviewsSection />
        </>
      )}

      {/* ================================================================= */}
      {/* QUESTION STEPS — Full-screen, centered, RoofHero style            */}
      {/* ================================================================= */}

      {isQuestionStep && (
        <main className="flex-1 flex items-center justify-center min-h-[calc(100vh-120px)] px-4 py-12">
          <div className="w-full max-w-xl mx-auto">
            {/* Q1: Propriétaire */}
            {step === "q1" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center mb-8">
                  <span className="inline-block bg-green-100 text-green-700 text-sm font-semibold px-3 py-1 rounded-full mb-4">
                    Question 1 sur 4
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                    Êtes-vous propriétaire de cette résidence?
                  </h2>
                  <p className="text-gray-500 mt-2">
                    La subvention s'adresse aux propriétaires occupants.
                  </p>
                </div>
                <div className="space-y-3">
                  <OptionCard
                    icon={CheckCircle}
                    label="Oui, je suis propriétaire"
                    selected={answers.owner === "oui"}
                    onClick={() => selectAnswer("owner", "oui", "q2")}
                  />
                  <OptionCard
                    icon={XCircle}
                    label="Non, je suis locataire"
                    selected={answers.owner === "non"}
                    onClick={() => selectAnswer("owner", "non", "q2")}
                  />
                </div>
              </div>
            )}

            {/* Q2: Type de bâtiment */}
            {step === "q2" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center mb-8">
                  <span className="inline-block bg-green-100 text-green-700 text-sm font-semibold px-3 py-1 rounded-full mb-4">
                    Question 2 sur 4
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                    Quel type de bâtiment habitez-vous?
                  </h2>
                  <p className="text-gray-500 mt-2">
                    Seules les maisons unifamiliales, jumelées et en rangée sont admissibles.
                  </p>
                </div>
                <div className="space-y-3">
                  <OptionCard
                    icon={Home}
                    label="Maison unifamiliale"
                    selected={answers.buildingType === "unifamiliale"}
                    onClick={() => selectAnswer("buildingType", "unifamiliale", "q3")}
                  />
                  <OptionCard
                    icon={Building2}
                    label="Jumelée ou en rangée"
                    selected={answers.buildingType === "jumelee"}
                    onClick={() => selectAnswer("buildingType", "jumelee", "q3")}
                  />
                  <OptionCard
                    icon={Building2}
                    label="Condo / Appartement"
                    selected={answers.buildingType === "condo"}
                    onClick={() => selectAnswer("buildingType", "condo", "q3")}
                  />
                  <OptionCard
                    icon={HelpCircle}
                    label="Autre"
                    selected={answers.buildingType === "autre"}
                    onClick={() => selectAnswer("buildingType", "autre", "q3")}
                  />
                </div>
              </div>
            )}

            {/* Q3: Chauffage */}
            {step === "q3" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center mb-8">
                  <span className="inline-block bg-green-100 text-green-700 text-sm font-semibold px-3 py-1 rounded-full mb-4">
                    Question 3 sur 4
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                    Votre maison est-elle chauffée principalement à l'électricité?
                  </h2>
                  <p className="text-gray-500 mt-2">
                    Le programme cible les maisons chauffées à l'électricité (Hydro-Québec).
                  </p>
                </div>
                <div className="space-y-3">
                  <OptionCard
                    icon={Zap}
                    label="Oui, électricité (Hydro-Québec)"
                    selected={answers.heating === "oui"}
                    onClick={() => selectAnswer("heating", "oui", "q4")}
                  />
                  <OptionCard
                    icon={Flame}
                    label="Non (gaz, mazout, autre)"
                    selected={answers.heating === "non"}
                    onClick={() => selectAnswer("heating", "non", "q4")}
                  />
                  <OptionCard
                    icon={HelpCircle}
                    label="Je ne sais pas"
                    selected={answers.heating === "nsp"}
                    onClick={() => selectAnswer("heating", "nsp", "q4")}
                  />
                </div>
              </div>
            )}

            {/* Q4: Isolation */}
            {step === "q4" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center mb-8">
                  <span className="inline-block bg-green-100 text-green-700 text-sm font-semibold px-3 py-1 rounded-full mb-4">
                    Question 4 sur 4
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                    Quel est l'état actuel de l'isolation de votre entretoit?
                  </h2>
                  <p className="text-gray-500 mt-2">
                    L'isolation doit atteindre au moins R-50 pour être admissible à la subvention.
                  </p>
                </div>
                <div className="space-y-3">
                  <OptionCard
                    icon={Layers}
                    label="Aucune ou très peu d'isolation"
                    selected={answers.insulation === "aucune"}
                    onClick={() => handleQ4Answer("aucune")}
                  />
                  <OptionCard
                    icon={Layers}
                    label="Isolation partielle"
                    selected={answers.insulation === "partielle"}
                    onClick={() => handleQ4Answer("partielle")}
                  />
                  <OptionCard
                    icon={Layers}
                    label="Isolation complète mais ancienne"
                    selected={answers.insulation === "ancienne"}
                    onClick={() => handleQ4Answer("ancienne")}
                  />
                  <OptionCard
                    icon={ThermometerSnowflake}
                    label="Isolation récente (déjà R-50+)"
                    selected={answers.insulation === "recente"}
                    onClick={() => handleQ4Answer("recente")}
                  />
                  <OptionCard
                    icon={HelpCircle}
                    label="Je ne sais pas"
                    selected={answers.insulation === "nsp"}
                    onClick={() => handleQ4Answer("nsp")}
                  />
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ================================================================= */}
      {/* STEP: LEAD CAPTURE (inline form, subventions-styled)              */}
      {/* ================================================================= */}
      {step === "lead" && (
        <main className="flex-1 flex items-center justify-center min-h-[calc(100vh-120px)] px-4 py-12">
          <div className="w-full max-w-lg mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Plus qu'une étape pour connaître votre admissibilité
              </h2>
              <p className="text-gray-500">
                Entrez vos coordonnées pour recevoir votre résultat d'admissibilité à la subvention.
              </p>
            </div>

            <form onSubmit={handleLeadSubmit} className="bg-white rounded-2xl border-2 border-gray-100 shadow-xl p-6 md:p-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="firstName"
                      type="text"
                      value={leadForm.firstName}
                      onChange={(e) => setLeadForm((p) => ({ ...p, firstName: e.target.value }))}
                      disabled={isSubmittingLead}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-0 focus:outline-none transition-colors"
                      placeholder="Jean"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Nom de famille *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="lastName"
                      type="text"
                      value={leadForm.lastName}
                      onChange={(e) => setLeadForm((p) => ({ ...p, lastName: e.target.value }))}
                      disabled={isSubmittingLead}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-0 focus:outline-none transition-colors"
                      placeholder="Tremblay"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Adresse courriel *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm((p) => ({ ...p, email: e.target.value }))}
                    disabled={isSubmittingLead}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-0 focus:outline-none transition-colors"
                    placeholder="jean@exemple.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Numéro de téléphone *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                  <PhoneInput
                    id="phone"
                    value={leadForm.phone}
                    onChange={(value) => setLeadForm((p) => ({ ...p, phone: value }))}
                    disabled={isSubmittingLead}
                    inputClassName="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-0 focus:outline-none transition-colors"
                    placeholder="(514) 123-4567"
                    required
                  />
                </div>
                {phoneError && (
                  <p className="text-sm text-red-600 mt-1">{phoneError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={!isLeadFormValid() || isSubmittingLead}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-full text-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 mt-4"
              >
                {isSubmittingLead ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Vérification en cours...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Search className="w-5 h-5" />
                    <span>Découvrir mon admissibilité</span>
                  </div>
                )}
              </button>

              <div className="flex items-center justify-center flex-wrap gap-4 pt-2 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <span>100% Sécurisé</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Résultat instantané</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  <span>Gratuit</span>
                </div>
              </div>
            </form>
          </div>
        </main>
      )}

      {/* ================================================================= */}
      {/* STEP: RESULT                                                      */}
      {/* ================================================================= */}
      {step === "result" && (
        <main className="flex-1 flex items-center justify-center min-h-[calc(100vh-120px)] px-4 py-12">
          <div className="w-full max-w-2xl mx-auto">
            {(() => {
              const { eligible, criteria } = computeEligibility(answers)

              if (eligible) {
                return (
                  <div className="space-y-6 animate-in fade-in duration-500">
                    {/* Success card */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-3xl p-8 md:p-12 text-center shadow-xl">
                      <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <CheckCircle className="w-10 h-10 text-white" />
                      </div>
                      <h2 className="text-2xl md:text-4xl font-bold text-gray-900 mb-4">
                        Bonne nouvelle!
                      </h2>
                      <p className="text-lg md:text-xl text-gray-700 mb-2">
                        Votre maison est <strong className="text-green-700">admissible</strong> à
                        la subvention de
                      </p>
                      <p className="text-5xl md:text-6xl font-bold text-green-600 mb-6">
                        1&nbsp;500$
                      </p>

                      {/* Criteria checklist */}
                      <div className="bg-white rounded-2xl p-6 text-left space-y-3 mb-8">
                        {criteria.map((c, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                            <span className="text-gray-700">{c.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTA 1: Agent éco-énergétique */}
                    <button
                      type="button"
                      onClick={() => router.push("/success")}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-5 px-8 rounded-2xl text-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02]"
                    >
                      <div className="flex items-center justify-center gap-3">
                        <Leaf className="w-6 h-6" />
                        <div className="text-left">
                          <span className="block">Parler à un agent en optimisation éco-énergétique</span>
                          <span className="block text-sm font-normal text-green-200">Obtenez de l'aide pour vos démarches de subvention</span>
                        </div>
                        <ArrowRight className="w-5 h-5 flex-shrink-0" />
                      </div>
                    </button>

                    {/* CTA 2: Estimation rapide */}
                    <a
                      href="/"
                      className="block w-full bg-white hover:bg-gray-50 text-gray-900 font-bold py-5 px-8 rounded-2xl text-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] border-2 border-gray-200"
                    >
                      <div className="flex items-center justify-center gap-3">
                        <Calculator className="w-6 h-6 text-blue-600" />
                        <div className="text-left">
                          <span className="block">Combien coûteraient les travaux?</span>
                          <span className="block text-sm font-normal text-gray-500">Estimez le coût en moins de 60 secondes avec notre outil gratuit</span>
                        </div>
                        <ArrowRight className="w-5 h-5 flex-shrink-0 text-gray-400" />
                      </div>
                    </a>

                    <p className="text-sm text-gray-500 text-center">
                      100% gratuit • Sans engagement • Un expert vous rappelle sous 24h
                    </p>
                  </div>
                )
              }

              // Not eligible
              return (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-3xl p-8 md:p-12 text-center shadow-xl">
                    <div className="w-20 h-20 bg-orange-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <XCircle className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                      Votre maison ne semble pas admissible à cette subvention
                    </h2>

                    <p className="text-gray-600 mb-6">
                      D'après vos réponses, les critères suivants ne sont pas remplis :
                    </p>

                    {/* Criteria checklist */}
                    <div className="bg-white rounded-2xl p-6 text-left space-y-3 mb-6">
                      {criteria.map((c, i) => (
                        <div key={i} className="flex items-center gap-3">
                          {c.met ? (
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                          )}
                          <span className={c.met ? "text-gray-700" : "text-red-700 font-medium"}>
                            {c.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="text-gray-600 mb-4">
                      D'autres programmes pourraient s'appliquer à votre situation.
                    </p>
                  </div>

                  {/* CTA: Contact agent */}
                  <button
                    type="button"
                    onClick={() => router.push("/success")}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-5 px-8 rounded-2xl text-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02]"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <MessageCircle className="w-6 h-6" />
                      <div className="text-left">
                        <span className="block">Être contacté pour explorer mes options</span>
                        <span className="block text-sm font-normal text-orange-200">Un agent pourra vérifier si d'autres subventions s'appliquent</span>
                      </div>
                      <ArrowRight className="w-5 h-5 flex-shrink-0" />
                    </div>
                  </button>

                  {/* CTA 2: Estimation rapide */}
                  <a
                    href="/"
                    className="block w-full bg-white hover:bg-gray-50 text-gray-900 font-bold py-5 px-8 rounded-2xl text-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] border-2 border-gray-200"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <Calculator className="w-6 h-6 text-blue-600" />
                      <div className="text-left">
                        <span className="block">Combien coûteraient les travaux?</span>
                        <span className="block text-sm font-normal text-gray-500">Estimez le coût en moins de 60 secondes avec notre outil gratuit</span>
                      </div>
                      <ArrowRight className="w-5 h-5 flex-shrink-0 text-gray-400" />
                    </div>
                  </a>

                  <p className="text-sm text-gray-500 text-center">
                    100% gratuit • Sans engagement • Un expert vous rappelle sous 24h
                  </p>
                </div>
              )
            })()}
          </div>
        </main>
      )}
    </div>
  )
}
