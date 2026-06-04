import { type NextRequest, NextResponse } from 'next/server'
import { MetaConversionAPI } from '@/lib/meta-conversion-api'
import {
  META_CONFIG_SOUMISSIONCONFORT,
  isSoumissionConfortMetaConfigured,
} from '@/lib/meta-config'

// CAPI ViewContent for the /analysis wizard → dedicated soumissionconfort
// pixel only. Browser fbq fires the matching ViewContent with the same eventId
// (see user-questionnaire-wizard.tsx) so Meta dedups to a single event.
//
// Skips silently when the dedicated pixel isn't configured yet (placeholder
// rollout window) — never falls back to the shared pixel.
export async function POST(request: NextRequest) {
  if (!isSoumissionConfortMetaConfigured()) {
    console.warn('[view-content] Meta CAPI not configured for soumissionconfort (skip)')
    return NextResponse.json({ skipped: true })
  }

  try {
    const { eventId, sourceUrl, address, fbp, fbc } = await request.json()
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]
      || request.headers.get('x-real-ip')
      || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    const metaAPI = new MetaConversionAPI(
      META_CONFIG_SOUMISSIONCONFORT.PIXEL_ID,
      META_CONFIG_SOUMISSIONCONFORT.ACCESS_TOKEN,
      META_CONFIG_SOUMISSIONCONFORT.TEST_EVENT_CODE,
    )

    const result = await metaAPI.trackViewContent({
      eventId,
      sourceUrl,
      clientIp,
      userAgent,
      contentName: 'analysis-wizard-v2',
      contentType: 'isolation',
      searchString: address,
      fbp,
      fbc,
    })
    // Surface a silent CAPI failure (expired token, pixel not found) instead of
    // swallowing it — otherwise ViewContent dies invisibly (incident 2026-06-03).
    if (!result?.success) {
      console.error('[view-content] Meta CAPI ViewContent FAILED', { eventId, error: result?.error })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[view-content] CAPI error', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
