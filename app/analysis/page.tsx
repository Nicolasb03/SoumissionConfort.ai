"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect, useMemo } from "react"
import { UserQuestionnaire } from "@/components/user-questionnaire-wizard"
import { InsulationResults } from "@/components/insulation-results"
import { LeadCaptureForm, type LeadData } from "@/components/lead-capture-form"
import { useLanguage } from "@/lib/language-context"
import { ArrowLeft, MapPin, Zap, Clock, CheckCircle, Pencil, Check } from 'lucide-react'
import Link from "next/link"
import type { V2Answers } from "@/lib/funnel-config"

type AnalysisStep = "loading" | "results" | "questionnaire" | "lead-capture" | "pricing"

export default function AnalysisPage() {
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const router = useRouter()

  // State declarations need to come before effects to avoid TDZ errors
  const [currentStep, setCurrentStep] = useState<AnalysisStep>("loading")
  const [roofData, setRoofData] = useState<any>(null)
  const [userAnswers, setUserAnswers] = useState<V2Answers | null>(null)
  const [leadData, setLeadData] = useState<LeadData | null>(null)
  const [, setPricingData] = useState<any>(null)
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [isEditingArea, setIsEditingArea] = useState(false)
  const [areaInputValue, setAreaInputValue] = useState("")

  const confirmAreaEdit = () => {
    const val = parseInt(areaInputValue)
    if (val > 100) setRoofData((prev: any) => ({ ...prev, roofArea: val }))
    else setAreaInputValue(String(roofData?.roofArea || ""))
    setIsEditingArea(false)
  }

  // Ensure viewport resets to top on step change (especially when navigating to questionnaire/pricing pages)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
    }
  }, [currentStep])

  const address = useMemo(() => searchParams.get("address") || "", [searchParams])
  const dataParam = useMemo(() => searchParams.get("data"), [searchParams])

  useEffect(() => {
    // SSR guard
    if (typeof window === 'undefined') return
    // No address in URL → redirect home (P1-6 — prevents infinite spinner).
    if (!address) {
      router.push('/')
      return
    }
    if (hasAnalyzed) return

    const analyzeRoof = async () => {
      setHasAnalyzed(true)

      if (dataParam) {
        try {
          const parsedRoofData = JSON.parse(decodeURIComponent(dataParam))
          setRoofData({ ...parsedRoofData, address })
          setCurrentStep("questionnaire")
          return
        } catch (error) {
          console.error("Error parsing roof data from URL:", error)
        }
      }

      // Log the fetch attempt for debugging

      try {
        // Use absolute URL to avoid any routing issues
        const apiUrl = `${window.location.origin}/api/roof-analysis`
        
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ address }),
          // Add cache control to prevent stale responses
          cache: 'no-store'
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Server error" }))
          console.error("API Error Response:", response.status, errorData)
          throw new Error(errorData.error || `Server error: ${response.status}`)
        }

        const data = await response.json()
        setRoofData({ ...data.roofData, address })
        setCurrentStep("questionnaire")
      } catch (error) {
        console.error("Roof analysis error:", error)
        
        // Provide more specific error messages
        let errorMessage = "Unable to analyze this address. Please try a different address."
        if (error instanceof TypeError && error.message.includes("fetch")) {
          errorMessage = "Network error: Unable to connect to the server. Please refresh the page and try again."
          console.error("Network/CORS error - this may be a hydration issue")
        } else if (error instanceof Error) {
          errorMessage = error.message
        }
        
        setCurrentStep("questionnaire")
        setRoofData({
          address,
          error: errorMessage,
          roofArea: 1400,
          segments: 4,
          pitchComplexity: "moderate",
          buildingHeight: 25,
          obstacles: ["minimal obstacles"],
          accessDifficulty: "easy",
          roofShape: "moderate",
        })
      }
    }

    // Small delay to ensure client is fully mounted
    const timeoutId = setTimeout(() => {
      analyzeRoof()
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [address, dataParam, hasAnalyzed, router])

  const getStepProgress = () => {
    switch (currentStep) {
      case "loading":
        return 33
      case "questionnaire":
        return 50
      case "lead-capture":
        return 75
      case "pricing":
        return 100
      default:
        return 0
    }
  }

  const getStepInfo = () => {
    switch (currentStep) {
      case "loading":
        return { title: "Analyse de Votre Propriété", subtitle: "Traitement des données par IA", icon: Zap }
      case "results":
        return { title: "Analyse Complète", subtitle: "Consultez les détails de votre projet", icon: CheckCircle }
      case "questionnaire":
        return { title: "Détails du Projet", subtitle: "Parlez-nous de vos besoins", icon: Clock }
      case "lead-capture":
        return { title: "Connexion aux Entrepreneurs", subtitle: "Nous vous mettons en contact avec des professionnels", icon: CheckCircle }
      case "pricing":
        return { title: "Résultats de Prix", subtitle: "Votre estimation personnalisée", icon: CheckCircle }
      default:
        return { title: "Traitement", subtitle: "Veuillez patienter", icon: Clock }
    }
  }

  // V2 flow: wizard hands off answers only; pricing + API + OTP happen in
  // LeadCaptureForm. State machine: questionnaire → lead-capture → pricing.
  const handleQuestionnaireComplete = (answers: V2Answers) => {
    setUserAnswers(answers)
    setCurrentStep("lead-capture")
  }

  const handleLeadCaptureComplete = (pricing: any, captured: LeadData, _leadId: string) => {
    setPricingData(pricing)
    setLeadData(captured)
    setCurrentStep("pricing")
  }

  const stepInfo = getStepInfo()
  const StepIcon = stepInfo.icon

  return (
    <div className="min-h-screen bg-[#fffff6] overflow-x-hidden">
      {/* Header */}
      <header className="bg-[#fffff6] border-b border-[#e8e8e0] sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between max-w-7xl">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-[#375371]" />
            <div className="flex items-center gap-3">
              <img src="/images/logo-icon.svg" alt="" className="h-7 md:h-[48px] w-auto" />
              <div className="font-heading font-bold text-[#002042] leading-[0.9] tracking-[-0.04em] text-[18px] md:text-[26px] whitespace-nowrap">
                <p>Soumission</p>
                <p>Confort</p>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-3 min-w-0">
            {roofData && roofData.roofArea && currentStep !== "loading" && currentStep !== "questionnaire" && (
              <div className="flex items-center gap-1 font-serif-body text-sm text-[#375371]">
                <span className="font-semibold text-[#002042]">Superficie :</span>
                {isEditingArea ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={areaInputValue}
                      onChange={(e) => setAreaInputValue(e.target.value)}
                      onBlur={confirmAreaEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmAreaEdit()
                        if (e.key === 'Escape') { setAreaInputValue(String(roofData.roofArea)); setIsEditingArea(false) }
                      }}
                      className="w-20 text-sm font-semibold text-center border-2 border-[#aedee5] rounded px-2 py-1 focus:outline-none focus:border-[#002042]"
                      autoFocus
                    />
                    <span className="text-sm">pi²</span>
                    <button onClick={confirmAreaEdit} className="p-1 text-[#002042]" aria-label="Confirmer">
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAreaInputValue(String(roofData.roofArea)); setIsEditingArea(true) }}
                    className="flex items-center gap-1 font-bold text-[#002042] hover:opacity-70 transition-opacity"
                  >
                    {roofData.roofArea.toLocaleString('fr-CA')} pi²
                    <Pencil className="w-3 h-3 text-[#375371]" />
                  </button>
                )}
              </div>
            )}
            {address && currentStep !== "questionnaire" && (
              <div className="flex items-center gap-1.5 font-serif-body text-sm text-[#375371]">
                <MapPin className="w-3.5 h-3.5 text-[#002042] shrink-0" />
                <span className="truncate max-w-[120px] md:max-w-xs">{address}</span>
              </div>
            )}
            {currentStep !== "questionnaire" && (
              <div className="flex items-center gap-1.5 bg-[#aedee5]/30 border border-[#aedee5] rounded-full px-3 py-1">
                <StepIcon className="w-3 h-3 text-[#002042]" />
                <span className="font-serif-body font-semibold text-[#002042] text-xs hidden sm:inline">{stepInfo.title}</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar – hidden during questionnaire (it has its own) */}
        {currentStep !== "questionnaire" && (
        <div className="w-full bg-[#e8e8e0] h-1">
          <div
            className="bg-[#b9e15c] h-1 transition-all duration-500"
            style={{ width: `${getStepProgress()}%` }}
          />
        </div>
        )}
      </header>

      <main className="container mx-auto px-4 pt-2 pb-8 sm:py-8 overflow-x-hidden">
        {currentStep === "loading" && (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white border border-[#aedee5] rounded-[20px] shadow-md p-10 text-center">
              <div className="w-20 h-20 bg-[#aedee5]/40 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="w-10 h-10 border-4 border-[#aedee5] border-t-[#002042] rounded-full animate-spin"></div>
              </div>
              <h2 className="font-heading text-2xl font-bold text-[#10002c] mb-3">Analyse de votre propriété...</h2>
              <p className="font-serif-body text-[#375371] text-lg mb-8">Traitement des données par intelligence artificielle</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-8">
                <div className="flex items-center justify-center gap-2 text-[#002042] bg-[#fffff6] p-4 rounded-xl border border-[#e8e8e0]">
                  <CheckCircle className="w-5 h-5 text-[#b9e15c]" />
                  <span className="font-serif-body font-medium">Données récupérées</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-[#002042] bg-[#aedee5]/20 p-4 rounded-xl border border-[#aedee5]">
                  <div className="w-5 h-5 border-2 border-[#002042] border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-serif-body font-medium">Analyse de la structure</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-[#375371] bg-[#fffff6] p-4 rounded-xl border border-[#e8e8e0] opacity-50">
                  <Clock className="w-5 h-5" />
                  <span className="font-serif-body font-medium">Calcul de complexité</span>
                </div>
              </div>
              <p className="font-serif-body text-[#375371] text-sm">Cela prend généralement 30-60 secondes...</p>
            </div>
          </div>
        )}

        {currentStep === "questionnaire" && roofData && (
          <UserQuestionnaire roofData={roofData} onComplete={handleQuestionnaireComplete} />
        )}

        {currentStep === "lead-capture" && roofData && userAnswers && (
          <LeadCaptureForm
            roofData={roofData}
            v2Answers={userAnswers}
            onComplete={handleLeadCaptureComplete}
          />
        )}

        {currentStep === "pricing" && roofData && userAnswers && leadData && (
          <InsulationResults
            roofData={roofData}
            userAnswers={userAnswers}
            leadData={leadData}
            onComplete={() => router.push("/success")}
          />
        )}
      </main>
    </div>
  )
}
