"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { calculateInsulationPricing, formatPrice, formatPercentage } from "@/lib/insulation-calculator"
import { TrendingUp, Zap, Star, CheckCircle, ArrowRight } from "lucide-react"
import type { LeadData } from "@/components/lead-capture-popup"
import { TrustBadges } from "@/components/trust-badges"
import { track } from '@vercel/analytics'

interface InsulationResultsProps {
  roofData: any
  userAnswers: any
  leadData: LeadData
  onComplete: () => void
}

export function InsulationResults({ roofData, userAnswers, leadData, onComplete }: InsulationResultsProps) {
  const [results, setResults] = useState<any>(null)

  useEffect(() => {
    // Calculer les résultats avec le nouvel algorithme
    const calculationInputs = {
      roofArea: roofData.roofArea || 2000,
      roofPitch: roofData.pitch,
      currentInsulation: userAnswers.currentInsulation || 'partielle',
      atticAccess: userAnswers.atticAccess || 'facile',
      heatingSystem: userAnswers.heatingSystem || 'electricite',
      identifiedProblems: userAnswers.identifiedProblems || [],
    }

    const calculatedResults = calculateInsulationPricing(calculationInputs)
    setResults(calculatedResults)
    
    // Track pricing results viewed
    track('Pricing Results Viewed', {
      roofArea: calculationInputs.roofArea,
      estimatedCost: calculatedResults.ranges.standard.totalCost.min + '-' + calculatedResults.ranges.standard.totalCost.max
    })
  }, [roofData, userAnswers])

  if (!results) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#aedee5] border-t-[#002042] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-serif-body text-[#375371]">Calcul de votre soumission personnalisée...</p>
        </div>
      </div>
    )
  }

  const { standard } = results.ranges

  return (
    <div className="max-w-6xl mx-auto space-y-8 px-4">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-[#aedee5]/30 border border-[#aedee5] rounded-full px-5 py-2 mb-5">
          <CheckCircle className="w-4 h-4 text-[#002042]" />
          <span className="font-serif-body font-semibold text-[#002042] text-sm">Analyse complétée</span>
        </div>
        <h1 className="font-heading text-3xl md:text-5xl font-bold text-[#10002c] mb-4">
          Votre soumission d'isolation personnalisée
        </h1>
        <p className="font-serif-body text-lg text-[#375371] max-w-2xl mx-auto">
          Basée sur {results.adjustedArea} pi² et vos besoins spécifiques
        </p>
      </div>

      {/* Main pricing card */}
      <div className="bg-[#002042] rounded-[20px] shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />

        <div className="relative z-10 p-8 md:p-12">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="font-heading text-2xl font-bold text-white mb-2">Fourchette d'investissement</h2>
              <p className="font-serif-body text-[#aedee5]">Installation professionnelle au QC</p>
            </div>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
          </div>

          {/* Price range */}
          <div className="bg-[#eef5fc] rounded-[16px] p-6 md:p-8 text-center mb-8">
            <p className="font-serif-body text-[#375371] text-sm mb-2">Estimation personnalisée</p>
            <p className="font-heading text-4xl md:text-5xl font-bold text-[#1d707d] mb-2">
              {formatPrice(standard.totalCost.min)} – {formatPrice(standard.totalCost.max)}
            </p>
            <p className="font-serif-body text-[#375371] text-sm">
              ({formatPrice(standard.totalCost.min / results.adjustedArea)} – {formatPrice(standard.totalCost.max / results.adjustedArea)} par pi²)
            </p>
            <div className="inline-flex items-center gap-2 bg-[#aedee5]/30 border border-[#aedee5] rounded-full px-4 py-1.5 mt-3">
              <TrendingUp className="w-4 h-4 text-[#1d707d]" />
              <span className="font-serif-body font-semibold text-[#1d707d] text-sm">Tarif concurrentiel du marché</span>
            </div>
          </div>

          <button
            onClick={() => {
              track('Get Quotes CTA Clicked', { location: 'pricing_card' })
              onComplete()
            }}
            className="w-full bg-[#b9e15c] border-2 border-white text-[#002042] font-heading font-bold py-5 px-8 rounded-full transition-all duration-300 shadow-[-2px_4px_0_0_rgba(255,255,255,0.4)] hover:shadow-[-1px_2px_0_0_rgba(255,255,255,0.4)] hover:translate-y-0.5 text-lg mb-4"
          >
            <span className="hidden md:inline">Obtenir une soumission plus précise par des entrepreneurs</span>
            <span className="md:hidden">Obtenir mes 3 soumissions gratuites</span>
          </button>

          <p className="font-serif-body text-center text-sm text-[#aedee5]">
            ⚡ Obtenez des prix exacts en 24h • 100% gratuit
          </p>

          <div className="mt-6 p-4 bg-white/10 rounded-xl border border-white/20">
            <p className="font-serif-body text-sm text-[#aedee5] leading-relaxed">
              💡 Cette estimation inclut des matériaux haut de gamme, une installation professionnelle, les permis et la garantie. Le prix final dépendra des matériaux choisis et des facteurs spécifiques découverts lors de l'inspection.
            </p>
          </div>
        </div>
      </div>

      {/* Comparaison des gammes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {Object.entries(results.ranges).filter(([key]) => key !== 'premium').map(([key, range]: [string, any]) => {
          const isRecommended = key === 'standard'

          return (
            <div
              key={key}
              className={`relative bg-white rounded-[20px] border-2 shadow-md p-6 ${isRecommended ? 'border-[#b9e15c] shadow-lg md:scale-105' : 'border-[#f2f2f7]'}`}
            >
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="font-serif-body font-bold bg-[#b9e15c] border-2 border-[#002042] text-[#002042] text-xs px-4 py-1 rounded-full whitespace-nowrap shadow-[-1px_2px_0_0_#002042]">
                    ⭐ Recommandé
                  </span>
                </div>
              )}

              <div className="text-center mb-4">
                <div className="text-4xl mb-2">{range.icon}</div>
                <h3 className="font-heading text-xl font-bold text-[#10002c] mb-1">GAMME {range.name.toUpperCase()}</h3>
                <p className="font-serif-body text-sm text-[#375371]">{range.type}</p>
                <p className="font-serif-body text-[#002042] font-semibold mt-1">→ Atteint R-{range.rValue}</p>
              </div>

              <div className="bg-[#eef5fc] p-4 rounded-xl mb-4">
                <p className="font-serif-body text-xs text-[#375371] mb-1">PRIX TOTAL</p>
                <p className="font-heading text-2xl font-bold text-[#1d707d]">
                  {formatPrice(range.totalCost.min)} – {formatPrice(range.totalCost.max)}
                </p>
              </div>

              <div className="space-y-2 mb-4">
                <h4 className="font-serif-body font-bold text-sm text-[#10002c]">Caractéristiques :</h4>
                {range.features.map((feature: string, index: number) => (
                  <div key={index} className="flex items-start gap-2 font-serif-body text-sm text-[#375371]">
                    <CheckCircle className="w-4 h-4 text-[#002042] shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </div>
                ))}
                <div className="flex items-start gap-2 font-serif-body text-sm text-[#375371]">
                  <CheckCircle className="w-4 h-4 text-[#002042] shrink-0 mt-0.5" />
                  <span>Épaisseur: ~{range.thickness}</span>
                </div>
                <div className="flex items-start gap-2 font-serif-body text-sm text-[#375371]">
                  <CheckCircle className="w-4 h-4 text-[#002042] shrink-0 mt-0.5" />
                  <span>Durabilité: {range.durability}</span>
                </div>
              </div>

              <div className="border-t border-[#e8e8e0] pt-4">
                <h4 className="font-serif-body font-bold text-sm text-[#10002c] mb-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-[#002042]" />
                  ÉCONOMIES ANNUELLES ESTIMÉES
                </h4>
                <p className="font-heading text-xl font-bold text-[#002042] mb-2">
                  {formatPrice(range.annualSavings.min)} – {formatPrice(range.annualSavings.max)}
                </p>
                <p className="font-serif-body text-xs text-[#375371]">
                  Réduction de {formatPercentage(range.heatingReduction.min)}-{formatPercentage(range.heatingReduction.max)} des coûts de chauffage
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Trust Badges Section */}
      <TrustBadges />
    </div>
  )
}
