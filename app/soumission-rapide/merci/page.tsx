"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

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

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("soumission-rapide-lead")
      if (stored) setLeadData(JSON.parse(stored))
    } catch { /* ignore */ }

    if (typeof window.fbq === "function") {
      window.fbq("track", "CompleteRegistration", {
        content_name: "soumission-rapide-isolation",
        currency: "CAD",
      })
    }
    if (typeof window.gtag === "function") {
      window.gtag("event", "conversion", { event_category: "pSEO Questionnaire", event_label: "merci_page_view" })
      window.gtag("event", "merci_page_view", { event_category: "pSEO Questionnaire" })
    }
  }, [])

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

        {/* ── Success card ── */}
        <div className="bg-[#ecf8cf] border-4 border-[#b9e15c] rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-[32px] w-full flex flex-col gap-[24px] items-center">
          {/* Rotated pill badge */}
          <div className="-rotate-[5deg]">
            <div className="bg-[#aedee5] flex gap-[4px] items-center px-[24px] py-[10px] rounded-full shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
              <span
                className="font-bold text-[32px] text-[#002042] tracking-[-1.28px] leading-[1.2] whitespace-nowrap"
                style={{ fontFamily: "'Source Serif Pro', serif" }}
              >
                Parfait merci !
              </span>
              <img src="/images/icon-question-badge.svg" alt="" className="w-[36px] h-[36px] -rotate-[8deg]" />
            </div>
          </div>

          <h2
            className="font-bold text-[40px] text-[#002042] text-center tracking-[-1.2px] leading-[1.2] w-full max-w-[700px]"
            style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
          >
            Votre demande a été transmise avec succès ! 🎉
          </h2>

          <div className="font-semibold text-[20px] text-[#375371] text-center tracking-[-0.8px] leading-[1.2]">
            <p>Nous contactons les meilleurs entrepreneurs de votre région.</p>
            <p>Vous recevrez jusqu'à 3 soumissions détaillées dans les prochaines 48 heures.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-x-[16px] gap-y-[8px]">
            {["Gratuit et sans obligation", "Entrepreneurs certifiés RBQ", "5 000+ projets complétés"].map((label) => (
              <div key={label} className="flex items-center gap-[6px]">
                <img src="/images/icon-check-green.svg" alt="" className="w-[24px] h-[24px] shrink-0" />
                <span className="font-semibold text-[14px] text-[#002042] leading-[1.2] tracking-[-0.56px] whitespace-nowrap">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Prochaines étapes ── */}
        <div className="flex flex-col gap-[32px] items-center w-full">
          <h2
            className="font-bold text-[40px] text-[#10002c] text-center tracking-[-1.2px] leading-[1.2] max-w-[700px]"
            style={{ fontFamily: "'Radio Canada Big', sans-serif" }}
          >
            Quelles sont les prochaines étapes ?
          </h2>

          <div className="flex flex-wrap gap-[24px] items-stretch justify-center w-full">
            {[
              {
                num: "1",
                title: "Validation de votre projet d'isolation",
                desc: "Un expert de notre équipe valide rapidement les détails pour assurer un bon appariement avec les entrepreneurs.",
              },
              {
                num: "2",
                title: "Appariement avec 3 entrepreneurs certifiés",
                desc: "Nous sélectionnons des entrepreneurs certifiés et bien notés disponibles dans votre secteur pour votre type de projet.",
              },
              {
                num: "3",
                title: "Réception de vos soumissions détaillées",
                desc: "Nous ferons parvenir vos soumissions dans les prochaines 48 heures. Vous pourrez ensuite comparer les prix, matériaux et délais.",
              },
            ].map((step) => (
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

        {/* ── Team availability card ── */}
        <div className="bg-[#eef5fc] border border-[#aedee5] rounded-[20px] p-[24px] w-full flex justify-center">
          <div className="flex flex-col gap-[24px] items-center max-w-[700px] w-full">
            {/* Overlapping avatars */}
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
              Notre équipe reste disponible pour vous aider.
            </p>

            <p className="text-[18px] text-[#375371] text-center leading-[1.2] tracking-[-0.72px] max-w-[700px]">
              Si vous avez des questions ou souhaitez apporter une modification à votre formulaire, n'hésitez pas à contacter notre équipe.
            </p>

            <div className="flex flex-col sm:flex-row gap-[12px] w-full">
              <a
                href="mailto:info@soumissionconfort.com"
                className="flex w-full sm:flex-1 h-[56px] items-center justify-center px-[32px] border-2 border-[#002042] rounded-full"
              >
                <span className="font-bold text-[18px] text-[#002042] leading-none whitespace-nowrap">
                  Écrivez-nous
                </span>
              </a>
              <a
                href="tel:+14387994670"
                className="flex w-full sm:flex-1 h-[56px] items-center justify-center px-[32px] bg-[#b9e15c] border-2 border-[#002042] rounded-full shadow-[-2px_4px_0px_0px_#002042]"
              >
                <span className="font-bold text-[18px] text-[#002042] leading-none whitespace-nowrap">
                  Appelez-nous
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* ── Exemple de rapport ── */}
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
                Selon votre échéancier,{" "}
                <strong className="font-bold text-[#375371]">3 entrepreneurs qualifiés</strong>{" "}
                sont prêts à vous soumettre une proposition.
                <br />
                Nous les contactons dès maintenant pour confirmer leur disponibilité pour votre projet.
              </p>
            </div>

            {/* 3 entrepreneur cards */}
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

        {/* ── Retourner à l'accueil ── */}
        <Link
          href="/soumission-rapide"
          className="flex h-[56px] items-center justify-center px-[32px] border-2 border-[#002042] rounded-full w-full"
        >
          <span
            className="font-bold text-[18px] text-[#002042] leading-none whitespace-nowrap"
            style={{ fontFamily: "'Source Serif Pro', serif" }}
          >
            Retourner à l'accueil
          </span>
        </Link>

      </div>
    </div>
  )
}
