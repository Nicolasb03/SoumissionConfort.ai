"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { LeadCapturePopup, type LeadData } from "@/components/lead-capture-popup"
import { OTP_ENABLED } from "@/lib/feature-flags"
import { AddressInput } from "@/components/address-input"
import { computeLeadEventId } from "@/lib/event-id"
import {
  Wind,
  Home,
  CheckCircle,
  ArrowRight,
  Loader2,
  TrendingDown,
  DollarSign,
  Zap,
  ThermometerSnowflake,
  Shield,
  Clock
} from "lucide-react"
import { track } from '@vercel/analytics'
import type { 
  GeometricData, 
  ThermalProfile, 
  HeatPumpRecommendation 
} from "@/lib/heatpump-calculator"
import { getCurrentUTMParameters, type UTMParameters } from "@/lib/utm-utils"
import {
  formatBTU,
  formatPrice,
  formatArea,
  formatPercentage,
  getThermalProfileDescription
} from "@/lib/heatpump-calculator"

type FunnelStep = 1 | 2 | 3 | 4 | 5 | 6

export default function ThermopompesPage() {
  const router = useRouter()
  
  // État du funnel
  const [currentStep, setCurrentStep] = useState<FunnelStep>(1)
  const [address, setAddress] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [city, setCity] = useState("")
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [province, setProvince] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  // Données collectées
  const [solarArea, setSolarArea] = useState<number>(0)
  const [geometric, setGeometric] = useState<Partial<GeometricData>>({})
  const [thermal, setThermal] = useState<Partial<ThermalProfile>>({})
  const [estimatedArea, setEstimatedArea] = useState<number>(0)
  const [finalArea, setFinalArea] = useState<number>(0)
  const [userCorrectedArea, setUserCorrectedArea] = useState<string>("")
  const [isEditingSurface, setIsEditingSurface] = useState(false)
  const [geometricQuestionStep, setGeometricQuestionStep] = useState(0)
  const [thermalQuestionStep, setThermalQuestionStep] = useState(0)
  
  // Résultats
  const [recommendation, setRecommendation] = useState<HeatPumpRecommendation | null>(null)
  const [showLeadCapture, setShowLeadCapture] = useState(false)
  const [leadData, setLeadData] = useState<LeadData | null>(null)
  const [utmParams, setUtmParams] = useState<UTMParameters>({})

  const extractPostalCode = (input: string) => {
    const match = input.match(/[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d/)
    return match ? match[0].toUpperCase().replace(/\s+/, " ") : ""
  }

  const getPriceRange = (total?: number) => {
    if (!total || total <= 0) return null
    const min = Math.round(total * 0.95)
    const max = Math.round(total * 1.05)
    return { min, max }
  }

  // Calcul du progrès
  const getProgress = () => {
    return (currentStep / 6) * 100
  }

  const isValidConstructionYear = (year?: number) => {
    const currentYear = new Date().getFullYear()
    return Number.isFinite(year) && (year as number) >= 1900 && (year as number) <= currentYear
  }

  // Garder l'input de surface synchronisé avec l'estimation initiale
  useEffect(() => {
    if (estimatedArea) {
      setUserCorrectedArea(estimatedArea.toString())
      setIsEditingSurface(false)
    }
  }, [estimatedArea])

  // Capture UTM parameters from URL/session once on mount
  useEffect(() => {
    const params = getCurrentUTMParameters()
    if (Object.keys(params).length > 0) {
      setUtmParams(params)
    }
    // Restore step 6 if returning from OTP verification
    try {
      const stored = sessionStorage.getItem("thermopompe-result")
      if (stored) {
        sessionStorage.removeItem("thermopompe-result")
        setRecommendation(JSON.parse(stored))
        setCurrentStep(6)
      }
    } catch { /* ignore */ }
  }, [])

  // ============================================================================
  // STEP 1: DÉTECTION & HOOK (AUTO)
  // ============================================================================
  
  const handleAddressSubmit = async () => {
    if (!address) return
    
    setIsAnalyzing(true)
    track('HeatPump_Address_Entered', { address })
    
    try {
      // Appel à l'API Google Solar existante
      const response = await fetch('/api/roof-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      })
      
      if (!response.ok) {
        throw new Error('Analyse échouée')
      }
      
      const data = await response.json()
      const roofArea = data.roofData?.roofArea || 2000
      const detectedPostal = data.roofData?.postalCode || extractPostalCode(data.roofData?.address || address)
      const detectedCity = data.roofData?.city || ""
      const detectedCoordinates = data.roofData?.coordinates || null
      const detectedProvince = data.roofData?.coordinates?.province || ""

      setSolarArea(roofArea)
      if (detectedPostal) setPostalCode(detectedPostal)
      if (detectedCity) setCity(detectedCity)
      if (detectedCoordinates) setCoordinates(detectedCoordinates)
      if (detectedProvince) setProvince(detectedProvince)
      track('HeatPump_Solar_Analysis_Complete', { roofArea })
      
      // Transition immédiate vers Step 2
      setCurrentStep(2)
      setGeometricQuestionStep(0)
      
    } catch (error) {
      console.error('Erreur analyse:', error)
      // Fallback: utiliser une valeur par défaut
      setSolarArea(2000)
      setCurrentStep(2)
      setGeometricQuestionStep(0)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ============================================================================
  // STEP 2: RAFFINEMENT GÉOMÉTRIQUE
  // ============================================================================
  
  const handleGeometricSubmit = (data?: Partial<GeometricData>) => {
    const currentGeometric: GeometricData = {
      solarArea,
      floors: data?.floors ?? geometric.floors ?? 0,
      hasFinishedBasement: data?.hasFinishedBasement ?? geometric.hasFinishedBasement ?? false,
      garageType: data?.garageType ?? geometric.garageType ?? 'none'
    }

    if (!currentGeometric.floors || currentGeometric.hasFinishedBasement === undefined || !currentGeometric.garageType) {
      return
    }
    
    track('HeatPump_Geometric_Complete', currentGeometric)
    
    // Calculer la surface estimée
    const adjustedRoof = solarArea * 0.85
    const garageArea = currentGeometric.garageType === 'double' ? 450 : 
                       currentGeometric.garageType === 'single' ? 250 : 0
    const baseArea = adjustedRoof - garageArea
    const mainFloors = baseArea * (currentGeometric.floors || 1)
    const basement = currentGeometric.hasFinishedBasement ? baseArea * 0.75 : 0
    const total = Math.round(mainFloors + basement)
    
    setEstimatedArea(total)
    setCurrentStep(3)
  }
  const goToNextGeometricQuestion = () => {
    setGeometricQuestionStep((prev) => Math.min(prev + 1, 2))
  }

  const handleGarageSelect = (value: 'none' | 'single' | 'double') => {
    const nextGeometric = { ...geometric, garageType: value }
    setGeometric(nextGeometric)
    if (!nextGeometric.floors || nextGeometric.hasFinishedBasement === undefined) return
    handleGeometricSubmit(nextGeometric as GeometricData)
  }

  // ============================================================================
  // STEP 3: VALIDATION DE LA SURFACE
  // ============================================================================
  
  const handleSurfaceValidation = () => {
    const parsedArea = parseFloat(userCorrectedArea)
    const finalAreaValue = Number.isFinite(parsedArea) && parsedArea > 0 ? parsedArea : estimatedArea

    setFinalArea(finalAreaValue)
    track('HeatPump_Surface_Validated', { area: finalAreaValue, corrected: finalAreaValue !== estimatedArea })
    setCurrentStep(4)
    setThermalQuestionStep(0)
  }

  // ============================================================================
  // STEP 4: PROFIL THERMIQUE
  // ============================================================================
  
  const handleThermalSubmit = (data?: Partial<ThermalProfile>) => {
    const merged = { ...thermal, ...data }
    setThermal(merged)
    
    if (!merged.constructionYear || 
        merged.insulationUpgraded === undefined || 
        !merged.currentHeatingType) {
      return
    }
    
    if (merged.currentHeatingType === 'oil-gas' && merged.wantsOilTankRemoval === undefined) {
      return
    }
    
    track('HeatPump_Thermal_Complete', merged as ThermalProfile)
    setCurrentStep(5)
    setShowLeadCapture(true)
  }

  // ============================================================================
  // STEP 5: LEAD CAPTURE (GATE)
  // ============================================================================
  
  const handleLeadSubmit = async (data: LeadData) => {
    setLeadData(data)
    track('HeatPump_Lead_Captured', { email: data.email })
    
    // Calculer la recommandation
    const rec = await calculateRecommendation()
    const resolvedRec = rec ?? recommendation
    const basePrice = resolvedRec?.recommendation?.totalInvestment
    const priceRange = getPriceRange(basePrice)
    
    // Deterministic per-user event_id so re-submissions within Meta's 48h
    // dedup window collapse to a single Lead. Vertical 'hvac' keeps
    // thermopompe conversions distinct from the user's potential isolation
    // events.
    const eventId = await computeLeadEventId(data.phone, data.email, 'hvac');

    // Facebook Pixel tracking (client-side) — fire before API for reliability
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'Lead', {
        service_type: 'thermopompe'
      }, { eventID: eventId });
    }

    const clientLeadId = `LEAD${Date.now()}${Math.random().toString(36).substring(2, 10)}`
    const leadPayload = {
      ...data,
      leadId: clientLeadId,
      leadType: 'hvac',
      address,
      postalCode,
      city,
      coordinates,
      province,
      solarArea,
      geometric,
      thermal,
      finalArea,
      wantsOilTankRemoval: thermal.wantsOilTankRemoval ?? null,
      estimatedPrice: basePrice,
      estimatedPriceMin: priceRange?.min,
      estimatedPriceMax: priceRange?.max,
      eventId,
      utmParams,
    }

    setShowLeadCapture(false)
    if (OTP_ENABLED) {
      // Defer the /api/leads call until OTP is verified on /verifier-telephone.
      sessionStorage.setItem('pending-lead', JSON.stringify(leadPayload))
      sessionStorage.setItem('thermopompe-result', JSON.stringify(resolvedRec))
      sessionStorage.setItem('otp-verify', JSON.stringify({ phone: data.phone, redirectTo: '/thermopompes' }))
      router.push('/verifier-telephone')
    } else {
      try {
        await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadPayload),
        })
      } catch (error) {
        console.error('Erreur envoi lead:', error)
      }
      setCurrentStep(6)
    }
  }

  // ============================================================================
  // STEP 6: CALCUL ET RÉSULTATS
  // ============================================================================
  
  const calculateRecommendation = async () => {
    try {
      const response = await fetch('/api/heatpump-calculation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geometric: {
            solarArea,
            floors: geometric.floors,
            hasFinishedBasement: geometric.hasFinishedBasement,
            garageType: geometric.garageType
          },
          thermal: {
            constructionYear: thermal.constructionYear,
            insulationUpgraded: thermal.insulationUpgraded,
            currentHeatingType: thermal.currentHeatingType
          },
          userCorrectedArea: finalArea !== estimatedArea ? finalArea : undefined
        })
      })
      
      const data = await response.json()
      setRecommendation(data.recommendation)
      track('HeatPump_Recommendation_Generated', {
        btu: data.recommendation.btu.totalBTU,
        tonnage: data.recommendation.btu.recommendedTonnage
      })
      return data.recommendation
      
    } catch (error) {
      console.error('Erreur calcul:', error)
      return null
    }
  }

  // ============================================================================
  // RENDU DES STEPS
  // ============================================================================
  const priceRange = getPriceRange(recommendation?.recommendation?.totalInvestment)

  const addressFormProps = {
    onAddressSelect: (value: string) => {
      setAddress(value)
      const pc = extractPostalCode(value)
      if (pc) setPostalCode(pc)
    },
    onAnalyze: handleAddressSubmit,
    isLoading: isAnalyzing,
    className: "max-w-full"
  }

  const ctaButton = (
    <Button
      onClick={handleAddressSubmit}
      disabled={!address || isAnalyzing}
      className="bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-serif-body font-bold h-14 px-6 rounded-full shadow-[-2px_4px_0_0_#002042] hover:shadow-[-1px_2px_0_0_#002042] hover:translate-y-0.5 transition-all whitespace-nowrap disabled:opacity-50 disabled:shadow-none disabled:translate-y-0"
    >
      {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Obtenir mon estimation gratuite"}
    </Button>
  )

  return (
    <div className="min-h-screen bg-[#fffff6]">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#fffff6] border-b border-[#e8e8e0]">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-3">
              <img src="/images/logo-icon.svg" alt="" className="h-7 md:h-[48px] w-auto" />
              <div className="font-heading font-bold text-[#002042] leading-[0.9] tracking-[-0.04em] text-[18px] md:text-[26px] whitespace-nowrap">
                <p>Soumission</p>
                <p>Confort</p>
              </div>
            </a>
            {currentStep === 1 ? (
              <nav className="hidden md:flex items-center gap-8">
                <a href="#comment" className="font-serif-body font-semibold text-[#002042] text-base hover:opacity-70 transition">Comment ça fonctionne ?</a>
                <a href="#pourquoi" className="font-serif-body font-semibold text-[#002042] text-base hover:opacity-70 transition">Pourquoi nous ?</a>
                <button
                  onClick={() => document.getElementById('hero-form')?.scrollIntoView({ behavior: 'smooth' })}
                  className="font-serif-body font-bold text-[#002042] text-base border-2 border-[#002042] rounded-full px-6 py-2.5 hover:bg-[#002042]/5 transition"
                >
                  Obtenir mon estimation gratuite
                </button>
              </nav>
            ) : (
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                <ThermometerSnowflake className="w-4 h-4 mr-1" />
                Thermopompes
              </Badge>
            )}
          </div>
          {currentStep > 1 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-600 mb-2">
                <span>Étape {currentStep} sur 6</span>
                <span>{Math.round(getProgress())}%</span>
              </div>
              <Progress value={getProgress()} className="h-2" />
            </div>
          )}
        </div>
      </header>

      {currentStep === 1 ? (
        <>
          {/* ── HERO ── */}
          <section className="bg-[#fffff6] px-2 py-4 md:px-[40px] md:py-[60px]" id="hero-form">
            {/* Hero card — rounded, photo inside, matching Figma */}
            <div className="relative rounded-[20px] overflow-hidden w-full">
              <img
                src="/images/thermompompe-wow.png"
                alt="Thermopompe"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30 rounded-[20px]" />
              <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-[900px] mx-auto py-16 md:py-[64px] px-6">
                <div className="-rotate-[5.36deg] bg-[#aedee5] px-[10px] py-[6px] rounded-full mb-8 inline-flex items-center gap-1 shadow-[0px_4px_4px_rgba(0,0,0,0.25)]">
                  <span className="font-serif-body font-bold text-[#002042] text-lg tracking-[-0.04em]">Solution développée au Québec</span>
                  <div className="-rotate-[-4.64deg] w-6 h-6 shrink-0">
                    <img src="/images/logo-qc.png" alt="" className="w-full h-full object-cover" />
                  </div>
                </div>
                <h1 className="font-heading font-semibold text-[#fffff6] text-4xl md:text-[56px] tracking-[-0.03em] mb-6 w-full">
                  Estimation de thermopompe instantané
                </h1>
                <p className="font-serif-body font-semibold text-[#fffff6] text-lg md:text-xl mb-8 max-w-xl">
                  Découvrez le coût pour installer une thermopompe chez vous en{" "}
                  <span className="underline">moins d'une minute.</span>
                </p>
                <div className="bg-white border-4 border-[#aedee5] rounded-[20px] p-6 w-full shadow-[0px_4px_4px_rgba(0,0,0,0.25)]">
                  <div className="flex flex-col gap-4">
                    <AddressInput {...addressFormProps} />
                    <Button
                      onClick={handleAddressSubmit}
                      disabled={!address || isAnalyzing}
                      className="w-full bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-serif-body font-bold h-14 rounded-full shadow-[-2px_4px_0_0_#002042] hover:shadow-[-1px_2px_0_0_#002042] hover:translate-y-0.5 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-0"
                    >
                      {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Obtenir mon estimation gratuite"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 mt-4">
                    {["Gratuit et sans obligation", "150+ entrepreneurs certifiés", "Plateforme sécurisée"].map((item) => (
                      <div key={item} className="flex items-center gap-1.5 font-serif-body text-sm text-[#10002C]">
                        <CheckCircle className="w-4 h-4 text-[#002042]" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── COMMENT ÇA FONCTIONNE ── */}
          <section className="py-20 bg-white" id="comment">
            <div className="max-w-[900px] mx-auto px-6">
              <h2 className="font-heading font-bold text-[#10002C] text-3xl md:text-[40px] tracking-[-0.03em] text-center mb-6">
                Comment ça fonctionne ?
              </h2>
              <p className="font-serif-body font-semibold text-[#375371] text-lg md:text-xl text-center mb-12 max-w-[612px] mx-auto">
                Soumission Confort simplifie l'installation de thermopompe grâce à un outil d'estimation basé sur l'intelligence artificielle et l'expérience d'un réseau de plus de 150 entrepreneurs certifiés par la RBQ.
              </p>
              <div className="grid md:grid-cols-2 gap-6 mb-12">
                {[
                  {
                    icon: "/images/card-satellite.png",
                    title: "Analyse satellite de votre maison",
                    body: "Notre outil analyse la superficie et la configuration de votre maison grâce aux images satellites pour calculer vos besoins en chauffage."
                  },
                  {
                    icon: "/images/card-calculator.png",
                    title: "Estimation personnalisée par IA",
                    body: "Notre IA calcule la puissance de thermopompe idéale pour votre maison et vous prépare une estimation de coûts et d'économies potentielles."
                  },
                  {
                    icon: "/images/card-documents.png",
                    title: "Vous choisissez la suite",
                    body: "Vous décidez si on vous accompagne dans votre démarche. Aucune obligation — vous restez en contrôle à chaque étape."
                  },
                  {
                    icon: "/images/card-contractors.png",
                    title: "3 soumissions d'entrepreneurs certifiés",
                    body: "On trouve 3 soumissions d'entrepreneurs certifiés en thermopompe pour vous — gratuitement !"
                  }
                ].map((card) => (
                  <div key={card.title} className="bg-white border border-[#F2F2F7] rounded-[20px] p-8 shadow-[0px_4px_4px_rgba(0,0,0,0.25)]">
                    <h3 className="font-serif-body font-bold text-[#10002C] text-xl mb-2">{card.title}</h3>
                    <p className="font-serif-body text-[#375371] text-base leading-relaxed">{card.body}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-2xl mx-auto">
                <div className="flex-1 min-w-0"><AddressInput {...addressFormProps} /></div>
                {ctaButton}
              </div>
            </div>
          </section>

          {/* ── POURQUOI PASSER PAR NOUS ── */}
          <section className="py-20 bg-[#fffff6]" id="pourquoi">
            <div className="max-w-[900px] mx-auto px-6">
              <div className="space-y-8">
                  <h2 className="font-heading font-bold text-[#10002C] text-3xl md:text-[40px] tracking-[-0.03em]">
                    Pourquoi passer par nous ?
                  </h2>
                  <div className="space-y-6">
                    {[
                      {
                        icon: <Shield className="w-6 h-6 text-[#002042]" />,
                        title: "La tranquillité d'esprit",
                        body: "On fait le tri pour vous et sélectionnons des entrepreneurs fiables et certifiés en installation de thermopompes."
                      },
                      {
                        icon: <Clock className="w-6 h-6 text-[#002042]" />,
                        title: "Gain de temps",
                        body: "Pas besoin de chercher ou appeler plusieurs entreprises. On s'en occupe pour vous."
                      },
                      {
                        icon: <DollarSign className="w-6 h-6 text-[#002042]" />,
                        title: "Subventions maximisées",
                        body: "Nos entrepreneurs connaissent les programmes Rénoclimat et vous aident à obtenir le maximum de subventions disponibles."
                      }
                    ].map((benefit) => (
                      <div key={benefit.title} className="flex gap-4">
                        <div className="w-12 h-12 flex-shrink-0 bg-[#F7FCEB] border border-[#b9e15c] rounded-[10px] flex items-center justify-center">
                          {benefit.icon}
                        </div>
                        <div>
                          <h3 className="font-serif-body font-bold text-[#10002C] text-xl mb-1">{benefit.title}</h3>
                          <p className="font-serif-body text-[#375371] text-base leading-relaxed">{benefit.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1"><AddressInput {...addressFormProps} /></div>
                    {ctaButton}
                  </div>
              </div>
            </div>
          </section>

          {/* ── CTA BOTTOM ── */}
          <section className="relative overflow-hidden">
            <div className="relative">
              <img
                src="/images/Unité extérieure de thermopompe en hiver.jpg"
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20" />
              <div className="relative z-10 py-20 px-6 flex justify-center">
                <div
                  className="w-full max-w-[900px] rounded-[20px] p-10 md:p-16 shadow-[0px_4px_4px_rgba(0,0,0,0.25)] text-center space-y-8"
                  style={{ background: 'radial-gradient(circle at 50% 0%, rgba(221,242,168,0.2) 0%, transparent 60%), #002042' }}
                >
                  <div className="inline-block -rotate-[5.36deg] bg-[#aedee5] px-6 py-2.5 rounded-full">
                    <span className="font-serif-body font-bold text-[#002042] text-2xl">🎉 C'est gratuit !</span>
                  </div>
                  <h2 className="font-heading font-semibold text-white text-4xl md:text-6xl tracking-[-0.03em]">
                    Prêt à estimer votre projet ?
                  </h2>
                  <div className="flex flex-col md:flex-row gap-3 max-w-xl mx-auto">
                    <div className="flex-1"><AddressInput {...addressFormProps} /></div>
                    {ctaButton}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
      <main className="container mx-auto px-4 py-8 md:py-12">
        {/* STEP 2: RAFFINEMENT GÉOMÉTRIQUE */}
        {currentStep === 2 && (
          <Card className="max-w-2xl mx-auto shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl">
                Pour valider l'analyse satellite, nous avons besoin de précisions
              </CardTitle>
              <p className="text-gray-600">
                Ces informations nous permettent de calculer précisément votre surface habitable
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Nombre d'étages */}
              {geometricQuestionStep === 0 && (
                <div>
                  <Label className="text-lg font-semibold mb-3 block">
                    Combien d'étages a votre maison ?
                  </Label>
                  <RadioGroup
                    value={geometric.floors?.toString()}
                    onValueChange={(value) => {
                      setGeometric({ ...geometric, floors: parseFloat(value) })
                      goToNextGeometricQuestion()
                    }}
                  >
                    {[
                      { value: '1', label: '1 étage (plain-pied)' },
                      { value: '1.5', label: '1.5 étage (avec mezzanine)' },
                      { value: '2', label: '2 étages' },
                      { value: '3', label: '3 étages ou plus' }
                    ].map((option) => (
                      <div
                        key={option.value}
                        onClick={() => {
                          setGeometric({ ...geometric, floors: parseFloat(option.value) })
                          goToNextGeometricQuestion()
                        }}
                        className={`flex items-center space-x-3 p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition ${
                          geometric.floors?.toString() === option.value ? "border-blue-500 bg-blue-50" : "border-gray-200"
                        }`}
                      >
                        <RadioGroupItem value={option.value} id={`floors-${option.value}`} />
                        <Label htmlFor={`floors-${option.value}`} className="flex-1 cursor-pointer font-medium">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {/* Sous-sol fini */}
              {geometricQuestionStep === 1 && (
                <div>
                  <Label className="text-lg font-semibold mb-3 block">
                    Avez-vous un sous-sol fini (aménagé) ?
                  </Label>
                  <RadioGroup
                    value={geometric.hasFinishedBasement?.toString()}
                    onValueChange={(value) => {
                      setGeometric({ ...geometric, hasFinishedBasement: value === 'true' })
                      goToNextGeometricQuestion()
                    }}
                  >
                    {[
                      { value: 'true', label: 'Oui, sous-sol aménagé' },
                      { value: 'false', label: 'Non, pas de sous-sol ou non-aménagé' }
                    ].map((option) => (
                      <div
                        key={option.value}
                        onClick={() => {
                          setGeometric({ ...geometric, hasFinishedBasement: option.value === 'true' })
                          goToNextGeometricQuestion()
                        }}
                        className={`flex items-center space-x-3 p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition ${
                          geometric.hasFinishedBasement?.toString() === option.value ? "border-blue-500 bg-blue-50" : "border-gray-200"
                        }`}
                      >
                        <RadioGroupItem value={option.value} id={`basement-${option.value}`} />
                        <Label htmlFor={`basement-${option.value}`} className="flex-1 cursor-pointer font-medium">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {/* Garage */}
              {geometricQuestionStep === 2 && (
                <div>
                  <Label className="text-lg font-semibold mb-3 block">
                    Type de garage attaché ?
                  </Label>
                  <RadioGroup
                    value={geometric.garageType}
                    onValueChange={(value: any) => handleGarageSelect(value)}
                  >
                    {[
                      { value: 'none', label: 'Aucun garage ou détaché' },
                      { value: 'single', label: 'Garage simple (1 voiture)' },
                      { value: 'double', label: 'Garage double (2 voitures)' }
                    ].map((option) => (
                      <div
                        key={option.value}
                        onClick={() => handleGarageSelect(option.value)}
                        className={`flex items-center space-x-3 p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition ${
                          geometric.garageType === option.value ? "border-blue-500 bg-blue-50" : "border-gray-200"
                        }`}
                      >
                        <RadioGroupItem value={option.value} id={`garage-${option.value}`} />
                        <Label htmlFor={`garage-${option.value}`} className="flex-1 cursor-pointer font-medium">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 3: VALIDATION SURFACE */}
        {currentStep === 3 && (
          <Card className="max-w-2xl mx-auto shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl">
                Validation de la surface habitable
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 text-center space-y-4">
                <p className="text-gray-700">
                  L'IA estime votre surface habitable à
                </p>
                {!isEditingSurface ? (
                  <>
                    <div className="flex items-center justify-center gap-3">
                      <p className="text-5xl font-bold text-blue-600">
                        {formatArea(Number.parseFloat(userCorrectedArea) || estimatedArea)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-300 text-blue-700 hover:bg-white"
                      onClick={() => setIsEditingSurface(true)}
                    >
                      Modifier la surface
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <Input
                      type="number"
                      value={userCorrectedArea}
                      onChange={(e) => setUserCorrectedArea(e.target.value)}
                      className="max-w-[200px] text-center text-3xl font-bold h-14"
                    />
                    <span className="text-2xl font-semibold text-blue-700">pi²</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="ml-2"
                      onClick={() => setIsEditingSurface(false)}
                      disabled={!userCorrectedArea}
                    >
                      Terminer
                    </Button>
                  </div>
                )}
                <p className="text-sm text-gray-600">
                  (Basé sur l'analyse satellite et vos réponses — ajustez si nécessaire)
                </p>
              </div>

              <div className="space-y-4">
                <Button
                  onClick={handleSurfaceValidation}
                  className="w-full h-14 text-lg bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-serif-body font-bold shadow-md  rounded-full disabled:opacity-60"
                  disabled={!userCorrectedArea}
                >
                  Continuer avec cette surface
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4: PROFIL THERMIQUE */}
        {currentStep === 4 && (
          <Card className="max-w-2xl mx-auto shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl">
                Profil thermique de votre maison
              </CardTitle>
              <p className="text-gray-600">
                Ces informations nous permettent de calculer précisément vos besoins en chauffage
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Année de construction */}
              {thermalQuestionStep === 0 && (
                <div>
                  <Label className="text-lg font-semibold mb-3 block">
                    Année de construction de la maison ?
                  </Label>
                  <Input
                    type="number"
                    placeholder="Ex: 1995"
                    value={thermal.constructionYear || ''}
                    onChange={(e) => {
                      const year = parseInt(e.target.value)
                      setThermal({ ...thermal, constructionYear: year })
                    }}
                    className="text-lg h-12"
                    min="1900"
                    max={new Date().getFullYear()}
                  />
                  <div className="mt-4">
                    <Button
                      onClick={() => {
                        if (isValidConstructionYear(thermal.constructionYear)) {
                          setThermalQuestionStep(1)
                          handleThermalSubmit({ constructionYear: thermal.constructionYear })
                        }
                      }}
                      className="w-full h-12 bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-serif-body font-bold shadow-md  rounded-full disabled:opacity-60"
                      disabled={!isValidConstructionYear(thermal.constructionYear)}
                    >
                      Continuer
                    </Button>
                  </div>
                </div>
              )}

              {/* Isolation refaite - QUESTION CRITIQUE */}
              {thermalQuestionStep === 1 && (
                <div>
                  <Label className="text-lg font-semibold mb-3 block">
                    L'isolation (murs/toit/fenêtres) a-t-elle été refaite ou améliorée significativement depuis la construction ?
                  </Label>
                  <RadioGroup
                    value={thermal.insulationUpgraded?.toString()}
                    onValueChange={(value) => {
                      setThermal({ ...thermal, insulationUpgraded: value === 'true' })
                      setThermalQuestionStep(2)
                      handleThermalSubmit({ insulationUpgraded: value === 'true' })
                    }}
                  >
                    {[
                      { 
                        value: 'true', 
                        label: 'Oui, isolation améliorée',
                        description: 'Rénovations majeures d\'isolation effectuées'
                      },
                      { 
                        value: 'false', 
                        label: 'Non, isolation d\'origine',
                        description: 'Aucune amélioration majeure depuis la construction'
                      }
                    ].map((option) => (
                      <div
                        key={option.value}
                        onClick={() => {
                          setThermal({ ...thermal, insulationUpgraded: option.value === 'true' })
                          setThermalQuestionStep(2)
                          handleThermalSubmit({ insulationUpgraded: option.value === 'true' })
                        }}
                        className={`flex items-start space-x-3 p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition ${
                          thermal.insulationUpgraded?.toString() === option.value ? "border-blue-500 bg-blue-50" : "border-gray-200"
                        }`}
                      >
                        <RadioGroupItem value={option.value} id={`insulation-${option.value}`} className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor={`insulation-${option.value}`} className="cursor-pointer font-medium block">
                            {option.label}
                          </Label>
                          <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {/* Type de chauffage actuel */}
              {thermalQuestionStep === 2 && (
                <div>
                  <Label className="text-lg font-semibold mb-3 block">
                    Type de chauffage actuel ?
                  </Label>
                  <RadioGroup
                    value={thermal.currentHeatingType}
                    onValueChange={(value: any) => {
                      setThermal({ ...thermal, currentHeatingType: value, wantsOilTankRemoval: undefined })
                      if (value === 'oil-gas') {
                        setThermalQuestionStep(3)
                      } else {
                        handleThermalSubmit({ currentHeatingType: value, wantsOilTankRemoval: undefined })
                      }
                    }}
                  >
                    {[
                      { value: 'electric', label: 'Plinthes électriques' },
                      { value: 'forced-air', label: 'Air pulsé (fournaise électrique)' },
                      { value: 'bi-energy', label: 'Bi-énergie (Hydro + combustible)' },
                      { value: 'hot-water', label: 'Système à eau chaude (chaudière/radiateurs)' },
                      { value: 'oil-gas', label: 'Huile ou Gaz naturel' }
                    ].map((option) => (
                      <div
                        key={option.value}
                        onClick={() => {
                          setThermal({ ...thermal, currentHeatingType: option.value, wantsOilTankRemoval: undefined })
                          if (option.value === 'oil-gas') {
                            setThermalQuestionStep(3)
                          } else {
                            handleThermalSubmit({ currentHeatingType: option.value, wantsOilTankRemoval: undefined })
                          }
                        }}
                        className={`flex items-center space-x-3 p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition ${
                          thermal.currentHeatingType === option.value ? "border-blue-500 bg-blue-50" : "border-gray-200"
                        }`}
                      >
                        <RadioGroupItem value={option.value} id={`heating-${option.value}`} />
                        <Label htmlFor={`heating-${option.value}`} className="flex-1 cursor-pointer font-medium">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {/* Enlèvement du réservoir de mazout - CONDITIONNEL */}
              {thermal.currentHeatingType === 'oil-gas' && thermalQuestionStep === 3 && (
                <div>
                  <Label className="text-lg font-semibold mb-3 block">
                    Souhaitez-vous enlever votre réservoir de mazout ?
                  </Label>
                  <p className="text-sm text-gray-600 mb-4">
                    Cette opération peut être subventionnée jusqu'à 10,000$ par le gouvernement du Québec lors de l'installation d'une thermopompe.
                  </p>
                  <RadioGroup
                    value={thermal.wantsOilTankRemoval?.toString()}
                    onValueChange={(value) => {
                      setThermal({ ...thermal, wantsOilTankRemoval: value === 'true' })
                      handleThermalSubmit({ wantsOilTankRemoval: value === 'true' })
                    }}
                  >
                    {[
                      { 
                        value: 'true', 
                        label: 'Oui, inclure l\'enlèvement du réservoir',
                        description: 'Coût estimé: 6,000$ (subvention gouvernementale possible)'
                      },
                      { 
                        value: 'false', 
                        label: 'Non, garder le système actuel',
                        description: 'Pas de coût supplémentaire pour l\'enlèvement'
                      }
                    ].map((option) => (
                      <div
                        key={option.value}
                        onClick={() => {
                          setThermal({ ...thermal, wantsOilTankRemoval: option.value === 'true' })
                          handleThermalSubmit({ wantsOilTankRemoval: option.value === 'true' })
                        }}
                        className={`flex items-start space-x-3 p-4 border rounded-lg hover:bg-blue-50 cursor-pointer transition ${
                          thermal.wantsOilTankRemoval?.toString() === option.value ? "border-blue-500 bg-blue-50" : "border-gray-200"
                        }`}
                      >
                        <RadioGroupItem value={option.value} id={`oil-removal-${option.value}`} className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor={`oil-removal-${option.value}`} className="cursor-pointer font-medium block">
                            {option.label}
                          </Label>
                          <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 5: LEAD CAPTURE */}
        {currentStep === 5 && showLeadCapture && null}

        {/* STEP 6: RÉSULTATS */}
        {currentStep === 6 && recommendation && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Investissement (mis en avant) */}
            <Card className="bg-green-50 border-2 border-green-200">
              <CardContent className="p-6">
                <h3 className="text-2xl font-bold text-green-900 mb-2">Investissement Estimé</h3>
                <p className="text-sm text-green-700 mb-4">
                  Basé sur votre maison et le modèle recommandé.
                </p>
                <div className="space-y-2 text-green-900">
                  <div className="flex justify-between">
                    <span>Équipement:</span>
                    <span className="font-semibold">{formatPrice(recommendation.recommendation.estimatedCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Installation:</span>
                    <span className="font-semibold">{formatPrice(recommendation.recommendation.installationCost)}</span>
                  </div>
                  <div className="flex justify-center text-lg font-bold border-t-2 border-green-200 pt-3 bg-white rounded-lg px-4 py-3 shadow-sm">
                    {priceRange ? (
                      <span className="text-green-600 text-3xl font-extrabold">
                        {formatPrice(priceRange.min)} - {formatPrice(priceRange.max)}
                      </span>
                    ) : (
                      <span className="text-green-600 text-3xl font-extrabold">
                        {formatPrice(recommendation.recommendation.totalInvestment)}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA sous l'investissement */}
            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardContent className="p-8 text-center">
                <h3 className="text-2xl font-bold mb-4">
                  Prêt à économiser {formatPrice(recommendation.savings.annualSavings)} par an ?
                </h3>
                <p className="text-gray-600 mb-6">
                  Obtenez jusqu'à 3 soumissions gratuites d'entrepreneurs certifiés
                </p>
                <Button
                  size="lg"
                  className="bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-serif-body font-bold h-14 px-14 md:px-16 text-lg w-full max-w-xl mx-auto shadow-[-2px_4px_0_0_#002042] rounded-full"
                  onClick={() => router.push('/success')}
                >
                  Obtenir soumissions gratuites
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Hero Results */}
            <Card className="bg-[#002042] text-white shadow-2xl">
              <CardContent className="p-8 text-center">
                <h2 className="text-3xl font-bold mb-4">
                  Votre Rapport d'Économies Personnalisé
                </h2>
                <div className="grid md:grid-cols-3 gap-6 mt-8">
                  <div className="bg-white/10 backdrop-blur rounded-lg p-6">
                    <p className="text-sm opacity-90 mb-2">Économies Annuelles</p>
                    <p className="text-4xl font-bold">
                      {formatPrice(recommendation.savings.annualSavings)}
                    </p>
                    <p className="text-sm opacity-75 mt-2">
                      {formatPercentage(recommendation.savings.savingsPercentage)} de réduction
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-6">
                    <p className="text-sm opacity-90 mb-2">Économies 15 ans</p>
                    <p className="text-4xl font-bold">
                      {formatPrice(recommendation.savings.savings15Years)}
                    </p>
                    <p className="text-sm opacity-75 mt-2">
                      Retour sur investissement
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-6">
                    <p className="text-sm opacity-90 mb-2">Période de Retour</p>
                    <p className="text-4xl font-bold">
                      {recommendation.savings.paybackPeriod} ans
                    </p>
                    <p className="text-sm opacity-75 mt-2">
                      Investissement rentable
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recommandation Technique */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center">
                  <Wind className="w-8 h-8 mr-3 text-blue-600" />
                  Thermopompe Recommandée
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-gray-600">Modèle</Label>
                    <p className="text-xl font-semibold">{recommendation.recommendation.model}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Puissance</Label>
                    <p className="text-xl font-semibold">
                      {recommendation.btu.recommendedTonnage} tonnes ({formatBTU(recommendation.btu.totalBTU)} BTU)
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Surface Habitable</Label>
                    <p className="text-xl font-semibold">{formatArea(recommendation.surface.totalHabitableArea)}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Profil Thermique</Label>
                    <p className="text-xl font-semibold">
                      {getThermalProfileDescription(recommendation.btu.effectiveYear)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        )}
      </main>
      )}

      {/* Lead Capture Popup */}
      <LeadCapturePopup
        isOpen={showLeadCapture}
        onSubmit={handleLeadSubmit}
        onClose={() => setShowLeadCapture(false)}
      />
    </div>
  )
}
