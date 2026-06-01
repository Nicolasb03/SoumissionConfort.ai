"use client"

import { useEffect, useRef } from 'react'
import Script from 'next/script'
import { usePathname } from 'next/navigation'

// Phase 2 V2 — route-aware Meta Pixel loader.
//
// One <MetaPixelRouter /> is mounted once in app/layout.tsx. It guarantees the
// invariant: a PageView fires to EXACTLY ONE pixel per route, and the dedicated
// soumissionconfort pixel ONLY ever sees the isolation /analysis funnel.
//   - /analysis*                          → dedicated pixel
//   - /pricing                            → dedicated pixel (iso results page)
//   - /verifier-telephone (analysis only) → dedicated pixel
//   - everything else                     → shared Niku pixel (status quo)
//
// /pricing is the isolation results page (InsulationResults). It's reached ONLY
// from the analysis lead form (lead-capture-form.tsx redirects there post-OTP),
// so unlike /verifier-telephone it's classified by pathname alone — no source
// marker needed, no cross-funnel ambiguity. Without this, the bottom-funnel
// results PageView would leak onto the shared pixel (otp-verify is already
// cleared by the time we land here, so a session-marker gate wouldn't work).
//
// /verifier-telephone is SHARED across funnels (analysis, thermopompes,
// subventions all router.push there). Classifying it by pathname alone would
// leak HVAC/subvention OTP PageViews onto the dedicated pixel. So we gate it on
// sessionStorage `otp-verify.source === 'analysis'`, which only the analysis
// lead form sets (components/lead-capture-form.tsx). Zero cross-funnel
// contamination: a thermopompe lead on /verifier-telephone never sets that
// flag → stays on the shared pixel.
//
// Why trackSingle (not two <Script> blocks): the fbq bootstrap starts with
// `if(f.fbq)return`, so a second `fbq('init', X)` ADDS a pixel rather than
// replacing it, and a plain `fbq('track', 'PageView')` then fires to BOTH
// pixels. We init each pixel once and fire every PageView with
// `trackSingle(<pixelId>, ...)` to the route's pixel only.

// Canal partagé Niku DÉSACTIVÉ (isolation 2026-06) : seul le funnel /analysis
// (pixel dédié) alimente Meta. On force cette constante à vide — NE PAS relire
// process.env.NEXT_PUBLIC_META_PIXEL_ID ici. Effet : tous les call-sites des
// autres funnels (thermopompes/subventions/soumission-rapide) qui gardent un
// guard `META_PIXEL_PARTAGE && !isPlaceholder(...)` deviennent no-op, SANS
// dépendre de la valeur de la var d'env Vercel (protection permanente, lisible
// dans le code). Le routing PageView, le bootstrap et le noscript ci-dessous se
// neutralisent seuls puisque isPlaceholder('') === true.
export const META_PIXEL_PARTAGE = ''
const PIXEL_PARTAGE = META_PIXEL_PARTAGE
// Exported so the wizard ViewContent + post-OTP Lead can target the dedicated
// pixel with trackSingle (browser dedup vs CAPI).
export const META_PIXEL_DEDIE = process.env.NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT || ''

function isPlaceholder(v: string): boolean {
  return !v || /^X+$/i.test(v)
}

// True for routes that are UNCONDITIONALLY part of the analysis funnel (the
// wizard pages + the /pricing results page). /verifier-telephone is handled
// separately because it's shared across funnels.
export function isAnalysisWizardRoute(pathname: string): boolean {
  return pathname === '/analysis'
    || pathname.startsWith('/analysis/')
    || pathname === '/pricing'
}

// Reads the OTP source marker the analysis lead form stamps in sessionStorage.
// Only meaningful on /verifier-telephone, and only client-side.
function otpSourceIsAnalysis(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = sessionStorage.getItem('otp-verify')
    if (!raw) return false
    return JSON.parse(raw)?.source === 'analysis'
  } catch {
    return false
  }
}

// Whether the CURRENT route belongs to the isolation /analysis funnel and so
// should load the dedicated pixel. Must run client-side (reads sessionStorage).
export function inAnalysisFunnelClient(pathname: string): boolean {
  if (isAnalysisWizardRoute(pathname)) return true
  if (pathname === '/verifier-telephone') return otpSourceIsAnalysis()
  return false
}

export function MetaPixelRouter() {
  const pathname = usePathname()
  // Track which pixels we've already `init`-ed so we never double-init.
  const initedRef = useRef<Set<string>>(new Set())
  // Guard against StrictMode double-effect / duplicate PageView per route.
  const lastPageViewRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.fbq !== 'function') return

    const inFunnel = inAnalysisFunnelClient(pathname)
    // Strict guard (Zack v2 décision 5): on the /analysis funnel, if the
    // dedicated pixel is missing/placeholder, fire NOTHING — never leak the
    // funnel onto the shared pixel during rollout.
    const pixelForRoute = inFunnel ? META_PIXEL_DEDIE : PIXEL_PARTAGE
    if (isPlaceholder(pixelForRoute)) return

    // Init this pixel once (idempotent across navigations).
    if (!initedRef.current.has(pixelForRoute)) {
      // Disable Meta's automatic event detection (button/form clicks etc.) for
      // this pixel — we only want the events we fire explicitly. Without this,
      // the pixel emits auto events like `SubscribedButtonClick`. Set BEFORE
      // init so it applies from the first event.
      window.fbq('set', 'autoConfig', false, pixelForRoute)
      window.fbq('init', pixelForRoute)
      initedRef.current.add(pixelForRoute)
    }

    // Fire PageView to THIS pixel only — never the other one. The dedupe key
    // pins it to (pixel, pathname) so StrictMode's double effect doesn't send
    // two PageViews for the same route in dev.
    const pageViewKey = `${pixelForRoute}:${pathname}`
    if (lastPageViewRef.current !== pageViewKey) {
      lastPageViewRef.current = pageViewKey
      window.fbq('trackSingle', pixelForRoute, 'PageView')
    }
  }, [pathname])

  // The bootstrap snippet loads the fbq library exactly once for the whole
  // app. We deliberately do NOT call fbq('init'/'track') inside it — the
  // useEffect above owns init + PageView so the single-pixel invariant holds
  // on every route, including the very first paint.
  if (isPlaceholder(PIXEL_PARTAGE) && isPlaceholder(META_PIXEL_DEDIE)) return null

  return (
    <>
      <Script id="meta-pixel-bootstrap" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
        `}
      </Script>
      {/* noscript fallback uses the shared pixel — the no-JS case never reaches
          the SPA /analysis funnel anyway (no wizard, no lead form). */}
      {!isPlaceholder(PIXEL_PARTAGE) && (
        <noscript>
          <img height="1" width="1" style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${PIXEL_PARTAGE}&ev=PageView&noscript=1`} alt="" />
        </noscript>
      )}
    </>
  )
}
