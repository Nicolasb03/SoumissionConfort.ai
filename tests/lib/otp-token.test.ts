import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { signOtpToken, verifyOtpToken } from "../../lib/otp-token"

const TEST_SECRET = "a".repeat(64)

describe("otp-token", () => {
  beforeEach(() => {
    vi.stubEnv("OTP_SIGNING_SECRET", TEST_SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it("signs a token that can be verified back", async () => {
    const token = await signOtpToken("514-555-1234")
    const result = await verifyOtpToken(token, "(514) 555-1234")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.phone).toBe("+15145551234")
  })

  it("rejects token when phone does not match", async () => {
    const token = await signOtpToken("514-555-1234")
    const result = await verifyOtpToken(token, "514-555-9999")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("PHONE_MISMATCH")
  })

  it("rejects an expired token", async () => {
    vi.useFakeTimers()
    const start = new Date("2026-01-01T00:00:00Z")
    vi.setSystemTime(start)
    const token = await signOtpToken("514-555-1234", { ttlMs: 60_000 }) // 60s TTL
    vi.setSystemTime(new Date(start.getTime() + 120_000)) // +2min
    const result = await verifyOtpToken(token, "514-555-1234")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("EXPIRED")
  })

  it("supports the legacy ttlMs-as-number signature", async () => {
    const token = await signOtpToken("514-555-1234", 30_000)
    const result = await verifyOtpToken(token, "514-555-1234")
    expect(result.ok).toBe(true)
  })

  it("binds leadId in the token and verifies it back", async () => {
    const token = await signOtpToken("514-555-1234", { leadId: "LEAD12345678" })
    const result = await verifyOtpToken(token, "514-555-1234", "LEAD12345678")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.leadId).toBe("LEAD12345678")
  })

  it("rejects when leadId expected but token has none (cross-lead replay attempt)", async () => {
    const token = await signOtpToken("514-555-1234")
    const result = await verifyOtpToken(token, "514-555-1234", "LEAD12345678")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("LEAD_ID_MISMATCH")
  })

  it("rejects when token leadId does not match expected (replay across leads)", async () => {
    const token = await signOtpToken("514-555-1234", { leadId: "LEADaaaaaaaa" })
    const result = await verifyOtpToken(token, "514-555-1234", "LEADbbbbbbbb")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("LEAD_ID_MISMATCH")
  })

  it("ignores leadId in token when caller does not expect one (backward compat)", async () => {
    const token = await signOtpToken("514-555-1234", { leadId: "LEAD12345678" })
    const result = await verifyOtpToken(token, "514-555-1234")
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.leadId).toBe("LEAD12345678")
  })

  it("rejects a malformed token", async () => {
    const result = await verifyOtpToken("not-a-jwt", "514-555-1234")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("INVALID")
  })

  it("rejects empty token input", async () => {
    expect((await verifyOtpToken("", "514-555-1234")).ok).toBe(false)
    expect((await verifyOtpToken(null, "514-555-1234")).ok).toBe(false)
    expect((await verifyOtpToken(undefined, "514-555-1234")).ok).toBe(false)
  })

  it("rejects when expectedPhone is invalid", async () => {
    const token = await signOtpToken("514-555-1234")
    const result = await verifyOtpToken(token, "garbage")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("INVALID")
  })

  it("rejects token signed with a different secret (tampering)", async () => {
    const token = await signOtpToken("514-555-1234")
    vi.stubEnv("OTP_SIGNING_SECRET", "b".repeat(64))
    const result = await verifyOtpToken(token, "514-555-1234")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("INVALID")
  })

  it("throws on sign when secret is missing", async () => {
    vi.stubEnv("OTP_SIGNING_SECRET", "")
    await expect(signOtpToken("514-555-1234")).rejects.toThrow(/OTP_SIGNING_SECRET/)
  })

  it("throws on sign when secret is too short", async () => {
    vi.stubEnv("OTP_SIGNING_SECRET", "short")
    await expect(signOtpToken("514-555-1234")).rejects.toThrow(/32\+ chars/)
  })

  it("returns MISCONFIGURED on verify when secret is missing", async () => {
    const token = await signOtpToken("514-555-1234")
    vi.stubEnv("OTP_SIGNING_SECRET", "")
    const result = await verifyOtpToken(token, "514-555-1234")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("MISCONFIGURED")
  })

  it("throws on sign when phone cannot be normalized", async () => {
    await expect(signOtpToken("garbage")).rejects.toThrow(/normalization/)
  })

  it("issues different jti for each call", async () => {
    const a = await signOtpToken("514-555-1234")
    const b = await signOtpToken("514-555-1234")
    expect(a).not.toBe(b)
  })
})
