"use client"

import Link from "next/link"
import { CheckCircle2, Home, Phone, ArrowRight, Clock, Users, Star } from "lucide-react"
import { track } from '@vercel/analytics'
import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function SuccessContent() {
  const searchParams = useSearchParams()
  const type = searchParams.get('type')
  const isContractor = type === 'contractor'

  useEffect(() => {
    track(isContractor ? 'Contractor Lead Submitted' : 'Conversion Completed')
  }, [isContractor])

  const nextStepsClient = [
    {
      num: "1",
      icon: CheckCircle2,
      title: "Validation de votre projet",
      desc: "Un membre de notre équipe valide rapidement les détails de votre demande d'estimation.",
    },
    {
      num: "2",
      icon: Users,
      title: "On vous recontacte",
      desc: "Notre équipe vous contacte pour discuter de votre estimé et des prochaines étapes de votre projet d'isolation.",
    },
    {
      num: "3",
      icon: Star,
      title: "Vous décidez de la suite",
      desc: "Sans engagement. Notre objectif est de vous aider à démarrer votre projet d'isolation en confiance.",
    },
  ]

  const nextStepsContractor = [
    {
      num: "1",
      icon: CheckCircle2,
      title: "Vérification de votre profil",
      desc: "Notre équipe vérifie vos informations et votre licence RBQ pour assurer la qualité de notre réseau.",
    },
    {
      num: "2",
      icon: Users,
      title: "Configuration de votre compte",
      desc: "Nous créons votre profil d'entrepreneur et configurons vos préférences de zone de service et de projets.",
    },
    {
      num: "3",
      icon: Star,
      title: "Réception de vos premiers leads",
      desc: "Commencez à recevoir des leads qualifiés correspondant à votre expertise et votre zone de service.",
    },
  ]

  const steps = isContractor ? nextStepsContractor : nextStepsClient

  return (
    <div className="min-h-screen bg-[#fffff6] flex flex-col">
      {/* Hero */}
      <section className="bg-[#002042] text-white py-16 md:py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          {/* Animated checkmark */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-[#b9e15c]/20 animate-ping" />
            <div className="relative w-24 h-24 rounded-full bg-[#b9e15c]/20 border-2 border-[#b9e15c]/40 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-[#b9e15c]" />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 bg-[#b9e15c]/20 border border-[#b9e15c]/30 rounded-full px-4 py-1.5 mb-5">
            <CheckCircle2 className="w-4 h-4 text-[#b9e15c]" />
            <span className="font-serif-body text-sm font-medium text-[#b9e15c]">Demande bien reçue</span>
          </div>

          <h1 className="font-heading text-3xl md:text-5xl font-bold leading-tight mb-4">
            {isContractor
              ? "Merci de votre intérêt pour rejoindre notre réseau!"
              : "Merci ! Votre demande a été transmise avec succès"}
          </h1>

          <p className="font-serif-body text-[#aedee5] text-lg max-w-xl mx-auto mb-8">
            {isContractor
              ? "Notre équipe examinera votre demande et vous contactera dans les prochaines 24-48 heures."
              : <>Notre équipe vous recontacte dans les prochaines{" "}<strong className="text-white">24 heures</strong>{" "}au sujet de votre estimation d'isolation.</>}
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {["🔒 100% confidentiel", "⚡ Réponse sous 24h", "🤝 Sans engagement", "⭐ Service québécois"].map((b) => (
              <span
                key={b}
                className="flex items-center gap-1 bg-white/10 border border-white/20 rounded-full px-3 py-1.5 font-serif-body text-sm font-medium"
              >
                {b}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/">
              <button className="flex items-center gap-2 bg-white text-[#002042] font-heading font-bold py-3 px-6 rounded-full hover:bg-[#fffff6] transition-colors">
                <Home className="w-4 h-4" />
                Retour à l'accueil
              </button>
            </Link>
            <a href="tel:+15149091526">
              <button className="flex items-center gap-2 bg-[#b9e15c] border-2 border-[#b9e15c] text-[#002042] font-heading font-bold py-3 px-6 rounded-full shadow-[-2px_4px_0_0_rgba(0,0,0,0.2)] hover:shadow-[-1px_2px_0_0_rgba(0,0,0,0.2)] hover:translate-y-0.5 transition-all">
                <Phone className="w-4 h-4" />
                Nous contacter
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* What happens next */}
      <section className="py-14 md:py-20 px-4 bg-[#fffff6]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 text-[#002042] font-serif-body font-medium text-sm mb-3">
              <Clock className="w-4 h-4" />
              Prochaines étapes
            </div>
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-[#10002c]">
              Voici ce qui se passe maintenant
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, idx) => {
              const Icon = step.icon
              return (
                <div
                  key={idx}
                  className="bg-white rounded-[20px] p-6 shadow-md border border-[#f2f2f7] flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-[#aedee5]/40 text-[#002042] font-heading font-bold text-sm flex items-center justify-center flex-shrink-0 border border-[#aedee5]">
                      {step.num}
                    </div>
                    <Icon className="w-5 h-5 text-[#002042]" />
                  </div>
                  <h3 className="font-serif-body font-bold text-[#10002c] text-base mb-2">{step.title}</h3>
                  <p className="font-serif-body text-[#375371] text-sm leading-relaxed">{step.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-4 border-t border-[#e8e8e0] bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-heading text-xl md:text-2xl font-bold text-[#10002c] mb-3">
            {isContractor
              ? "Préparez-vous à recevoir des leads"
              : "Optimisez vos chances d'obtenir le meilleur prix"}
          </h2>
          <p className="font-serif-body text-[#375371] text-sm mb-6">
            {isContractor
              ? "Assurez-vous que votre profil est complet et que vous êtes prêt à répondre rapidement aux demandes."
              : "Préparez quelques photos et notez vos préférences de matériaux pour accélérer le traitement de votre estimation."}
          </p>
          <Link href="/">
            <button className="flex items-center gap-2 mx-auto bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-heading font-bold py-3 px-8 rounded-full shadow-[-2px_4px_0_0_#002042] hover:shadow-[-1px_2px_0_0_#002042] hover:translate-y-0.5 transition-all">
              {isContractor ? "Retour à l'accueil" : "Retour à l'accueil"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </section>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fffff6] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#aedee5] border-t-[#002042] rounded-full animate-spin"></div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
