import { describe, expect, it } from "vitest"
import { computeLeadEventId } from "../../lib/event-id"

describe("computeLeadEventId", () => {
  it("is deterministic for the same phone+email", async () => {
    const a = await computeLeadEventId("+15145551234", "user@example.com")
    const b = await computeLeadEventId("+15145551234", "user@example.com")
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{32}$/)
  })

  it("normalizes casing and whitespace so visual variants collapse to one id", async () => {
    const a = await computeLeadEventId("+15145551234", "user@example.com")
    const b = await computeLeadEventId("  +15145551234  ", "USER@Example.com")
    expect(a).toBe(b)
  })

  it("produces distinct ids for different phones or emails", async () => {
    const base = await computeLeadEventId("+15145551234", "user@example.com")
    const otherPhone = await computeLeadEventId("+15145559999", "user@example.com")
    const otherEmail = await computeLeadEventId("+15145551234", "other@example.com")
    expect(base).not.toBe(otherPhone)
    expect(base).not.toBe(otherEmail)
  })
})
