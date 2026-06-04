import { META_PIXEL_DEDIE } from '@/components/meta-pixel-router'
import { toMetaPhone } from '@/lib/phone'

declare global {
  interface Window {
    fbq: (...args: any[]) => void
  }
}

// Browser-side Lead with manual Advanced Matching (EMQ uplift, 2026-06).
//
// The browser Lead used to send NO user_data (only value/currency/service_type),
// so Meta could only match on cookies → low Event Match Quality. Meta's manual
// advanced matching is set PER PIXEL via `fbq('init', pixelId, userData)` (stored
// in pixelsByID[pixelId].userData) and read by the NEXT trackSingle — it is NOT
// passed inside the event's custom_data. So we re-init the dedicated pixel with
// {em, ph, fn, ln} right before firing, then trackSingle the Lead. fbevents hashes
// em/ph/fn/ln client-side itself, so we pass them in clear (lowercased/E.164) — no
// manual SHA-256 here. Re-init only updates the matching data; it fires no PageView
// (disablePushState is already set, autoConfig already false) so it's side-effect free.
//
// The SAME eventId must be passed here and to the CAPI Lead (/api/leads) so Meta
// dedups browser↔CAPI to one Lead — callers own that id; we just forward it.
export function fireBrowserLead(params: {
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  value?: number
  eventId?: string
}): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
  // Mirror the dedicated-pixel guard used at every fbq call-site: never fire when
  // the pixel id is missing or the XXXXXX placeholder.
  if (!META_PIXEL_DEDIE || /^X+$/i.test(META_PIXEL_DEDIE)) return

  // Build advanced matching with only the fields we actually have. Phone in Meta's
  // canonical digits-only form (toMetaPhone) — the exact string fbevents hashes —
  // so the browser hash and the CAPI hash match for the same lead.
  const am: Record<string, string> = {}
  const em = params.email?.trim().toLowerCase()
  if (em) am.em = em
  const ph = toMetaPhone(params.phone)
  if (ph) am.ph = ph
  const fn = params.firstName?.trim().toLowerCase()
  if (fn) am.fn = fn
  const ln = params.lastName?.trim().toLowerCase()
  if (ln) am.ln = ln
  // external_id mirrors the CAPI Lead (route.ts sends external_id = sha256(email)).
  // Passed in clear — fbevents hashes it client-side — so the browser event carries
  // the SAME matching key as its CAPI dedup partner.
  if (em) am.external_id = em

  if (Object.keys(am).length > 0) {
    window.fbq('init', META_PIXEL_DEDIE, am)
  }

  window.fbq(
    'trackSingle',
    META_PIXEL_DEDIE,
    'Lead',
    { value: (params.value ?? 0).toFixed(2), currency: 'CAD', service_type: 'isolation' },
    params.eventId ? { eventID: params.eventId } : undefined,
  )
}

// Reads the _fbp / _fbc cookies fbevents.js sets (non-httpOnly) so they can be
// forwarded to the server CAPI Lead. The browser already sends fbp/fbc with its
// own events, so the CAPI Lead must send the SAME values to match/dedup against
// it — server-side getClientInfo() can't read them. Returns only present keys.
export function getMetaBrowserCookies(): { fbp?: string; fbc?: string } {
  if (typeof document === 'undefined') return {}
  const read = (name: string): string | undefined => {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
    return m ? decodeURIComponent(m[1]) : undefined
  }
  const out: { fbp?: string; fbc?: string } = {}
  const fbp = read('_fbp')
  if (fbp) out.fbp = fbp
  const fbc = read('_fbc')
  if (fbc) out.fbc = fbc
  return out
}
