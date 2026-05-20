import { describe, expect, it } from "vitest"
import { computeLeadEventId } from "../../lib/event-id"

describe("computeLeadEventId", () => {
  it("is deterministic for the same phone+email+vertical", async () => {
    const a = await computeLeadEventId("+15145551234", "user@example.com", "isolation")
    const b = await computeLeadEventId("+15145551234", "user@example.com", "isolation")
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{32}$/)
  })

  it("normalizes casing and whitespace so visual variants collapse to one id", async () => {
    const a = await computeLeadEventId("+15145551234", "user@example.com", "isolation")
    const b = await computeLeadEventId("  +15145551234  ", "USER@Example.com", "ISOLATION")
    expect(a).toBe(b)
  })

  it("normalizes phone format variants so different shapes collapse to one id", async () => {
    // All four are the same Quebec number entered in different valid formats —
    // they MUST hash to the same id so Meta's 48h dedup can collapse them.
    const canonical = await computeLeadEventId("+15145551234", "user@example.com", "isolation")
    const dashed = await computeLeadEventId("514-555-1234", "user@example.com", "isolation")
    const parens = await computeLeadEventId("(514) 555-1234", "user@example.com", "isolation")
    const naked = await computeLeadEventId("5145551234", "user@example.com", "isolation")
    expect(dashed).toBe(canonical)
    expect(parens).toBe(canonical)
    expect(naked).toBe(canonical)
  })

  it("produces distinct ids for different phones or emails", async () => {
    const base = await computeLeadEventId("+15145551234", "user@example.com", "isolation")
    const otherPhone = await computeLeadEventId("+15145559999", "user@example.com", "isolation")
    const otherEmail = await computeLeadEventId("+15145551234", "other@example.com", "isolation")
    expect(base).not.toBe(otherPhone)
    expect(base).not.toBe(otherEmail)
  })

  it("produces distinct ids across verticals for the same person — cross-funnel conversions must not collapse", async () => {
    const iso = await computeLeadEventId("+15145551234", "user@example.com", "isolation")
    const hvac = await computeLeadEventId("+15145551234", "user@example.com", "hvac")
    const subv = await computeLeadEventId("+15145551234", "user@example.com", "subvention")
    const rapide = await computeLeadEventId("+15145551234", "user@example.com", "isolation_soumission_rapide")
    expect(iso).not.toBe(hvac)
    expect(iso).not.toBe(subv)
    expect(iso).not.toBe(rapide)
    expect(hvac).not.toBe(subv)
    expect(subv).not.toBe(rapide)
  })

  it("falls back gracefully when phone is not a valid NANP/Quebec number", async () => {
    // normalizePhone returns null for bad input; we should still hash deterministically
    // (validation upstream should normally have rejected these).
    const a = await computeLeadEventId("not-a-phone", "user@example.com", "isolation")
    const b = await computeLeadEventId("NOT-A-PHONE", "user@example.com", "isolation")
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{32}$/)
  })
})
