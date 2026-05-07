// GHL API client used by the Vercel routes when GHL_ENABLED=true.
//
// Architecture: Vercel form handler → postLeadToGHL() → GoHighLevel.
// Replaces the legacy Vercel → Make → Close path. Make is bypassed entirely
// for the lead entry; the qualification webhook (GHL stage "Qualifié" → Make
// → LeadProsper) is configured in the GHL workflow, not here.
//
// Multi-tenant: dispatch by `vertical` so iso leads (iso/rapide/subvention)
// land in the "Soumission Confort Iso" sub-account while HVAC stays in the
// legacy "Powerflow Leads" sub-account. Custom field IDs are per-location, so
// each sub-account has its own field map.
//
// Flag: process.env.GHL_ENABLED === 'true'
// Required env (HVAC):     GHL_API_KEY,     GHL_LOCATION_ID
// Required env (Iso):      GHL_API_KEY_ISO, GHL_LOCATION_ID_ISO
// Rate limit: GHL allows ~100 req / 10s per location. Each lead = 1-2 calls.
import { GHL_FIELDS_HVAC } from './ghl-fields-hvac'
import { GHL_FIELDS_ISO } from './ghl-fields-iso'
import type { GHLFieldDef, LeadVertical } from './ghl-fields'

export type { LeadVertical } from './ghl-fields'

const GHL_BASE = 'https://services.leadconnectorhq.com'
const GHL_VERSION = '2021-07-28'

export interface NormalizedLead {
  vertical: LeadVertical
  // Contact
  firstName: string
  lastName: string
  email: string
  phone: string
  // Address
  address1?: string
  city?: string
  state?: string
  postalCode?: string
  // UTM / attribution
  utmSource?: string
  utmCampaign?: string
  utmContent?: string
  utmMedium?: string
  utmTerm?: string
  fbclid?: string
  landingPage?: string
  leadSource?: string
  // Vertical-specific custom fields (best-effort; absent fields silently dropped)
  custom?: Record<string, unknown>
  // Optional: stamp for traceability inside GHL
  internalLeadId?: string
  // Optional notes appended on creation
  noteBody?: string
}

interface GHLContactPayload {
  locationId: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address1?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  source?: string
  tags?: string[]
  customFields?: { id: string; field_value: unknown }[]
}

const VERTICAL_TAG: Record<LeadVertical, string> = {
  roofing: 'Lead',
  isolation: 'Lead Iso',
  isolation_soumission_rapide: 'Lead Iso',
  subvention: 'Lead Iso',
  hvac: 'Lead HVAC',
}

interface GHLConfig {
  apiKey?: string
  locationId?: string
  fields: Record<string, GHLFieldDef>
}

// Dispatch GHL credentials + field map by lead vertical.
// HVAC/roofing → legacy "Powerflow Leads". Everything else → new iso sub-account.
function getGHLConfig(vertical: LeadVertical): GHLConfig {
  if (vertical === 'hvac' || vertical === 'roofing') {
    return {
      apiKey: process.env.GHL_API_KEY,
      locationId: process.env.GHL_LOCATION_ID,
      fields: GHL_FIELDS_HVAC,
    }
  }
  return {
    apiKey: process.env.GHL_API_KEY_ISO,
    locationId: process.env.GHL_LOCATION_ID_ISO,
    fields: GHL_FIELDS_ISO,
  }
}

export function isGHLEnabled(): boolean {
  return process.env.GHL_ENABLED === 'true'
}

function buildContactPayload(
  lead: NormalizedLead,
  locationId: string,
  fields: Record<string, GHLFieldDef>,
): GHLContactPayload {
  const customFields: { id: string; field_value: unknown }[] = []
  const push = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return
    const def = fields[key]
    if (def) customFields.push({ id: def.id, field_value: value })
  }

  // Map UTM/attribution to known GHL fields
  push('utm_source', lead.utmSource)
  push('campaign_name', lead.utmCampaign)
  push('ad_name', lead.utmContent)
  push('fbclid', lead.fbclid)
  push('landing_page', lead.landingPage)
  push('lead_source', lead.leadSource)
  push('ville', lead.city)
  push('code_postal', lead.postalCode)

  // Vertical-specific fields — silently skip ones not in the map
  for (const [key, value] of Object.entries(lead.custom ?? {})) {
    push(key, value)
  }

  return {
    locationId,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    address1: lead.address1,
    city: lead.city,
    state: lead.state || 'QC',
    postalCode: lead.postalCode,
    country: 'CA',
    source: lead.leadSource ?? lead.utmSource ?? 'vercel-direct',
    tags: [VERTICAL_TAG[lead.vertical]],
    customFields,
  }
}

interface GHLResponse<T> {
  ok: boolean
  status: number
  body: T | null
  error?: string
}

