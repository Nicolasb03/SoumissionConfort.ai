import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { signOtpToken } from "../../lib/otp-token"

// Hoisted mocks must be declared before the route is imported. We control
// GHL by stubbing `isGHLEnabled` and `postLeadToGHL` on the module path the
// route imports.
const ghlMocks = vi.hoisted(() => ({
  isGHLEnabled: vi.fn(),
  postLeadToGHL: vi.fn(),
}))
vi.mock("@/lib/ghl-client", () => ({
  isGHLEnabled: ghlMocks.isGHLEnabled,
  postLeadToGHL: ghlMocks.postLeadToGHL,
}))

const metaMocks = vi.hoisted(() => {
  const trackLead = vi.fn()
  return {
    trackLead,
    initializeMetaConversionAPI: vi.fn(() => ({ trackLead })),
  }
})
vi.mock("@/lib/meta-conversion-api", () => ({
  initializeMetaConversionAPI: metaMocks.initializeMetaConversionAPI,
}))

const supabaseMocks = vi.hoisted(() => {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null })
  const from = vi.fn(() => ({ insert }))
  return {
    insert,
    from,
    getSupabaseAdmin: vi.fn(() => ({ from })),
  }
})
vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: supabaseMocks.getSupabaseAdmin,
}))

const TEST_SECRET = "a".repeat(64)

function buildRequest(body: unknown): Request {
  return new Request("https://example.test/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify(body),
  })
}

const baseHVACBody = {
  leadType: "hvac",
  firstName: "Zack",
  lastName: "Dumont",
  email: "z@example.com",
  phone: "514-555-1234",
  address: "123 rue X, Montréal, QC H2X 1Y4, Canada",
}

