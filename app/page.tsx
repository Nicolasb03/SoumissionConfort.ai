"use client"

import { AddressInput } from "@/components/address-input"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUTMParameters } from "@/lib/utm-utils"
import { track } from '@vercel/analytics'
import { initializeMeta, isMetaConfigured } from '@/lib/meta-config'
import { trackViewContent } from '@/lib/meta-conversion-api'
import { ChevronDown, Search, Menu, X } from 'lucide-react'

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <img src="/images/logo-icon.svg" alt="" className="h-7 md:h-[52px] w-auto" />
      <div className="font-heading font-bold text-[#002042] leading-[0.9] tracking-[-0.04em] text-[18px] md:text-[28px] whitespace-nowrap">
        <p>Soumission</p>
        <p>Confort</p>
      </div>
    </div>
  )
}

function AddressBarSection({ onNavigate }: { onNavigate: (address: string) => void }) {
  const [validAddress, setValidAddress] = useState("")

  return (
    <div className="flex flex-wrap gap-2 w-full">
      <div className="flex-1 min-w-[240px]">
        <AddressInput
          onAddressSelect={() => {}}
          onValidAddressSelect={(a) => setValidAddress(a)}
          onAnalyze={() => { if (validAddress.trim()) onNavigate(validAddress) }}
          className="w-full"
        />
      </div>
      <button
        onClick={() => { if (validAddress.trim()) onNavigate(validAddress) }}
        disabled={!validAddress.trim()}
        className="flex-1 min-w-[300px] bg-[#b9e15c] border-2 border-[#002042] h-[56px] px-8 rounded-full shadow-[-2px_4px_0_0_#002042] font-serif-body font-bold text-[18px] text-[#002042] whitespace-nowrap hover:shadow-[-1px_2px_0_0_#002042] hover:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
      >
        Obtenir mon estimation gratuite
      </button>
    </div>
  )
}

const faqItems = [
  {
    q: "Est-ce que l'estimation est gratuite?",
    a: "Oui, absolument. Notre outil d'estimation est 100% gratuit et sans aucune obligation. Vous pouvez obtenir votre estimé en moins d'une minute, sans fournir de données de paiement.",
  },
  {
    q: "Qui est Soumission Confort ?",
    a: "Soumission Confort est une plateforme québécoise qui connecte les propriétaires avec des entrepreneurs certifiés RBQ pour leurs projets d'isolation. Nous avons aidé plus de 5 000 familles à réisoler leur grenier.",
  },
  {
    q: "Est-ce que je suis obligé de faire affaire avec un entrepreneur de votre réseau ?",
    a: "Non. Après avoir reçu votre estimé, vous êtes entièrement libre de décider si vous souhaitez être mis en contact avec nos entrepreneurs. Il n'y a aucune pression et aucune obligation.",
  },
  {
    q: "Est-ce que les entrepreneurs sont tous vérifiés et certifiés par la RBQ ?",
    a: "Oui. Tous nos entrepreneurs sont certifiés RBQ et vérifiés à 360° par notre équipe. En plus de valider leur licence RBQ, nous analysons leurs avis Google et les rencontrons personnellement avant de les intégrer à notre réseau.",
  },
]

