import type React from "react"
import type { Metadata, Viewport } from "next"
import { Radio_Canada_Big, Source_Serif_4 } from 'next/font/google'
import "./globals.css"
import { LanguageProvider } from "@/lib/language-context"
import { Analytics } from "@vercel/analytics/next"
import { MetaPixelRouter } from "@/components/meta-pixel-router"

const radioCanadaBig = Radio_Canada_Big({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-radio-canada",
})

const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source-serif",
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "Soumission Confort - Estimation Gratuite d'Isolation d'Entretoit au Québec",
  description: "Obtenez votre estimation gratuite d'isolation d'entretoit en 60 secondes. Connectez-vous avec des entrepreneurs certifiés RBQ. Économisez jusqu'à 30% sur vos factures de chauffage. Subventions disponibles avec Hydro-Québec et RénoClimat.",
  generator: 'v0.dev',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
  },
  openGraph: {
    title: "Soumission Confort - Estimation Gratuite d'Isolation d'Entretoit au Québec",
    description: "Obtenez votre estimation gratuite d'isolation d'entretoit en 60 secondes. Connectez-vous avec des entrepreneurs certifiés RBQ. Économisez jusqu'à 30% sur vos factures de chauffage. Subventions disponibles avec Hydro-Québec et RénoClimat.",
    url: 'https://soumissionconfort.ai',
    siteName: 'Soumission Confort',
    locale: 'fr_CA',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Soumission Confort",
    "description": "Estimation gratuite d'isolation d'entretoit au Québec. Entrepreneurs certifiés RBQ, subventions disponibles avec Hydro-Québec, LogisVert et RénoClimat.",
    "url": "https://soumissionconfort.ai",
    "telephone": "+1-800-CONFORT",
    "priceRange": "$$",
    "areaServed": [
      {
        "@type": "State",
        "name": "Québec"
      },
      {
        "@type": "City", 
        "name": "Shawinigan"
      },
      {
        "@type": "City",
        "name": "Magog" 
      },
      {
        "@type": "City",
        "name": "Saguenay"
      }
    ],
    "serviceType": [
      "Isolation d'entretoit",
      "Estimation isolation gratuite", 
      "Isolation soufflée",
      "Isolation cellulose",
      "Amélioration efficacité énergétique",
      "Subventions isolation Hydro-Québec",
      "Programme RénoClimat",
      "Programme LogisVert"
    ],
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Services d'isolation d'entretoit",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Isolation d'entretoit soufflée",
            "description": "Installation d'isolation cellulose ou fibre de verre soufflée pour améliorer l'efficacité énergétique"
          }
        },
        {
          "@type": "Offer", 
          "itemOffered": {
            "@type": "Service",
            "name": "Estimation gratuite d'isolation",
            "description": "Évaluation instantanée avec 3 gammes de prix et calcul des économies d'énergie"
          }
        },
        {
          "@type": "Offer", 
          "itemOffered": {
            "@type": "Service",
            "name": "Aide aux subventions",
            "description": "Accompagnement pour obtenir les subventions Hydro-Québec, LogisVert et RénoClimat"
          }
        }
      ]
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "1247"
    }
  }

  return (
    <html lang="fr">
      <head>
        <meta charSet="UTF-8" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        
        {/* Microsoft Clarity */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "vu4thg0sdp");
            `
          }}
        />

        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-PZ68WM5V36"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-PZ68WM5V36');
            `
          }}
        />

      </head>
      <body className={`${radioCanadaBig.variable} ${sourceSerif4.variable}`}>
        {/* Route-aware Meta Pixel: shared Niku pixel everywhere, dedicated
            soumissionconfort pixel on the /analysis funnel only (Phase 2 V2).
            Replaces the old inline <script> that loaded a single pixel. */}
        <MetaPixelRouter />
        <LanguageProvider>{children}</LanguageProvider>
        <Analytics />
      </body>
    </html>
  )
}
