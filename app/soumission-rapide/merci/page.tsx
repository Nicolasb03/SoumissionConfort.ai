"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { EstimateCard } from "@/components/funnel/EstimateCard"
import {
  SESSION_STORAGE_KEYS,
  type HydroBracketCode,
  type IntentCode,
  type SymptomCode,
} from "@/lib/funnel-config"

declare global {
  interface Window {
    fbq: (...args: any[]) => void
    gtag: (...args: any[]) => void
    dataLayer: any[]
  }
}

interface LeadSessionData {
  firstName?: string
  ville?: string
  villeSlug?: string
  leadId?: string
  projectType?: string
  timeline?: string
  intent?: IntentCode
}

interface EstimateInputs {
  hydroBracket: HydroBracketCode
  symptoms: SymptomCode[]
  intent: IntentCode
}

const ENTREPRENEURS = [
  {
    name: "Entrepreneur 1",
    rating: "4.5",
    features: [
      "Valeur R: 3,2-4,2 par pouce",
      "Installation rapide",
      "Bon rapport qualité-prix",
      "Résistant au feu",
      "Épaisseur: ~12 pouces",
      "Durabilité: 20-25 ans",
    ],
  },
  {
    name: "Entrepreneur 2",
    rating: "4.7",
    features: [
      "Valeur R: 3,6-3,8 par pouce",
      "Matériau écologique (recyclé)",
      "Excellente insonorisation",
      "Traitement anti-feu et anti-moisissure",
      "Épaisseur: ~15 pouces",
      "Durabilité: 25-30 ans",
    ],
  },
  {
    name: "Entrepreneur 3",
    rating: "4.9",
    features: [
      "Valeur R: 3,6-3,8 par pouce",
      "Matériau écologique (recyclé)",
      "Excellente insonorisation",
      "Traitement anti-feu et anti-moisissure",
      "Épaisseur: ~15 pouces",
      "Durabilité: 25-30 ans",
    ],
  },
]