describe("/api/leads — phone validation + OTP gate", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("OTP_SIGNING_SECRET", TEST_SECRET)
    vi.stubEnv("NEXT_PUBLIC_OTP_ENABLED", "true")
    vi.stubEnv("GHL_ENABLED", "false")
    ghlMocks.isGHLEnabled.mockReturnValue(true)
    ghlMocks.postLeadToGHL.mockResolvedValue({ contactId: "ghl_123" })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it("rejects an invalid phone with 400 INVALID_PHONE", async () => {
    const { POST } = await import("../../app/api/leads/route")
    const res = await POST(buildRequest({ ...baseHVACBody, phone: "abc" }) as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe("INVALID_PHONE")
    expect(ghlMocks.postLeadToGHL).not.toHaveBeenCalled()
  })

  it("rejects a valid phone without OTP token with 401 OTP_TOKEN_INVALID", async () => {
    const { POST } = await import("../../app/api/leads/route")
    const res = await POST(buildRequest(baseHVACBody) as any)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe("OTP_TOKEN_INVALID")
    expect(ghlMocks.postLeadToGHL).not.toHaveBeenCalled()
  })

  it("rejects when token phone does not match request phone (PHONE_MISMATCH)", async () => {
    const token = await signOtpToken("514-555-9999")
    const { POST } = await import("../../app/api/leads/route")
    const res = await POST(
      buildRequest({ ...baseHVACBody, phone: "514-555-1234", otpToken: token }) as any,
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe("OTP_TOKEN_INVALID")
    expect(ghlMocks.postLeadToGHL).not.toHaveBeenCalled()
  })

  it("rejects an expired token with 401 OTP_TOKEN_EXPIRED", async () => {
    const token = await signOtpToken("514-555-1234", { ttlMs: 1000 })
    await new Promise((r) => setTimeout(r, 1500))
    const { POST } = await import("../../app/api/leads/route")
    const res = await POST(
      buildRequest({ ...baseHVACBody, otpToken: token }) as any,
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe("OTP_TOKEN_EXPIRED")
  })

  it("rejects token whose leadId claim doesn't match the request leadId (replay)", async () => {
    const token = await signOtpToken("514-555-1234", { leadId: "LEADaaaaaaaa" })
    const { POST } = await import("../../app/api/leads/route")
    const res = await POST(
      buildRequest({
        ...baseHVACBody,
        leadId: "LEADbbbbbbbb",
        otpToken: token,
      }) as any,
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe("OTP_TOKEN_INVALID")
    expect(ghlMocks.postLeadToGHL).not.toHaveBeenCalled()
  })

  it("rejects when request leadId is well-formed but token has no leadId claim", async () => {
    const token = await signOtpToken("514-555-1234") // no leadId binding
    const { POST } = await import("../../app/api/leads/route")
    const res = await POST(
      buildRequest({
        ...baseHVACBody,
        leadId: "LEAD12345678",
        otpToken: token,
      }) as any,
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe("OTP_TOKEN_INVALID")
    expect(ghlMocks.postLeadToGHL).not.toHaveBeenCalled()
  })

  it("accepts when leadId claim matches the request leadId", async () => {
    const token = await signOtpToken("514-555-1234", { leadId: "LEAD12345678" })
    const { POST } = await import("../../app/api/leads/route")
    const res = await POST(
      buildRequest({
        ...baseHVACBody,
        leadId: "LEAD12345678",
        otpToken: token,
      }) as any,
    )
    expect(res.status).toBe(200)
    expect(ghlMocks.postLeadToGHL).toHaveBeenCalledTimes(1)
  })

  it("accepts a valid token + valid phone and normalizes to E.164 before GHL", async () => {
    const token = await signOtpToken("514-555-1234")
    const { POST } = await import("../../app/api/leads/route")
    const res = await POST(
      buildRequest({
        ...baseHVACBody,
        phone: "(514) 555-1234", // pretty form
        otpToken: token,
      }) as any,
    )
    expect(res.status).toBe(200)
    expect(ghlMocks.postLeadToGHL).toHaveBeenCalledTimes(1)
    const sent = ghlMocks.postLeadToGHL.mock.calls[0][0]
    expect(sent.phone).toBe("+15145551234")
  })

  it("when OTP_ENABLED=false, still validates phone but skips token", async () => {
    vi.stubEnv("NEXT_PUBLIC_OTP_ENABLED", "false")
    vi.resetModules()
    const { POST } = await import("../../app/api/leads/route")

    const ok = await POST(buildRequest(baseHVACBody) as any)
    expect(ok.status).toBe(200)
    expect(ghlMocks.postLeadToGHL).toHaveBeenCalled()

    ghlMocks.postLeadToGHL.mockClear()
    const bad = await POST(buildRequest({ ...baseHVACBody, phone: "abc" }) as any)
    expect(bad.status).toBe(400)
    expect(ghlMocks.postLeadToGHL).not.toHaveBeenCalled()
  })

  it("returns 500 OTP_TOKEN_MISCONFIGURED when signing secret is absent", async () => {
    vi.stubEnv("OTP_SIGNING_SECRET", "")
    const { POST } = await import("../../app/api/leads/route")
    const res = await POST(
      buildRequest({ ...baseHVACBody, otpToken: "anything" }) as any,
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe("OTP_TOKEN_MISCONFIGURED")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Meta lead_status + Supabase audit tests
// ─────────────────────────────────────────────────────────────────────────────
describe("/api/leads — Meta lead_status + Supabase audit", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("OTP_SIGNING_SECRET", TEST_SECRET)
    vi.stubEnv("NEXT_PUBLIC_OTP_ENABLED", "true")
    vi.stubEnv("GHL_ENABLED", "true")
    // Required for the Meta CAPI block inside the GHL branch to actually run
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "pixel_test")
    vi.stubEnv("META_CONVERSION_ACCESS_TOKEN", "capi_test")
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service_test_key")
    ghlMocks.isGHLEnabled.mockReturnValue(true)
    // Default: brand-new contact (not a duplicate upsert)
    ghlMocks.postLeadToGHL.mockResolvedValue({
      contactId: "ghl_abc",
      duplicate: false,
      contactStatus: 200,
    })
    // Reset mocks so each test gets clean call counts
    supabaseMocks.insert.mockClear()
    supabaseMocks.from.mockClear()
    supabaseMocks.getSupabaseAdmin.mockClear()
    supabaseMocks.insert.mockResolvedValue({ data: null, error: null })
    metaMocks.trackLead.mockClear()
    metaMocks.trackLead.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it("sets custom_data.lead_status='new' when GHL returns duplicate=false", async () => {
    const token = await signOtpToken("514-555-1234")
    const { POST } = await import("../../app/api/leads/route")
    const res = await POST(
      buildRequest({ ...baseHVACBody, otpToken: token, eventId: "evt_unique_1" }) as any,
    )
    expect(res.status).toBe(200)
    expect(metaMocks.trackLead).toHaveBeenCalledTimes(1)
    const call = metaMocks.trackLead.mock.calls[0][0]
    expect(call.customData).toMatchObject({ lead_status: "new" })
    expect(call.eventId).toBe("evt_unique_1")
  })

  it("sets custom_data.lead_status='duplicate' when GHL returns duplicate=true (upsert-merged)", async () => {
    ghlMocks.postLeadToGHL.mockResolvedValueOnce({
      contactId: "ghl_existing",
      duplicate: true,
      contactStatus: 200,
    })
    const token = await signOtpToken("514-555-1234")
    const { POST } = await import("../../app/api/leads/route")
    const res = await POST(
      buildRequest({ ...baseHVACBody, otpToken: token, eventId: "evt_dup_1" }) as any,
    )
    expect(res.status).toBe(200)
    const call = metaMocks.trackLead.mock.calls[0][0]
    expect(call.customData).toMatchObject({ lead_status: "duplicate" })
  })

  it("inserts a row in leads_audit with ghl_new=true on a new contact", async () => {
    const token = await signOtpToken("514-555-1234")
    const { POST } = await import("../../app/api/leads/route")
    await POST(buildRequest({ ...baseHVACBody, otpToken: token, eventId: "evt_audit_new" }) as any)

    expect(supabaseMocks.from).toHaveBeenCalledWith("leads_audit")
    expect(supabaseMocks.insert).toHaveBeenCalledTimes(1)
    const row = supabaseMocks.insert.mock.calls[0][0]
    expect(row).toMatchObject({
      vertical: "hvac",
      phone_e164: "+15145551234",
      email: "z@example.com",
      meta_event_id: "evt_audit_new",
      ghl_contact_id: "ghl_abc",
      ghl_new: true,
      ghl_status_code: 200,
    })
  })

  it("inserts a row in leads_audit with ghl_new=false on a duplicate upsert", async () => {
    ghlMocks.postLeadToGHL.mockResolvedValueOnce({
      contactId: "ghl_existing",
      duplicate: true,
      contactStatus: 200,
    })
    const token = await signOtpToken("514-555-1234")
    const { POST } = await import("../../app/api/leads/route")
    await POST(buildRequest({ ...baseHVACBody, otpToken: token, eventId: "evt_audit_dup" }) as any)

    expect(supabaseMocks.insert).toHaveBeenCalledTimes(1)
    expect(supabaseMocks.insert.mock.calls[0][0]).toMatchObject({
      ghl_new: false,
      ghl_contact_id: "ghl_existing",
    })
  })

  it("a Supabase insert failure (throw) does NOT fail the lead submission", async () => {
    supabaseMocks.insert.mockRejectedValueOnce(new Error("db unreachable"))
    const token = await signOtpToken("514-555-1234")
    const { POST } = await import("../../app/api/leads/route")
    const res = await POST(buildRequest({ ...baseHVACBody, otpToken: token }) as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    // Meta CAPI should still fire even when audit fails
    expect(metaMocks.trackLead).toHaveBeenCalledTimes(1)
  })

  it("a Supabase PostgREST error (resolved with { error }) does NOT fail the lead submission", async () => {
    // PostgREST resolves with { data: null, error: {...} } on RLS/schema/missing-migration
    // issues — does NOT throw. Make sure the route handles this without bubbling.
    supabaseMocks.insert.mockResolvedValueOnce({
      data: null,
      error: { message: "relation \"leads_audit\" does not exist", code: "42P01" },
    })
    const token = await signOtpToken("514-555-1234")
    const { POST } = await import("../../app/api/leads/route")
    const res = await POST(buildRequest({ ...baseHVACBody, otpToken: token }) as any)
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    expect(metaMocks.trackLead).toHaveBeenCalledTimes(1)
  })
})
