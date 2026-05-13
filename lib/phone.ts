/**
 * Quebec phone validation and normalization.
 *
 * Accepted area codes:
 *   - Quebec: 367, 418, 438, 450, 514, 579, 581, 819, 873
 *   - Ottawa-Gatineau cross-border (many Gatineau residents use ON numbers):
 *     343, 613
 *
 * Accepted shapes :
 *   514-555-1234, (514) 555-1234, 514.555.1234, 5145551234,
 *   1 514 555 1234, +1 (514) 555-1234, +15145551234, etc.
 *
 * Rejected :
 *   anything with letters, fewer than 10 digits, central office code
 *   starting 0 or 1, any non-Quebec/non-Outaouais NANP area code (e.g.
 *   `212-555-1234` from NYC fails — not a typo we want in our CRM).
 */

const QC_AREA_CODES = [
  '367', '418', '438', '450', '514', '579', '581', '819', '873', // Quebec
  '343', '613', // Ottawa-Gatineau region (ON side, but locally Outaouais)
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
 * Format for display: `(514) 555-1234`. Returns the input untouched if invalid.
 */
export function formatPhoneForDisplay(input: string): string {
  const normalized = normalizePhone(input)
  if (!normalized) return input
  const digits = normalized.slice(2) // strip +1
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}
