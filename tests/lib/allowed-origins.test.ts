import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { isAllowedOrigin } from "../../lib/allowed-origins"

function makeRequest(headers: Partial<Record<"origin" | "referer", string>>): NextRequest {
  return {
    headers: {
      get(name: string) {
        const key = name.toLowerCase() as "origin" | "referer"
        return headers[key] ?? null
      },
    },
  } as unknown as NextRequest
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("isAllowedOrigin — production hostnames", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production")
  })

  it.each([
    "https://soumissionconfort.com",
    "https://www.soumissionconfort.com",
    "https://soumission-confort-ai.vercel.app",
  ])("allows %s", (origin) => {
    expect(isAllowedOrigin(makeRequest({ origin }))).toBe(true)
  })

  it("allows uppercase + trailing-dot hostnames", () => {
    const req = makeRequest({ origin: "https://WWW.SOUMISSIONCONFORT.COM./path" })
    expect(isAllowedOrigin(req)).toBe(true)
  })

  it("falls back to Referer when Origin is absent", () => {
    const req = makeRequest({ referer: "https://www.soumissionconfort.com/merci" })
    expect(isAllowedOrigin(req)).toBe(true)
  })
})

describe("isAllowedOrigin — denied origins", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production")
  })

  it.each([
    "https://soumissionconfort.com.evil.io",
    "https://www.soumissionconfort.com.evil.io",
    "https://evil.vercel.app",
    "https://soumissionconfort-evil.com",
    "https://soumissionconfort.ai",
    "https://www.soumissionconfort.ai",
  ])("denies %s", (origin) => {
    expect(isAllowedOrigin(makeRequest({ origin }))).toBe(false)
  })

  it("denies when both Origin and Referer are missing", () => {
    expect(isAllowedOrigin(makeRequest({}))).toBe(false)
  })

  it("denies when header is not a valid URL", () => {
    expect(isAllowedOrigin(makeRequest({ origin: "not-a-url" }))).toBe(false)
  })

  it("denies localhost in production", () => {
    expect(isAllowedOrigin(makeRequest({ origin: "http://localhost:3000" }))).toBe(false)
    expect(isAllowedOrigin(makeRequest({ origin: "http://127.0.0.1:3000" }))).toBe(false)
  })

  it("denies spoofed localhost via Referer in production", () => {
    const req = makeRequest({ referer: "http://localhost/attack" })
    expect(isAllowedOrigin(req)).toBe(false)
  })
})

describe("isAllowedOrigin — development mode", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development")
  })

  it("allows localhost in dev", () => {
    expect(isAllowedOrigin(makeRequest({ origin: "http://localhost:3000" }))).toBe(true)
    expect(isAllowedOrigin(makeRequest({ origin: "http://127.0.0.1:3000" }))).toBe(true)
  })

  it("still denies superstring attacks in dev", () => {
    const req = makeRequest({ origin: "https://soumissionconfort.com.evil.io" })
    expect(isAllowedOrigin(req)).toBe(false)
  })
})
