"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle, Loader2 } from "lucide-react"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

type State = "sending" | "pending" | "confirming" | "submitting" | "verified" | "error"

const SEND_THROTTLE_MS = 60_000

export default function VerifierTelephonePage() {
  const router = useRouter()
  const hasSent = useRef(false)
  const [phone, setPhone] = useState("")
  const [redirectTo, setRedirectTo] = useState("/success")
  const [state, setState] = useState<State>("sending")
  const [otpValue, setOtpValue] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [otpExpired, setOtpExpired] = useState(false)

  useEffect(() => {
    if (hasSent.current) return
    try {
      const stored = sessionStorage.getItem("otp-verify")
      if (stored) {
        const data = JSON.parse(stored)
        if (data.phone) {
          hasSent.current = true
          setPhone(data.phone)
          if (data.redirectTo) setRedirectTo(data.redirectTo)
          // Mark OTP flow as active so the funnel pages know not to re-stash
          // a stale pending-lead if the user uses the browser back button.
          sessionStorage.setItem("otp-flow-active", "1")
          sendOtp(data.phone)
          return
        }
      }
    } catch { /* ignore */ }
    // No phone in session — redirect to homepage
    router.replace("/")
  }, [])

  const sendOtp = async (phoneNumber: string) => {
    // Throttle resends to avoid Twilio rate-limit 60203 on refresh/back.
    const lastSentRaw = sessionStorage.getItem("otp-sent-at")
    const lastSent = lastSentRaw ? parseInt(lastSentRaw, 10) : 0
    const elapsed = Date.now() - lastSent
    if (lastSent && elapsed < SEND_THROTTLE_MS) {
      setState("pending")
      return
    }

    setState("sending")
    setErrorMessage("")
    setOtpExpired(false)
    setOtpValue("")
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMessage(data.error ?? "Erreur lors de l'envoi du SMS.")
        setState("error")
        return
      }
      sessionStorage.setItem("otp-sent-at", String(Date.now()))
      setState("pending")
    } catch {
      setErrorMessage("Erreur réseau. Veuillez réessayer.")
      setState("error")
    }
  }

  const cleanupAndRedirect = (target: string) => {
    sessionStorage.removeItem("pending-lead")
    sessionStorage.removeItem("otp-verify")
    sessionStorage.removeItem("otp-flow-active")
    sessionStorage.removeItem("otp-sent-at")
    router.push(target)
  }

  const submitDeferredLead = async (otpToken: string): Promise<{ ok: true } | { ok: true; noPending: true } | { ok: false; expired: boolean }> => {
    const pendingRaw = sessionStorage.getItem("pending-lead")
    if (!pendingRaw) return { ok: true, noPending: true }
    let pending: Record<string, unknown>
    try {
      pending = JSON.parse(pendingRaw)
    } catch {
      return { ok: true, noPending: true }
    }

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pending, otpToken }),
      })
      if (res.ok) return { ok: true }

      let code: string | undefined
      try {
        const body = await res.json()
        code = body?.code
      } catch { /* ignore */ }
      return { ok: false, expired: code === "OTP_TOKEN_EXPIRED" }
    } catch (err) {
      console.error("verifier-telephone: lead submission failed", err)
      return { ok: false, expired: false }
    }
  }

  const confirmOtp = async () => {
    if (otpValue.length !== 6) return
    setState("confirming")
    setErrorMessage("")
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otpValue }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMessage(data.error ?? "Code incorrect.")
        if (data.expired) setOtpExpired(true)
        setState("pending")
        return
      }

      // OTP confirmed — now submit the deferred lead (if any).
      setState("submitting")
      const result = await submitDeferredLead(data.otpToken)
      if (!result.ok) {
        if (result.expired) {
          setErrorMessage("Le code a expiré. Demandez-en un nouveau.")
          setOtpExpired(true)
          setState("pending")
        } else {
          setErrorMessage("Erreur lors de l'envoi. Veuillez recommencer.")
          setState("error")
        }
        return
      }

      setState("verified")
      setTimeout(() => cleanupAndRedirect(redirectTo), 800)
    } catch {
      setErrorMessage("Erreur réseau. Veuillez réessayer.")
      setState("pending")
    }
  }

  return (
    <div className="min-h-screen bg-[#fffff6] flex flex-col items-center" style={{ fontFamily: "'Source Serif Pro', Georgia, serif" }}>

      {/* Header */}
      <header className="w-full px-4 lg:px-[60px] py-4">
        <Link href="/" className="flex items-center gap-3">
          <img src="/images/logo-icon.svg" alt="" className="h-[48px] md:h-[62px] w-auto" />
          <div className="font-bold text-[#002042] leading-[0.9] tracking-[-0.04em] text-[18px] md:text-[26px]" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>
            <p>Soumission</p>
            <p>Confort</p>
          </div>
        </Link>
      </header>

      {/* Main */}
      <div className="flex-1 w-full max-w-[560px] px-4 pb-20 flex flex-col gap-[32px] items-center justify-center">

        <div className="bg-white border-4 border-[#aedee5] rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-[32px] w-full flex flex-col gap-[24px]">

          {state === "verified" ? (
            <div className="flex flex-col items-center gap-[24px] py-[16px]">
              <CheckCircle className="w-[64px] h-[64px] text-[#b9e15c]" />
              <h2 className="font-bold text-[24px] text-[#002042] text-center tracking-[-0.72px] leading-[1.2]" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>
                Numéro vérifié !
              </h2>
              <Loader2 className="w-6 h-6 animate-spin text-[#375371]" />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-[16px] items-center text-center w-full">
                <h2 className="font-bold text-[24px] text-[#002042] tracking-[-0.72px] leading-[1.2] w-full" style={{ fontFamily: "'Radio Canada Big', sans-serif" }}>
                  Vérifiez votre numéro de téléphone
                </h2>
                <p className="text-[18px] text-[#375371] leading-[1.2] tracking-[-0.72px] w-full">
                  {state === "sending"
                    ? "Envoi du code en cours..."
                    : state === "submitting"
                    ? "Confirmation et envoi à nos entrepreneurs..."
                    : (
                      <>
                        Un code de vérification a été envoyé par SMS au{" "}
                        <span className="font-bold text-[#002042]">{phone}</span>.
                        <br />
                        Entrez le code reçu ci-dessous.
                      </>
                    )
                  }
                </p>
              </div>

              {(state === "sending" || state === "submitting") && (
                <div className="flex justify-center py-[16px]">
                  <Loader2 className="w-8 h-8 animate-spin text-[#375371]" />
                </div>
              )}

              {(state === "pending" || state === "confirming") && (
                <div className="flex flex-col items-center gap-[24px]">
                  <InputOTP
                    maxLength={6}
                    value={otpValue}
                    onChange={setOtpValue}
                    disabled={state === "confirming" || otpExpired}
                  >
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="h-[56px] w-[48px] text-[24px] font-bold border-2 border-[#dbe0ec] rounded-[10px]"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>

                  {errorMessage && (
                    <p className="text-[14px] text-red-600 text-center">{errorMessage}</p>
                  )}

                  {!otpExpired ? (
                    <button
                      type="button"
                      onClick={confirmOtp}
                      disabled={otpValue.length !== 6 || state === "confirming"}
                      className="w-full h-[56px] bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-bold text-[18px] rounded-full px-[32px] shadow-[-2px_4px_0_0_#002042] hover:shadow-[-1px_2px_0_0_#002042] hover:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
                      style={{ fontFamily: "'Source Serif Pro', serif" }}
                    >
                      {state === "confirming" ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Vérification...
                        </span>
                      ) : (
                        "Confirmer le code"
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        sessionStorage.removeItem("otp-sent-at")
                        sendOtp(phone)
                      }}
                      className="w-full h-[56px] border-2 border-[#002042] text-[#002042] font-bold text-[18px] rounded-full px-[32px] hover:bg-[#eef5fc] transition-all"
                      style={{ fontFamily: "'Source Serif Pro', serif" }}
                    >
                      Demander un nouveau code
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => sendOtp(phone)}
                    disabled={state === "confirming"}
                    className="text-[14px] text-[#375371] underline underline-offset-2 hover:text-[#002042] transition-colors disabled:opacity-50"
                  >
                    Renvoyer le code
                  </button>
                </div>
              )}

              {state === "error" && (
                <div className="flex flex-col items-center gap-[16px]">
                  <p className="text-[14px] text-red-600 text-center">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => sendOtp(phone)}
                    className="w-full h-[56px] bg-[#b9e15c] border-2 border-[#002042] text-[#002042] font-bold text-[18px] rounded-full px-[32px] shadow-[-2px_4px_0_0_#002042] hover:shadow-[-1px_2px_0_0_#002042] hover:translate-y-[1px] transition-all"
                    style={{ fontFamily: "'Source Serif Pro', serif" }}
                  >
                    Réessayer
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  )
}
