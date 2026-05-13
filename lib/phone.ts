/**
 * Quebec / North America phone validation and normalization.
 *
 * Accepted shapes (NANP, area code starts 2-9):
 *   514-555-1234, (514) 555-1234, 514.555.1234, 5145551234,
 *   1 514 555 1234, +1 (514) 555-1234, +15145551234, etc.
 *
 * Rejected:
 *   anything with letters, fewer than 10 digits, area code starting 0 or 1,
 *   central office code starting 0 or 1.
 */

const QC_PHONE_REGEX =
  /^(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})$/

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
