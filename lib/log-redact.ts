/**
 * PII-safe summary for server logs.
 *
 * Vercel server logs persist in clear text and are readable by anyone with project
 * access — so we NEVER write a customer's name / email / phone / address there
 * (Loi 25, Québec). Use this instead of `JSON.stringify(leadData/payload)` at every
 * log site: it keeps only the ids/flags needed to debug a request, never the PII.
 *
 * Accepts either the raw `leadData` shape (firstName/email/phone/address) or a
 * webhook payload shape (nested `contact`/`property`).
 */
export function leadLogSummary(lead: unknown): Record<string, unknown> {
  if (!lead || typeof lead !== 'object') return { lead: typeof lead }
  const l = lead as Record<string, any>
  const contact = (l.contact ?? {}) as Record<string, any>
  const property = (l.property ?? {}) as Record<string, any>
  return {
    leadId: l.leadId ?? l.id,
    leadType: l.leadType,
    vertical: l.vertical,
    intent: l.userAnswers?.intent ?? l.meta?.intent,
    hasEmail: !!(l.email ?? contact.email),
    hasPhone: !!(l.phone ?? contact.phone),
    hasName: !!(l.firstName ?? l.lastName ?? contact.firstName ?? contact.name),
    hasAddress: !!(l.address ?? property.address ?? l.roofData),
  }
}
