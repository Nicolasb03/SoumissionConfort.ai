import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { municipalities, getMunicipalityBySlug } from "@/lib/municipalities"
import { SoumissionRapideLanding } from "./landing"

interface PageProps {
  params: Promise<{ ville: string }>
}

export async function generateStaticParams() {
  return municipalities.map((m) => ({ ville: m.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ville } = await params
  const municipality = getMunicipalityBySlug(ville)
  if (!municipality) return {}

  const title = `Soumission Isolation à ${municipality.name} | 3 Soumissions Gratuites d'Entrepreneurs Certifiés`
  const description = `Comparez 3 soumissions d'entrepreneurs en isolation certifiés RBQ à ${municipality.name}. Service gratuit, entrepreneurs vérifiés et interviewés par notre équipe. Subventions disponibles. Réponse en moins de 48h.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://soumissionconfort.com/soumission-rapide/${ville}`,
      siteName: "Soumission Confort",
      locale: "fr_CA",
      type: "website",
    },
    robots: { index: true, follow: true },
    alternates: {
      canonical: `https://soumissionconfort.com/soumission-rapide/${ville}`,
    },
  }
}

export default async function SoumissionRapidePage({ params }: PageProps) {
  const { ville } = await params
  const municipality = getMunicipalityBySlug(ville)
  if (!municipality) notFound()

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Soumission Confort",
    description: `Service de soumission d'isolation gratuit à ${municipality.name}. Entrepreneurs certifiés RBQ, vérifiés et interviewés.`,
    url: `https://soumissionconfort.com/soumission-rapide/${ville}`,
    areaServed: {
      "@type": "City",
      name: municipality.name,
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
      <SoumissionRapideLanding municipality={municipality} />
    </>
  )
}
