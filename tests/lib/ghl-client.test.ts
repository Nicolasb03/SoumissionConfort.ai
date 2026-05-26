import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { postLeadToGHL, type NormalizedLead } from "../../lib/ghl-client"

const baseLead: NormalizedLead = {
  vertical: "isolation",
  firstName: "Test",
  lastName: "User",
  email: "test@example.test",
  phone: "+15145551234",
  internalLeadId: "LEAD123",
}

function mockFetch(responses: Array<{ status: number; body: unknown }>) {
  let call = 0
  const impl = async (_url: string, _init?: RequestInit): Promise<Response> => {
    const r = responses[call++] ?? responses[responses.length - 1]
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json" },
    })
  }
  return vi.fn(impl)
}

describe("postLeadToGHL — workflow re-fire for returning leads", () => {
  beforeEach(() => {
    process.env.GHL_API_KEY_ISO = "pit-test-key-for-iso-vertical-mock"
    process.env.GHL_LOCATION_ID_ISO = "test-location-id"
  })

  afterEach(() => {
    delete process.env.GHL_API_KEY_ISO
    delete process.env.GHL_LOCATION_ID_ISO
    vi.restoreAllMocks()
  })

  it("does NOT re-toggle tag when contact is new (new=true) — Tag Added fires naturally", async () => {
    const fetchMock = mockFetch([
      { status: 200, body: { contact: { id: "c-new-1" }, new: true } },
    ])
    vi.stubGlobal("fetch", fetchMock)

    const result = await postLeadToGHL(baseLead)

    expect(result.contactId).toBe("c-new-1")
    expect(result.duplicate).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1) // upsert only, no DELETE/POST to /tags
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/contacts/upsert")
  })

  it("re-toggles tag (DELETE then POST) when contact is duplicate (new=false)", async () => {
    const fetchMock = mockFetch([
      { status: 200, body: { contact: { id: "c-dup-1" }, new: false } }, // upsert
      { status: 200, body: { tagsRemoved: ["Lead Iso"] } },               // DELETE /tags
      { status: 200, body: { tagsAdded: ["Lead Iso"] } },                 // POST /tags
    ])
    vi.stubGlobal("fetch", fetchMock)

    const result = await postLeadToGHL(baseLead)

    expect(result.contactId).toBe("c-dup-1")
    expect(result.duplicate).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    const upsert = fetchMock.mock.calls[0]!
    const del = fetchMock.mock.calls[1]!
    const post = fetchMock.mock.calls[2]!

    expect(upsert[0]).toContain("/contacts/upsert")

    expect(del[0]).toBe("https://services.leadconnectorhq.com/contacts/c-dup-1/tags")
    expect(del[1]!.method).toBe("DELETE")
    expect(JSON.parse(del[1]!.body as string)).toEqual({ tags: ["Lead Iso"] })

    expect(post[0]).toBe("https://services.leadconnectorhq.com/contacts/c-dup-1/tags")
    expect(post[1]!.method).toBe("POST")
    expect(JSON.parse(post[1]!.body as string)).toEqual({ tags: ["Lead Iso"] })
  })

  it("uses the HVAC-specific tag for hvac vertical duplicates", async () => {
    process.env.GHL_API_KEY = "pit-test-key-for-hvac-vertical-mock"
    process.env.GHL_LOCATION_ID = "test-location-hvac"

    const fetchMock = mockFetch([
      { status: 200, body: { contact: { id: "c-hvac-dup" }, new: false } },
      { status: 200, body: {} },
      { status: 200, body: {} },
    ])
    vi.stubGlobal("fetch", fetchMock)

    await postLeadToGHL({ ...baseLead, vertical: "hvac" })

    const del = fetchMock.mock.calls[1]!
    expect(JSON.parse(del[1]!.body as string)).toEqual({ tags: ["Lead HVAC"] })

    delete process.env.GHL_API_KEY
    delete process.env.GHL_LOCATION_ID
  })
})
