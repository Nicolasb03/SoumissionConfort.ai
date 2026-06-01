import type { NextRequest } from "next/server"

const APEX_DOMAINS = [
  "soumissionconfort.com",
] as const

const PREVIEW_HOSTS = [
  "soumission-confort-ai.vercel.app",
] as const

const DEV_HOSTS = [
  "localhost",
  "127.0.0.1",
] as const

export const ALLOWED_HOSTNAMES_PROD = new Set<string>([
  ...APEX_DOMAINS,
  ...APEX_DOMAINS.map((d) => `www.${d}`),
  ...PREVIEW_HOSTS,
])

export const ALLOWED_HOSTNAMES_DEV = new Set<string>(DEV_HOSTS)

function normalizeHostname(raw: string): string {
  return raw.toLowerCase().replace(/\.$/, "")
}

function extractHostname(headerValue: string | null): string | null {
  if (!headerValue) return null
  try {
    return normalizeHostname(new URL(headerValue).hostname)
  } catch {
    return null
  }
}

export function isAllowedOrigin(request: NextRequest): boolean {
  const hostname =
    extractHostname(request.headers.get("origin")) ??
    extractHostname(request.headers.get("referer"))

  if (!hostname) return false

  if (ALLOWED_HOSTNAMES_PROD.has(hostname)) return true

  if (
    process.env.NODE_ENV !== "production" &&
    ALLOWED_HOSTNAMES_DEV.has(hostname)
  ) {
    return true
  }

  return false
}