export default function MerciPage() {
  const [leadData, setLeadData] = useState<LeadSessionData>({})
  const [estimateInputs, setEstimateInputs] = useState<EstimateInputs | null>(null)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("soumission-rapide-lead")
      if (stored) setLeadData(JSON.parse(stored))
    } catch {
      /* ignore */
    }
    try {
      const storedEstimate = sessionStorage.getItem(SESSION_STORAGE_KEYS.ESTIMATE_INPUTS)
      if (storedEstimate) setEstimateInputs(JSON.parse(storedEstimate))
    } catch {
      /* ignore */
    }

    // Phase 1: keep existing CompleteRegistration fire for all paths
    // (Phase 2 will remove this entirely per Codex P0-2.)
    if (typeof window.fbq === "function") {
      window.fbq("track", "CompleteRegistration", {
        content_name: "soumission-rapide-isolation",
        currency: "CAD",
      })
    }
    if (typeof window.gtag === "function") {
      window.gtag("event", "conversion", {
        event_category: "pSEO Questionnaire",
        event_label: "merci_page_view",
      })
      window.gtag("event", "merci_page_view", { event_category: "pSEO Questionnaire" })
    }
  }, [])

  // Intent resolution: prefer estimate-inputs (canonical), fall back to leadData.intent,
  // default to "qualified" for backward compat (legacy /merci visitors before V2).
  const intent: IntentCode =
    estimateInputs?.intent ?? leadData.intent ?? "qualified"
  const isQualifiedIntent = intent === "qualified"
  const isCuriousIntent = intent === "curious"

  return (
    <div
      className="min-h-screen bg-[#fffff6] flex flex-col items-center"
      style={{ fontFamily: "'Source Serif Pro', Georgia, serif" }}
    >
      {/* Navbar */}
      <div className="w-full px-4 lg:px-[60px] py-[16px] flex items-center">
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
      <div className="w-full max-w-[900px] px-4 pb-[60px] flex flex-col gap-[60px] items-center">

        {/* ── Success card (gated copy by intent) ── */}
        <div className="bg-[#ecf8cf] border-4 border-[#b9e15c] rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-[32px] w-full flex flex-col gap-[24px] items-center">
          {/* Rotated pill badge */}
          <div className="-rotate-[5deg]">
            <div className="bg-[#aedee5] flex gap-[4px] items-center px-[24px] py-[10px] rounded-full shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
              <span
                className="font-bold text-[32px] text-[#002042] tracking-[-1.28px] leading-[1.2] whitespace-nowrap"
                style={{ fontFamily: "'Source Serif Pro', serif" }}
              >
                {isQualifiedIntent ? "Parfait merci !" : "Voici ton estimation !"}
              </span>
              <img
                src="/images/icon-question-badge.svg"
                alt=""
                className="w-[36px] h-[36px] -rotate-[8deg]"
              />
            </div>
          </div>

          <h2
            className="font-bold text-[40px] text-[#002042] text-center tracking-[-1.2px] leading-[1.2] w-full max-w-[700px]"
            style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
          >
            {isQualifiedIntent
              ? "C'est confirmé! Ta demande est partie. 🎉"
              : "Voici ton estimation personnalisée 📊"}
          </h2>

          <div className="font-semibold text-[20px] text-[#375371] text-center tracking-[-0.8px] leading-[1.2]">
            {isQualifiedIntent ? (
              <>
                <p>On t&apos;a matché avec 3 entrepreneurs spécialistes en isolation dans ta région.</p>
                <p>Ils vont te contacter dans les 24-48 prochaines heures pour te donner leur soumission.</p>
              </>
            ) : (
              <>
                <p>Basée sur tes réponses, voici un range réaliste de ce que pourrait te coûter une amélioration d&apos;isolation.</p>
                <p>Un conseiller peut te rejoindre si tu veux pousser plus loin — sinon, prends le temps qu&apos;il te faut.</p>
              </>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-x-[16px] gap-y-[8px]">
            {["Gratuit et sans obligation", "Entrepreneurs certifiés RBQ", "5 000+ projets complétés"].map(
              (label) => (
                <div key={label} className="flex items-center gap-[6px]">
                  <img src="/images/icon-check-green.svg" alt="" className="w-[24px] h-[24px] shrink-0" />
                  <span className="font-semibold text-[14px] text-[#002042] leading-[1.2] tracking-[-0.56px] whitespace-nowrap">
                    {label}
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        {/* ── Estimate card (Funnel V2 — both intent paths get an estimate) ── */}
        {estimateInputs && (
          <EstimateCard
            hydroBracket={estimateInputs.hydroBracket}
            symptomsCount={estimateInputs.symptoms.length}
          />
        )}

        {/* ── Prochaines étapes (gated copy by intent) ── */}
        <div className="flex flex-col gap-[32px] items-center w-full">
          <h2
            className="font-bold text-[40px] text-[#10002c] text-center tracking-[-1.2px] leading-[1.2] max-w-[700px]"
            style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
          >
            {isQualifiedIntent ? "Quelles sont les prochaines étapes ?" : "Pour aller plus loin"}
          </h2>

          <div className="flex flex-wrap gap-[24px] items-stretch justify-center w-full">
            {(isQualifiedIntent
              ? [
                  {
                    num: "1",
                    title: "Validation de ton projet d'isolation",
                    desc:
                      "Un expert de notre équipe valide rapidement les détails pour assurer un bon appariement avec les entrepreneurs.",
                  },
                  {
                    num: "2",
                    title: "Appariement avec 3 entrepreneurs certifiés",
                    desc:
                      "Nous sélectionnons des entrepreneurs certifiés et bien notés disponibles dans ton secteur pour ton type de projet.",
                  },
                  {
                    num: "3",
                    title: "Réception de tes soumissions détaillées",
                    desc:
                      "Tu reçois tes soumissions dans les prochaines 48 heures. Tu peux ensuite comparer les prix, matériaux et délais.",
                  },
                ]
              : [
                  {
                    num: "1",
                    title: "Tu reçois un courriel récap",
                    desc:
                      "On t'envoie ton estimation et des conseils d'isolation pour ta maison directement par courriel.",
                  },
                  {
                    num: "2",
                    title: "Pas d'engagement, à ton rythme",
                    desc:
                      "Prends le temps qu'il te faut pour réfléchir. Pas de pression — on est là quand tu seras prêt.",
                  },
                  {
                    num: "3",
                    title: "Un conseiller peut te rappeler",
                    desc:
                      "Si tu as des questions ou tu veux pousser plus loin, un conseiller peut te rejoindre pour discuter de ton projet.",
                  },
                ]
            ).map((step) => (
              <div
                key={step.num}
                className="bg-white border border-[#eef5fc] rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-[32px] flex-1 min-w-[240px] flex flex-col gap-[16px]"
              >
                <div className="bg-[#f7fceb] border border-[#b9e15c] rounded-[10px] size-[48px] flex items-center justify-center shrink-0">
                  <span
                    className="font-bold text-[32px] text-[#002042] leading-none tracking-[-1.28px]"
                    style={{ fontFamily: "'Source Serif Pro', serif" }}
                  >
                    {step.num}
                  </span>
                </div>
                <div className="flex flex-col gap-[16px]">
                  <p className="font-bold text-[20px] text-[#10002c] leading-[1.2] tracking-[-0.8px]">
                    {step.title}
                  </p>
                  <p className="text-[18px] text-[#375371] leading-[1.2] tracking-[-0.72px]">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Team availability card (kept for both paths — same design) ── */}
        <div className="bg-[#eef5fc] border border-[#aedee5] rounded-[20px] p-[24px] w-full flex justify-center">
          <div className="flex flex-col gap-[24px] items-center max-w-[700px] w-full">
            <div className="flex items-center">
              <div className="size-[100px] rounded-full overflow-hidden border-4 border-white shadow -mr-[14px] relative z-10">
                <img src="/images/team-avatar-2.png" alt="Équipe" className="w-full h-full object-cover" />
              </div>
              <div className="size-[100px] rounded-full overflow-hidden border-4 border-white shadow">
                <img src="/images/team-avatar-1.png" alt="Équipe" className="w-full h-full object-cover" />
              </div>
            </div>

            <p
              className="font-bold text-[24px] text-[#002042] text-center leading-[1.2] tracking-[-0.72px]"
              style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
            >
              Notre équipe reste disponible pour t&apos;aider.
            </p>

            <p className="text-[18px] text-[#375371] text-center leading-[1.2] tracking-[-0.72px] max-w-[700px]">
              Si tu as des questions ou tu veux apporter une modification à ton formulaire, hésite pas à contacter notre équipe.
            </p>

            <div className="flex flex-col sm:flex-row gap-[12px] w-full">
              <a
                href="mailto:info@soumissionconfort.com"
                className="flex w-full sm:flex-1 h-[56px] items-center justify-center px-[32px] border-2 border-[#002042] rounded-full"
              >
                <span className="font-bold text-[18px] text-[#002042] leading-none whitespace-nowrap">
                  Écris-nous
                </span>
              </a>
              <a
                href="tel:+14387994670"
                className="flex w-full sm:flex-1 h-[56px] items-center justify-center px-[32px] bg-[#b9e15c] border-2 border-[#002042] rounded-full shadow-[-2px_4px_0px_0px_#002042]"
              >
                <span className="font-bold text-[18px] text-[#002042] leading-none whitespace-nowrap">
                  Appelle-nous
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* ── 3 entrepreneurs section : QUALIFIED only ── */}
        {isQualifiedIntent && (
          <div className="bg-white rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] px-[32px] py-[24px] w-full flex flex-col gap-[16px]">
            <div className="bg-[#eef5fc] border border-[#aedee5] rounded-[20px] p-[24px] flex flex-col gap-[24px]">
              <div className="flex flex-col gap-[24px] items-center">
                <p
                  className="font-bold text-[32px] text-[#002042] text-center leading-[1.2] tracking-[-1.28px] w-full"
                  style={{ fontFamily: "'Source Serif Pro', serif" }}
                >
                  Notre système a trouvé 3 entrepreneurs vérifiés ! ⭐
                </p>
                <p className="text-[18px] text-[#375371] text-center leading-[1.2] tracking-[-0.72px]">
                  Selon ton échéancier,{" "}
                  <strong className="font-bold text-[#375371]">3 entrepreneurs qualifiés</strong>{" "}
                  sont prêts à te soumettre une proposition.
                  <br />
                  Nous les contactons dès maintenant pour confirmer leur disponibilité pour ton projet.
                </p>
              </div>

              <div className="flex gap-[16px] flex-wrap">
                {ENTREPRENEURS.map((e) => (
                  <div
                    key={e.name}
                    className="bg-white border border-[#aedee5] rounded-[20px] p-[24px] flex-1 min-w-[200px] flex flex-col gap-[24px]"
                  >
                    <div className="flex flex-col gap-[8px]">
                      <p
                        className="font-bold text-[16px] text-[#002042] leading-[1.2] tracking-[-0.48px]"
                        style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
                      >
                        {e.name}
                      </p>
                      <div className="flex items-center gap-[2px]">
                        <span className="text-[14px] text-[#375371] leading-none">{e.rating}</span>
                        <img src="/images/icon-star.svg" alt="★" className="w-[12px] h-[12px]" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-[8px]">
                      <p
                        className="font-medium text-[14px] text-[#002042] leading-[1.2] tracking-[-0.42px] whitespace-nowrap"
                        style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
                      >
                        Caractéristiques :
                      </p>
                      <div className="flex flex-col gap-[4px]">
                        {e.features.map((f) => (
                          <div key={f} className="flex items-center gap-[6px]">
                            <img src="/images/icon-check-green.svg" alt="" className="w-[20px] h-[20px] shrink-0" />
                            <p className="text-[14px] text-[#10002c] leading-[1.2] tracking-[-0.56px]">{f}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── "Tu changes d'idée?" CTA : CURIOUS only ── */}
        {isCuriousIntent && (
          <div className="bg-white rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] px-[32px] py-[24px] w-full flex flex-col gap-[16px]">
            <div className="bg-[#eef5fc] border border-[#aedee5] rounded-[20px] p-[24px] flex flex-col gap-[24px] items-center text-center">
              <p
                className="font-bold text-[32px] text-[#002042] leading-[1.2] tracking-[-1.28px]"
                style={{ fontFamily: "'Source Serif Pro', serif" }}
              >
                Tu changes d&apos;idée?
              </p>
              <p className="text-[18px] text-[#375371] leading-[1.2] tracking-[-0.72px] max-w-[640px]">
                Si tu veux recevoir 3 soumissions gratuites d&apos;entrepreneurs spécialistes dans ta région, clique ici et on te match en moins de 24h.
              </p>
              <Link
                href="/soumission-rapide/questionnaire?intent=qualified"
                className="flex h-[56px] items-center justify-center px-[32px] bg-[#b9e15c] border-2 border-[#002042] rounded-full shadow-[-2px_4px_0px_0px_#002042]"
              >
                <span
                  className="font-bold text-[18px] text-[#002042] leading-none whitespace-nowrap"
                  style={{ fontFamily: "'Source Serif Pro', serif" }}
                >
                  Recevoir 3 soumissions →
                </span>
              </Link>
            </div>
          </div>
        )}

        {/* ── Retour à l'accueil ── */}
        <Link
          href="/soumission-rapide"
          className="flex h-[56px] items-center justify-center px-[32px] border-2 border-[#002042] rounded-full w-full"
        >
          <span
            className="font-bold text-[18px] text-[#002042] leading-none whitespace-nowrap"
            style={{ fontFamily: "'Source Serif Pro', serif" }}
          >
            Retour à l&apos;accueil
          </span>
        </Link>
      </div>
    </div>
  )
}
