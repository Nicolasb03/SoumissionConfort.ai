"use client"

import { useState, useEffect, useRef } from "react"
import { ArrowLeft, Check, CheckCircle, Smile } from "lucide-react"
import { track } from '@vercel/analytics'

import {
  SYMPTOMS_OPTIONS,
  HYDRO_BRACKETS,
  INTENT_OPTIONS,
  type V2Answers,
  type SymptomCode,
  type HydroBracketCode,
  type IntentCode,
} from "@/lib/funnel-config"

interface UserQuestionnaireProps {
  roofData: any
  onComplete: (answers: V2Answers) => void
}

const STEP_KEYS = ['symptoms', 'hydroBracket', 'intent'] as const
const STEP_TITLES = [
  { title: "Quels symptômes vis-tu chez toi ?", description: "Coche tous ceux qui s'appliquent — minimum 1." },
  { title: "Combien tu paies d'Hydro par mois en moyenne ?", description: "Pas sûr du montant exact ? Donne ton meilleur estimé." },
  { title: "Pourquoi tu fais cette demande ?", description: "Ça nous aide à t'envoyer la bonne info." },
] as const

export function UserQuestionnaire({ roofData: _roofData, onComplete }: UserQuestionnaireProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<V2Answers>({
    symptoms: [],
    hydroBracket: '',
    intent: '',
  })

  // Click guard prevents double-advance race condition (P1-5).
  const [isAdvancing, setIsAdvancing] = useState(false)
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current)
    }
  }, [])

  const totalSteps = STEP_KEYS.length
  const getProgress = () => ((currentStep + 1) / totalSteps) * 100

  const trackStepCompleted = (stepIndex: number) => {
    track('Questionnaire Step Completed', {
      step: stepIndex + 1,
      stepName: STEP_KEYS[stepIndex],
    })
  }

  const advanceTo = (nextStep: number, stepCompletedIndex: number) => {
    if (isAdvancing) return
    setIsAdvancing(true)
    advanceTimeoutRef.current = setTimeout(() => {
      trackStepCompleted(stepCompletedIndex)
      if (nextStep >= totalSteps) {
        // Finished — hand answers up. Wrap in a fresh ref snapshot to satisfy
        // the V2Answers contract (intent narrowed away from '').
        const finalAnswers: V2Answers = { ...answers }
        track('Questionnaire Completed')
        track('Lead Form Shown', { intent: finalAnswers.intent })
        onComplete(finalAnswers)
      } else {
        setCurrentStep(nextStep)
      }
      setIsAdvancing(false)
    }, 250)
  }

  const handlePrevious = () => {
    if (isAdvancing) return
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }

  const handleSymptomToggle = (code: SymptomCode) => {
    setAnswers((prev) => {
      const has = prev.symptoms.includes(code)
      return {
        ...prev,
        symptoms: has ? prev.symptoms.filter((s) => s !== code) : [...prev.symptoms, code],
      }
    })
  }

  const handleSymptomNext = () => {
    if (answers.symptoms.length === 0) return
    advanceTo(1, 0)
  }

  const handleHydroSelect = (code: HydroBracketCode) => {
    setAnswers((prev) => ({ ...prev, hydroBracket: code }))
    advanceTo(2, 1)
  }

  const handleIntentSelect = (code: IntentCode) => {
    setAnswers((prev) => ({ ...prev, intent: code }))
    // Use a microtask trick: we need the latest answers when calling onComplete.
    // Easiest: capture inline.
    if (isAdvancing) return
    setIsAdvancing(true)
    advanceTimeoutRef.current = setTimeout(() => {
      trackStepCompleted(2)
      const finalAnswers: V2Answers = { ...answers, intent: code }
      track('Questionnaire Completed')
      track('Lead Form Shown', { intent: finalAnswers.intent })
      onComplete(finalAnswers)
      setIsAdvancing(false)
    }, 250)
  }

  const stepCopy = STEP_TITLES[currentStep]

  return (
    <div className="max-w-3xl mx-auto px-4 pt-3 pb-4 sm:py-[60px] flex flex-col items-center gap-4 sm:gap-8">

      {/* Badge */}
      <div className="inline-flex items-center gap-1.5 bg-[#aedee5] rounded-full px-4 py-2 sm:py-2.5 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
        <span className="font-serif-body font-bold text-[#002042] text-base sm:text-xl leading-none tracking-[-0.8px]">
          Question {currentStep + 1}/{totalSteps}
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
            {stepCopy.title}
          </h2>
          <p className="font-serif-body text-[14px] sm:text-[18px] text-[#002042] tracking-[-0.04em] leading-[1.2]">
            {stepCopy.description}
          </p>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2 sm:gap-4">

          {/* Q1 — Symptômes (multi-select) */}
          {currentStep === 0 && SYMPTOMS_OPTIONS.map((option) => {
            const checked = answers.symptoms.includes(option.code)
            return (
              <div
                key={option.code}
                onClick={() => handleSymptomToggle(option.code)}
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
                <span className="text-xl sm:text-2xl" aria-hidden>{option.emoji}</span>
                <span className="font-serif-body font-semibold text-sm sm:text-[20px] text-[#002042] tracking-[-0.05em] leading-[1.2]">
                  {option.label}
                </span>
              </div>
            )
          })}

          {/* Q2 — Facture Hydro (4 brackets, auto-advance) */}
          {currentStep === 1 && HYDRO_BRACKETS.map((bracket) => {
            const selected = answers.hydroBracket === bracket.code
            return (
              <div
                key={bracket.code}
                onClick={() => handleHydroSelect(bracket.code)}
                className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-[20px] cursor-pointer transition-all border-2 ${
                  selected ? bracket.selected : `${bracket.base} hover:brightness-95`
                }`}
              >
                <span className="text-2xl sm:text-3xl" aria-hidden>{bracket.emoji}</span>
                <span className="font-serif-body font-semibold text-sm sm:text-[20px] text-[#002042] tracking-[-0.05em] leading-[1.2]">
                  {bracket.label}
                </span>
              </div>
            )
          })}

          {/* Q3 — Intent (auto-advance) */}
          {currentStep === 2 && INTENT_OPTIONS.map((option) => {
            const selected = answers.intent === option.code
            return (
              <div
                key={option.code}
                onClick={() => handleIntentSelect(option.code)}
                className={`flex flex-col items-start gap-2 sm:gap-3 p-4 sm:p-6 rounded-[20px] cursor-pointer transition-all ${
                  selected ? "bg-[#ecf8cf] border-2 border-[#86a735]" : "bg-white border border-[#aedee5] hover:border-[#375371]"
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <span className="text-2xl sm:text-3xl" aria-hidden>{option.emoji}</span>
                  <span className="font-heading font-bold text-base sm:text-[22px] text-[#002042] tracking-[-0.04em] leading-[1.2]">
                    {option.label}
                  </span>
                </div>
                <span className="font-serif-body italic text-xs sm:text-[16px] text-[#375371] tracking-[-0.03em] leading-[1.2] pl-9 sm:pl-12">
                  {option.sub}
                </span>
              </div>
            )
          })}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-2 sm:pt-0 border-t border-[#e8e8e0]">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0 || isAdvancing}
            className="flex items-center gap-2 font-serif-body font-bold text-[#375371] hover:text-[#002042] disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-1 py-2 sm:py-3 text-sm sm:text-[18px]"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            Précédent
          </button>

          {currentStep === 0 ? (
            <button
              onClick={handleSymptomNext}
              disabled={answers.symptoms.length === 0 || isAdvancing}
              className="flex items-center gap-1.5 bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-heading font-bold py-2 px-4 sm:py-3 sm:px-8 rounded-full shadow-[-2px_4px_0_0_#002042] hover:shadow-[-1px_2px_0_0_#002042] hover:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 text-sm sm:text-[18px]"
            >
              {answers.symptoms.length === 0 ? 'Sélectionne au moins un' : 'Suivant'}
              <CheckCircle className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-[90px] sm:w-[120px]" />
          )}
        </div>
      </div>
    </div>
  )
}
