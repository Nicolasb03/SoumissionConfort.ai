import type { Metadata } from "next"
import { SoumissionRapideLandingGeneric } from "./landing-generic"

export const metadata: Metadata = {
  title: "Soumission Isolation | 3 Soumissions Gratuites d'Entrepreneurs Certifiés au Québec",
  description:
    "Comparez 3 soumissions d'entrepreneurs en isolation certifiés RBQ au Québec. Service gratuit, entrepreneurs vérifiés et interviewés par notre équipe. Subventions disponibles. Réponse en moins de 48h.",
  openGraph: {
    title: "Soumission Isolation | 3 Soumissions Gratuites d'Entrepreneurs Certifiés au Québec",
    description:
      "Comparez 3 soumissions d'entrepreneurs en isolation certifiés RBQ au Québec. Service gratuit, entrepreneurs vérifiés et interviewés par notre équipe. Subventions disponibles. Réponse en moins de 48h.",
    url: "https://soumissionconfort.com/soumission-rapide",
    siteName: "Soumission Confort",
    locale: "fr_CA",
    type: "website",
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: "https://soumissionconfort.com/soumission-rapide",
  },
}

export default function SoumissionRapidePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Soumission Confort",
    description:
      "Service de soumission d'isolation gratuit au Québec. Entrepreneurs certifiés RBQ, vérifiés et interviewés.",
    url: "https://soumissionconfort.com/soumission-rapide",
    areaServed: {
      "@type": "State",
      name: "Québec",
      containedInPlace: {
        "@type": "Country",
        name: "Canada",
      },
    },
    serviceType: [
      "Soumission isolation gratuite",
      "Isolation de combles",
      "Isolation thermique",
      "Entrepreneur certifié RBQ",
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      reviewCount: "1247",
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SoumissionRapideLandingGeneric />
    </>
  )
}