export default function HomePage() {
  const router = useRouter()
  const [heroAddress, setHeroAddress] = useState("")
  const [heroValidAddress, setHeroValidAddress] = useState("")
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    initializeMeta()
    if (isMetaConfigured()) {
      trackViewContent({ contentName: 'Homepage', contentType: 'website' }).catch(() => {})
    }
  }, [])

  const navigateToAnalysis = (address: string) => {
    if (!address.trim()) return
    track('Analysis Started', { address: address.trim() })
    const utm = getCurrentUTMParameters()
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = new URL('/analysis', origin || 'http://localhost')
    url.searchParams.set('address', address.trim())
    ;(['utm_source', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_term', 'fbclid'] as const).forEach((k) => {
      const v = (utm as any)[k]
      if (v) url.searchParams.set(k, v)
    })
    const href = origin ? url.toString().replace(origin, '') : url.toString()
    router.push(href)
  }

  return (
    <div className="min-h-screen bg-[#fffff6]">

      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-50 bg-[#fffff6] border-b border-[#e8e8e0]">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between max-w-7xl">
          <Logo />
          <nav className="hidden md:flex items-center gap-8">
            <a href="#comment-ca-fonctionne" className="font-serif-body font-semibold text-[18px] text-[#002042] hover:opacity-70 transition-opacity tracking-tight">
              Comment ça fonctionne ?
            </a>
            <a href="#faq" className="font-serif-body font-semibold text-[18px] text-[#002042] hover:opacity-70 transition-opacity tracking-tight">
              FAQ
            </a>
          </nav>
          <a
            href="#form-hero"
            className="hidden md:flex items-center justify-center h-[48px] px-7 rounded-full border-2 border-[#002042] font-serif-body font-bold text-[17px] text-[#002042] hover:bg-[#002042] hover:text-white transition-colors"
          >
            Obtenir mon estimation gratuite
          </a>
          <button
            className="md:hidden p-1 text-[#002042]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#fffff6] border-t border-[#e8e8e0] px-6 py-4 flex flex-col gap-4">
            <a href="#comment-ca-fonctionne" onClick={() => setMobileMenuOpen(false)} className="font-serif-body font-semibold text-[18px] text-[#002042] tracking-tight">
              Comment ça fonctionne ?
            </a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="font-serif-body font-semibold text-[18px] text-[#002042] tracking-tight">
              FAQ
            </a>
            <a
              href="#form-hero"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center h-[48px] px-7 rounded-full bg-[#b9e15c] border-2 border-[#002042] shadow-[-2px_4px_0_0_#002042] font-serif-body font-bold text-[17px] text-[#002042] text-center"
            >
              Obtenir mon estimation gratuite
            </a>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section className="px-4 sm:px-6 pt-6 pb-16">
        <div className="container mx-auto max-w-7xl">
          <div className="relative rounded-[20px] overflow-hidden min-h-[580px] md:min-h-[640px] flex flex-col items-center justify-center">
            <img
              src="/images/Soumissioconfort-hero.jpeg"
              alt="Isolation de grenier"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30" />

            <div id="form-hero" className="relative z-10 flex flex-col gap-8 items-center py-16 px-4 w-full max-w-[860px] mx-auto">
              {/* Eyebrow */}
              <div className="-rotate-[5deg]">
                <div className="bg-[#aedee5] flex gap-2 items-center px-5 py-2.5 rounded-full shadow-md">
                  <span className="font-serif-body font-bold text-[16px] text-[#002042] tracking-tight whitespace-nowrap">
                    Solution développée au Québec
                  </span>
                  <img src="/images/icon-qc.png" alt="" className="w-6 h-6 object-contain" />
                </div>
              </div>

              {/* Title */}
              <h1 className="font-heading font-semibold text-[56px] text-white text-center leading-none tracking-[-0.03em] drop-shadow-lg max-w-[700px]">
                Estimation d'isolation instantané
              </h1>

              {/* Subtitle */}
              <p className="font-serif-body font-semibold text-[18px] text-[#fffff6] text-center tracking-tight leading-[1.2]">
                Découvrez le coût pour réisoler votre grenier en{' '}
                <span className="underline">moins d'une minute.</span>
              </p>

              {/* Form card */}
              <div className="bg-white border-4 border-[#aedee5] rounded-[20px] p-6 md:p-8 shadow-lg w-full space-y-4">
                <div className="space-y-3">
                  <AddressInput
                    onAddressSelect={(a) => setHeroAddress(a)}
                    onValidAddressSelect={(a) => setHeroValidAddress(a)}
                    onAnalyze={() => { if (heroValidAddress.trim()) navigateToAnalysis(heroValidAddress) }}
                    className="w-full"
                  />
                  <button
                    type="button"
                    onClick={() => { if (heroValidAddress.trim()) navigateToAnalysis(heroValidAddress) }}
                    disabled={!heroValidAddress.trim()}
                    className="w-full bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-serif-body font-bold py-4 px-6 rounded-full shadow-[-2px_4px_0_0_#002042] hover:shadow-[-1px_2px_0_0_#002042] hover:translate-y-0.5 transition-all text-[18px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
                  >
                    Obtenir mon estimation gratuite
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-5">
                  {["Gratuit et sans obligation", "150+ entrepreneurs certifiés", "Plateforme sécurisée"].map((text) => (
                    <div key={text} className="flex items-center gap-1.5">
                      <img src="/images/icon-check.svg" alt="" className="w-5 h-5" />
                      <span className="font-serif-body text-[#10002c] text-[15px] tracking-tight whitespace-nowrap">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMMENT ÇA FONCTIONNE ── */}
      <section id="comment-ca-fonctionne" className="py-16 bg-[#fffff6]">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl flex flex-col gap-10 items-center">
          <div className="flex flex-col gap-5 items-center text-center">
            <h2 className="font-heading font-bold text-[40px] text-[#10002c] leading-none tracking-[-0.03em]">
              Comment ça fonctionne ?
            </h2>
            <p className="font-serif-body font-semibold text-[18px] text-[#375371] leading-[1.2] tracking-tight max-w-3xl">
              Soumission Confort simplifie le démarrage des projets d'isolation des québecois grâce à un outil d'estimation basé sur l'intelligence artificielle et l'expérience d'un réseau de plus de 150 entrepreneurs certifiés par la RBQ.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {[
              {
                img: "/images/card-satellite.png",
                title: "Notre outil analyse la superficie de votre toiture grâce aux images satellites",
                desc: "Entrez simplement votre adresse et notre système récupère les données de votre propriété en quelques secondes.",
              },
              {
                img: "/images/card-calculator.png",
                title: "Notre IA vous prépare un estimé pour vous aider à démarrer votre projet d'isolation",
                desc: "Obtenez un estimé réaliste basé sur les prix du marché et les caractéristiques de votre maison.",
              },
              {
                img: "/images/card-documents.png",
                title: "Vous choisissez si on vous accompagne dans votre recherche de soumission",
                desc: "Aucune obligation. Vous décidez si vous souhaitez être mis en contact avec nos entrepreneurs certifiés.",
              },
              {
                img: "/images/card-contractors.png",
                title: "On trouve 3 soumissions d'entrepreneurs certifiés pour vous !",
                desc: "Recevez jusqu'à 3 soumissions détaillées d'entrepreneurs RBQ vérifiés dans votre région.",
              },
            ].map(({ img, title, desc }) => (
              <div key={title} className="bg-white border border-[#f2f2f7] rounded-[20px] p-8 shadow-md flex flex-col gap-6">
                <div className="w-20 h-20 rounded-[12px] overflow-hidden shrink-0">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col gap-3">
                  <p className="font-serif-body font-bold text-[18px] text-[#10002c] leading-[1.2] tracking-tight">{title}</p>
                  <p className="font-serif-body text-[16px] text-[#375371] leading-[1.2] tracking-tight">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="w-full">
            <AddressBarSection onNavigate={navigateToAnalysis} />
          </div>
        </div>
      </section>

      {/* ── C'EST QUOI LA CROSSE ── */}
      <section className="py-16 bg-[#fffff6]">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl flex flex-col gap-8 items-center">
          <div className="flex flex-wrap gap-4 items-center justify-center">
            <h2 className="font-heading font-bold text-[40px] text-[#10002c] leading-none tracking-[-0.03em] text-center">
              C'est quoi la « crosse » ?
            </h2>
            <div className="-rotate-[5deg]">
              <div className="bg-[#aedee5] flex gap-2 items-center px-6 py-3 rounded-full shadow-md">
                <span className="font-serif-body font-bold text-[28px] text-[#002042] tracking-tight whitespace-nowrap">Y en n'a pas !</span>
                <img src="/images/sticker-emoji.svg" alt="" className="w-9 h-9" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {[
              {
                title: "Les entrepreneurs nous paient pour les mettre en contact avec des propriétaires qui veulent faire leurs travaux.",
                body: "Aucune pression. On mise sur la qualité de notre service avant tout.\n\nNotre meilleure façon de réussir, c'est de vous trouver l'entrepreneur idéal pour votre projet.",
              },
              {
                title: "Tous nos entrepreneurs sont certifiés RBQ et vérifiés à 360° par notre équipe.",
                body: "Pour mériter la confiance de nos clients, nous sélectionnons nos entrepreneurs avec rigueur.\n\nEn plus de valider leur licence RBQ, nous analysons leurs avis Google et rencontrons personnellement chacun d'eux avant de les intégrer à notre réseau.",
              },
            ].map(({ title, body }) => (
              <div key={title} className="bg-white border border-[#f2f2f7] rounded-[20px] p-8 shadow-md flex flex-col gap-4">
                <img src="/images/icon-trust.svg" alt="" className="w-12 h-12" />
                <p className="font-serif-body font-bold text-[18px] text-[#10002c] leading-[1.2] tracking-tight">{title}</p>
                <p className="font-serif-body text-[16px] text-[#375371] leading-[1.4] tracking-tight whitespace-pre-line">{body}</p>
              </div>
            ))}
          </div>

          {/* Stats bar */}
          <div className="bg-[#aedee5] rounded-[20px] shadow-md px-8 py-12 w-full flex flex-wrap gap-12 items-center justify-center">
            {[
              { value: "5 000 +", label: "Projets d'isolation" },
              { value: "150 +", label: "Entrepreneurs vérifiés" },
              { value: "40%", label: "Économie moyenne" },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 min-w-[140px]">
                <p className="font-serif-body font-bold text-[48px] text-[#002042] leading-[1.2] tracking-[-0.04em] text-center">{value}</p>
                <p className="font-serif-body text-[16px] text-[#002042] text-center tracking-tight">{label}</p>
              </div>
            ))}
          </div>

          <div className="w-full">
            <AddressBarSection onNavigate={navigateToAnalysis} />
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 bg-[#fffff6]">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <div
            className="rounded-[20px] shadow-md flex flex-col items-center justify-center gap-8 px-8 py-16"
            style={{ background: 'linear-gradient(135deg, #0e2d48 0%, #002042 100%)' }}
          >
            <div className="-rotate-[5deg]">
              <div className="bg-[#aedee5] flex gap-2 items-center px-6 py-3 rounded-full shadow-md">
                <span className="font-serif-body font-bold text-[22px] text-[#002042] tracking-tight whitespace-nowrap">C'est gratuit !</span>
                <img src="/images/sticker-emoji-cta.svg" alt="" className="w-9 h-9" />
              </div>
            </div>
            <h2 className="font-heading font-semibold text-[48px] md:text-[56px] text-white leading-none tracking-[-0.03em] text-center">
              Prêt à estimer votre projet ?
            </h2>
            <div className="w-full max-w-[700px]">
              <AddressBarSection onNavigate={navigateToAnalysis} />
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl flex flex-col gap-10 items-center">
          <h2 className="font-heading font-bold text-[40px] text-[#10002c] leading-none tracking-[-0.03em] text-center">
            FAQ
          </h2>
          <div className="flex flex-col gap-4 w-full">
            {faqItems.map((item, i) => (
              <div key={i} className="bg-white border border-[#f2f2f7] rounded-[20px] shadow-md overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center gap-6 p-6 text-left"
                >
                  <p className="flex-1 font-serif-body font-bold text-[18px] text-[#002042] leading-[1.2] tracking-tight">
                    {item.q}
                  </p>
                  <ChevronDown className={`shrink-0 w-6 h-6 text-[#002042] transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6">
                    <p className="font-serif-body text-[16px] text-[#375371] leading-[1.4] tracking-tight">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
