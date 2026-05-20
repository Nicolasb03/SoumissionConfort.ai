// Deterministic Meta event_id derived from (phone, email) so the same user
// re-submitting the form within Meta's 48h dedup window collapses to a single
// counted Lead — both for Pixel↔CAPI sync AND for repeat submissions. After
// 48h, the same event_id is treated as a new event (intentional: it's a real
// re-engagement worth counting).
//
// Used by both client funnels (browser) and the /api/leads server route, so
// the value is consistent across Pixel and CAPI fires for the same person.
// WebCrypto (`crypto.subtle`) is available in modern browsers and Node 18+.
export async function computeLeadEventId(phone: string, email: string): Promise<string> {
  const input = `powerflow|${phone.toLowerCase().trim()}|${email.toLowerCase().trim()}`
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 32)
}
