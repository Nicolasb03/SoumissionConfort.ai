/**
 * Signed OTP tokens for binding `/api/verify-otp` success to subsequent
 * `/api/leads` submissions. Without a valid token, the lead is rejected.
 *
 * Uses HS256 via `jose`. Secret must be set in `OTP_SIGNING_SECRET` env var
 * (32+ bytes hex). Fail-closed: any missing/misconfigured secret causes
 * sign/verify to throw, which is caught upstream and returned as 500.
 */

import { SignJWT, jwtVerify, errors as joseErrors } from "jose"
import { normalizePhone } from "./phone"

const DEFAULT_TTL_MS = 15 * 60 * 1000 // 15 minutes
const ISSUER = "soumissionconfort.otp"
const AUDIENCE = "soumissionconfort.leads"

export type OtpTokenVerifyResult =
  | { ok: true; phone: string; leadId: string | null }
  | { ok: false; reason: "EXPIRED" | "INVALID" | "PHONE_MISMATCH" | "LEAD_ID_MISMATCH" | "MISCONFIGURED" }

export type SignOtpTokenOptions = {
  ttlMs?: number
  /** Bind the token to a specific lead so it can't be replayed across leads. */
  leadId?: string | null
}

function getSecretKey(): Uint8Array {
  const raw = process.env.OTP_SIGNING_SECRET
  if (!raw || raw.length < 32) {
    throw new Error(
      "OTP_SIGNING_SECRET is missing or too short (need 32+ chars). Refusing to sign/verify OTP tokens.",
    )
  }
  return new TextEncoder().encode(raw)
}

/**
 * Sign a short-lived token bound to a normalized E.164 phone number and,
 * optionally, a specific `leadId`. The lead binding is the practical mitigation
 * against replay: even if a token leaks, it can only be used for the same
 * funnel session that minted it (since each funnel generates a fresh leadId).
 * Throws if the secret is misconfigured or the phone is not normalizable.
 */
export async function signOtpToken(
  phone: string,
  optsOrTtl: SignOtpTokenOptions | number = {},
): Promise<string> {
  const opts: SignOtpTokenOptions =
    typeof optsOrTtl === "number" ? { ttlMs: optsOrTtl } : optsOrTtl
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS

  const normalized = normalizePhone(phone)
  if (!normalized) {
    throw new Error("Cannot sign OTP token: phone failed normalization")
  }
  const key = getSecretKey()
  const now = Math.floor(Date.now() / 1000)
  const exp = now + Math.floor(ttlMs / 1000)
  const jti = crypto.randomUUID()

  const claims: Record<string, unknown> = { phone: normalized }
  if (opts.leadId) {
    claims.leadId = opts.leadId
  }

  return await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key)
}

/**
 * Verify a token AND check that its `phone` claim matches the expected number
 * (after normalization). When `expectedLeadId` is provided, the token's
 * `leadId` claim must match exactly (no claim = mismatch). Returns a tagged
 * union for the caller to translate into the appropriate HTTP status.
 */
export async function verifyOtpToken(
  token: string | null | undefined,
  expectedPhone: string,
  expectedLeadId?: string | null,
): Promise<OtpTokenVerifyResult> {
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "INVALID" }
  }
  const expectedNormalized = normalizePhone(expectedPhone)
  if (!expectedNormalized) {
    return { ok: false, reason: "INVALID" }
  }

  let key: Uint8Array
  try {
    key = getSecretKey()
  } catch {
    return { ok: false, reason: "MISCONFIGURED" }
  }

  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    const tokenPhone = typeof payload.phone === "string" ? payload.phone : null
    if (!tokenPhone) return { ok: false, reason: "INVALID" }
    if (tokenPhone !== expectedNormalized) {
      return { ok: false, reason: "PHONE_MISMATCH" }
    }
    const tokenLeadId = typeof payload.leadId === "string" ? payload.leadId : null
    if (expectedLeadId) {
      if (!tokenLeadId || tokenLeadId !== expectedLeadId) {
        return { ok: false, reason: "LEAD_ID_MISMATCH" }
      }
    }
    return { ok: true, phone: tokenPhone, leadId: tokenLeadId }
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      return { ok: false, reason: "EXPIRED" }
    }
    return { ok: false, reason: "INVALID" }
  }
}