async function ghlRequest<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
  retries = 3,
): Promise<GHLResponse<T>> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${GHL_BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: GHL_VERSION,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(15000),
      })
      const text = await res.text()
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries - 1) {
          await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)))
          continue
        }
        return { ok: false, status: res.status, body: null, error: text }
      }
      if (!res.ok) return { ok: false, status: res.status, body: null, error: text }
      const body = text ? (JSON.parse(text) as T) : (null as T | null)
      return { ok: true, status: res.status, body }
    } catch (err) {
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)))
        continue
      }
      return {
        ok: false,
        status: 0,
        body: null,
        error: err instanceof Error ? err.message : 'unknown',
      }
    }
  }
  return { ok: false, status: 0, body: null, error: 'retries exhausted' }
}

export interface GHLPostResult {
  contactId: string | null
  duplicate: boolean
  contactStatus: number
  contactError?: string
}

/**
 * Push a lead to the GHL sub-account selected by `lead.vertical`. Creates the
 * contact (or surfaces the duplicate id) and returns enough info for the
 * caller to log/return.
 *
 * Tags drive the GHL workflows ("Lead Optin Toiture/Iso/HVAC") which create
 * the opportunity in the right pipeline + stage and notify Slack/setters.
 * The route does NOT need to call /opportunities directly.
 */
export async function postLeadToGHL(lead: NormalizedLead): Promise<GHLPostResult> {
  const { apiKey, locationId, fields } = getGHLConfig(lead.vertical)
  if (!apiKey || !locationId) {
    return {
      contactId: null,
      duplicate: false,
      contactStatus: 0,
      contactError: `GHL credentials missing for vertical=${lead.vertical}`,
    }
  }

  const payload = buildContactPayload(lead, locationId, fields)

  // Use /contacts/upsert (vs /contacts/) so duplicates are merged into the
  // existing contact instead of returning 400/422. The endpoint returns
  // { contact, new: boolean } — `new: false` means duplicate-merged.
  // Docs: https://marketplace.gohighlevel.com/docs/ghl/contacts/upsert-contact/index.html
  const created = await ghlRequest<{ contact: { id: string }; new?: boolean }>(
    apiKey,
    '/contacts/upsert',
    { method: 'POST', body: JSON.stringify(payload) },
  )

  if (!created.ok) {
    return {
      contactId: null,
      duplicate: false,
      contactStatus: created.status,
      contactError: created.error,
    }
  }

  const contactId = created.body?.contact?.id ?? null
  const duplicate = created.body?.new === false

  // Optional: append note (e.g. quote_request signal)
  if (contactId && lead.noteBody) {
    await ghlRequest(apiKey, `/contacts/${contactId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body: lead.noteBody }),
    })
  }

  return { contactId, duplicate, contactStatus: created.status }
}

/**
 * Look up a GHL contact by email in the sub-account selected by `vertical`.
 * Returns the first match or null. Used by /api/leads/update which only
 * serves the isolation funnel (default vertical='isolation').
 */
export async function findGHLContactByEmail(
  email: string,
  vertical: LeadVertical = 'isolation',
): Promise<{ id: string } | null> {
  const { apiKey, locationId } = getGHLConfig(vertical)
  if (!apiKey || !locationId || !email) return null
  const res = await ghlRequest<{ contact: { id: string } | null; contacts?: { id: string }[] }>(
    apiKey,
    `/contacts/search/duplicate?locationId=${locationId}&email=${encodeURIComponent(email)}`,
  )
  if (!res.ok || !res.body) return null
  if (res.body.contact?.id) return { id: res.body.contact.id }
  if (res.body.contacts && res.body.contacts.length > 0) return { id: res.body.contacts[0].id }
  return null
}

/**
 * Append a free-form note to a GHL contact. Used by /api/leads/update when
 * the user clicks "demande soumission précise" from the pricing calculator.
 * Default vertical='isolation' since the calculator is iso-only.
 */
export async function appendGHLNote(
  contactId: string,
  body: string,
  vertical: LeadVertical = 'isolation',
): Promise<boolean> {
  const { apiKey } = getGHLConfig(vertical)
  if (!apiKey || !contactId) return false
  const res = await ghlRequest(apiKey, `/contacts/${contactId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
  return res.ok
}

/**
 * Add a tag to a GHL contact. Used to flag a lead as "Demande 3 soumissions"
 * when the client clicks the precise-quote CTA on the pricing calculator —
 * this triggers a downstream GHL workflow that moves the opportunity to the
 * "ask for 3 soumissions" stage. Default vertical='isolation'.
 *
 * Endpoint: POST /contacts/{contactId}/tags
 * Body: { tags: [string, ...] }
 * Idempotent: GHL silently ignores duplicates if the tag is already present.
 */
export async function addGHLContactTag(
  contactId: string,
  tag: string,
  vertical: LeadVertical = 'isolation',
): Promise<boolean> {
  const { apiKey } = getGHLConfig(vertical)
  if (!apiKey || !contactId || !tag) return false
  const res = await ghlRequest(apiKey, `/contacts/${contactId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags: [tag] }),
  })
  return res.ok
}
