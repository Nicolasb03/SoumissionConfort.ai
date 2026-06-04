/**
 * Quebec phone validation and normalization.
 *
 * Accepted area codes (per CRTC, including current overlays) :
 *   - Quebec :
 *       Montreal           : 514, 438, 263
 *       Surrounding QC     : 450, 579, 354
 *       Quebec City + East : 418, 581, 468
 *       Outaouais/Mauricie : 819, 873
 *       Province-wide      : 367
 *   - Outaouais cross-border (many Gatineau residents use ON numbers) :
 *       Ottawa region      : 613, 343, 753
 *
 * Accepted shapes :
 *   514-555-1234, (514) 555-1234, 514.555.1234, 5145551234,
 *   1 514 555 1234, +1 (514) 555-1234, +15145551234, etc.
 *
 * Rejected :
 *   anything with letters, fewer than 10 digits, central office code
 *   starting 0 or 1, any non-QC/non-Outaouais NANP area code (e.g.
 *   `212-555-1234` from NYC fails — not a typo we want in our CRM).
 */

const QC_AREA_CODES = [
  // Quebec
  '263', '354', '367', '418', '438', '450', '468', '514', '579', '581', '819', '873',
  // Outaouais cross-border (ON side, locally Gatineau region)
  '343', '613', '753',
] as const

const QC_AREA_CODE_GROUP = `(?:${QC_AREA_CODES.join('|')})`

const QC_PHONE_REGEX = new RegExp(
  `^(?:\\+?1[\\s.-]?)?\\(?(${QC_AREA_CODE_GROUP})\\)?[\\s.-]?([2-9]\\d{2})[\\s.-]?(\\d{4})$`,
)

export function isValidQuebecPhone(input: string | null | undefined): boolean {
  if (!input || typeof input !== 'string') return false
  return QC_PHONE_REGEX.test(input.trim())
}

/**
 * Normalize to E.164 format `+1XXXXXXXXXX`.
 * Returns null if the input is not a valid NANP/Quebec number.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null
  const match = input.trim().match(QC_PHONE_REGEX)
  if (!match) return null
  const [, area, exchange, subscriber] = match
  return `+1${area}${exchange}${subscriber}`
}

/**
 * Meta advanced-matching / Conversions API phone format: digits only, with the
 * country code, NO '+' or symbols (e.g. "15145551234"). fbevents.js normalizes
 * the in-clear phone the SAME way before hashing client-side, so feeding this
 * exact string to BOTH the browser pixel and the CAPI yields identical hashes —
 * the E.164 "+15145551234" would hash differently (the '+' survives) and the
 * phone match signal is silently lost. Returns null when no digits can be derived.
 */
export function toMetaPhone(input: string | null | undefined): string | null {
  const e164 = normalizePhone(input)
  const digits = (e164 ?? (typeof input === 'string' ? input : '')).replace(/\D/g, '')
  return digits || null
}

/**
 * Format for display: `(514) 555-1234`. Returns the input untouched if invalid.
 */
export function formatPhoneForDisplay(input: string): string {
  const normalized = normalizePhone(input)
  if (!normalized) return input
  const digits = normalized.slice(2) // strip +1
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}
