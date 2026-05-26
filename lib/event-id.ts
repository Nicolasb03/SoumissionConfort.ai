import { normalizePhone } from './phone'

// Deterministic Meta event_id derived from (phone, email, vertical) so the
// same user re-submitting the SAME funnel within Meta's 48h dedup window
// collapses to a single counted Lead — both for Pixel↔CAPI sync AND for
// repeat submissions. After 48h, the same input is treated as a new event
// (intentional: it's a real re-engagement worth counting).
//
// `vertical` is included in the hash so cross-funnel conversions stay
// distinct: a user who converts on isolation and later on thermopompes
// produces TWO different event_ids → Meta counts them as 2 Lead events on
// their respective ad campaigns instead of collapsing into 1.
//
// Phone is normalized to E.164 before hashing so visually-different but
// equivalent inputs ("514-555-1234" vs "(514) 555-1234" vs "+15145551234")
// collapse to the same id — without this the dedup silently fragments by
// format. Falls back to a trimmed lowercase string if normalization fails
// (validation upstream should have caught it; defensive only).
//
// Used by both client funnels (browser) and the /api/leads server route, so
// the value is consistent across Pixel and CAPI fires for the same person.
export async function computeLeadEventId(
  phone: string,
  email: string,
  vertical: string,
): Promise<string> {
  const normalizedPhone = normalizePhone(phone) ?? phone.toLowerCase().trim()
  const input = `powerflow|${vertical.toLowerCase().trim()}|${normalizedPhone}|${email.toLowerCase().trim()}`
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 32)
}
