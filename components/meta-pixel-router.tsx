"use client"

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { usePathname } from 'next/navigation'

// Phase 2 V2 — route-aware Meta Pixel loader.
//
// One <MetaPixelRouter /> is mounted once in app/layout.tsx. It guarantees the
// invariant: the dedicated soumissionconfort pixel ONLY ever sees the isolation
// funnel, and a PageView fires EXACTLY ONCE per session — owed by the FIRST
// dedicated-pixel route the visitor hits (the funnel entry), then flushed once.
//   - '/' (home, address entry)           → dedicated pixel: INIT, owes the PageView
//   - /analysis*                          → dedicated pixel: INIT (owes it if entered here)
//   - /pricing                            → dedicated pixel: INIT (owes it if entered here)
//   - /verifier-telephone (analysis only) → dedicated pixel: INIT (owes it if entered here)
//   - everything else                     → shared Niku pixel (status quo, '')
//
// The PageView is tied to the funnel VISIT, not to a single route: the first
// dedicated route owes it (so a visitor entering via '/', a deep-link to
// /analysis, or a Toiture landing page that pushes into /analysis all get
// exactly one), and it's flushed as soon as fbq is live — on whatever route the
// visitor is on by then. Normal flow: '/' owes it and it fires on '/'. Once
// fired, no route fires another. Two things make this exact:
//   1. disablePushState — fbevents auto-fires a PageView on every history
//      pushState (SPA nav) by default; we turn that off and emit the one
//      PageView ourselves, so route changes add nothing.
//   2. the fired-flag debt — survives a fast nav before fbq boots and dedups
//      StrictMode / re-renders, so it's never lost and never duplicated.
// The funnel routes still INIT regardless because the wizard ViewContent
// (user-questionnaire-wizard.tsx) and post-OTP Lead (verifier-telephone/
// page.tsx) call fbq('trackSingle', META_PIXEL_DEDIE, ...) directly.
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

// '/' (home iso) is the single Meta PageView entry point — the page with the
// address field, where the visitor "arrives". It's NOT part of the bottom
// funnel (no wizard, no lead form) so it's classified separately from
// inAnalysisFunnelClient: PageView fires here and ONLY here, while the funnel
// routes init the pixel without emitting a PageView.
export function isPixelEntryPoint(pathname: string): boolean {
  return pathname === '/'
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
  // The isolation funnel owes EXACTLY ONE PageView, captured as a debt the first
  // time the visitor hits ANY dedicated-pixel route — the home '/', a deep-link
  // to /analysis, or a landing page (e.g. /urgence-toiture, /couvreur-shawinigan)
  // that pushes into /analysis. It's flushed once, as soon as fbq is live, even
  // if the visitor navigated on before fbq booted. Tying it to the funnel VISIT
  // (not the pathname at fbq-ready time) is what keeps it exactly-once and never
  // lost. Non-funnel routes never set the debt → never fire a PageView.
  const funnelPageViewPendingRef = useRef(false)
  const funnelPageViewFiredRef = useRef(false)
  // fbq is bootstrapped by an afterInteractive <Script> that may execute AFTER
  // this effect's first run. onReady flips this flag → the effect re-runs once
  // fbq is live so the owed PageView can flush (the cold-load route is exactly
  // where fbq is least likely to be ready in time, so this must be robust).
  const [fbqReady, setFbqReady] = useState(false)

  useEffect(() => {
    // Capture the funnel-entry PageView debt the moment we land on any
    // dedicated-pixel route, regardless of fbq readiness (pure check, no window
    // needed). It survives navigation away, so a visitor who leaves before fbq
    // boots still gets exactly one PageView.
    const onDedicatedRoute = isPixelEntryPoint(pathname) || inAnalysisFunnelClient(pathname)
    if (onDedicatedRoute && !funnelPageViewFiredRef.current) {
      funnelPageViewPendingRef.current = true
    }

    if (typeof window === 'undefined' || typeof window.fbq !== 'function') return

    // Disable fbevents' automatic PageView on SPA history pushState. By default
    // the library fires a PageView on EVERY history.pushState (every client
    // route change), which would re-add one PageView per funnel route —
    // precisely what this change removes. We own the single PageView explicitly
    // (funnel debt, below), so the automatic one must be off. Set before the
    // first fbq('init'). Ref: https://developers.facebook.com/docs/meta-pixel/get-started/
    const fbqWithFlags = window.fbq as unknown as { disablePushState?: boolean }
    fbqWithFlags.disablePushState = true

    // The dedicated pixel must be live on dedicated routes (the wizard
    // ViewContent + post-OTP Lead target META_PIXEL_DEDIE directly), AND on any
    // route while we still owe the PageView (so it can flush even after the
    // visitor left the route that owed it). Everything else → PIXEL_PARTAGE ('').
    const needsDedicated = onDedicatedRoute || funnelPageViewPendingRef.current
    const pixelForRoute = needsDedicated ? META_PIXEL_DEDIE : PIXEL_PARTAGE
    // Strict guard (Zack v2 décision 5): if the dedicated pixel is missing/
    // placeholder, fire NOTHING — never leak onto the shared pixel.
    if (isPlaceholder(pixelForRoute)) return

    // Init once (idempotent). Disable Meta's auto-event detection BEFORE init so
    // no `SubscribedButtonClick`-style auto events leak — we fire only what we
    // emit explicitly.
    if (!initedRef.current.has(pixelForRoute)) {
      window.fbq('set', 'autoConfig', false, pixelForRoute)
      window.fbq('init', pixelForRoute)
      initedRef.current.add(pixelForRoute)
    }

    // Flush the owed funnel-entry PageView EXACTLY ONCE, as soon as fbq is live.
    // It fires on whatever route the visitor is on now (covers the cold-load
    // race where fbq boots after they left the entry route). The fired-flag
    // guarantees exactly-once across StrictMode / re-renders / SPA nav.
    if (funnelPageViewPendingRef.current && !funnelPageViewFiredRef.current) {
      funnelPageViewFiredRef.current = true
      funnelPageViewPendingRef.current = false
      window.fbq('trackSingle', META_PIXEL_DEDIE, 'PageView')
    }
  }, [pathname, fbqReady])

  // The bootstrap snippet loads the fbq library exactly once for the whole
  // app. We deliberately do NOT call fbq('init'/'track') inside it — the
  // useEffect above owns init + PageView so the single-pixel invariant holds
  // on every route, including the very first paint.
  if (isPlaceholder(PIXEL_PARTAGE) && isPlaceholder(META_PIXEL_DEDIE)) return null

  return (
    <>
      <Script id="meta-pixel-bootstrap" strategy="afterInteractive" onReady={() => setFbqReady(true)}>
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
