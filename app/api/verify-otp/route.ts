import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { isValidQuebecPhone, normalizePhone } from '@/lib/phone'
import { signOtpToken } from '@/lib/otp-token'

export async function POST(request: NextRequest) {
  try {
    const { phone, code, leadId } = await request.json()

    if (!phone || !code) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    if (!isValidQuebecPhone(phone)) {
      return NextResponse.json(
        { error: 'Numéro de téléphone invalide.', code: 'INVALID_PHONE' },
        { status: 400 },
      )
    }

    const e164 = normalizePhone(phone)
    if (!e164) {
      return NextResponse.json(
        { error: 'Numéro de téléphone invalide.', code: 'INVALID_PHONE' },
        { status: 400 },
      )
    }

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    const check = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({ to: e164, code: code.trim() })

    if (check.status !== 'approved') {
      return NextResponse.json({ error: 'Code incorrect.', attemptsLeft: true }, { status: 400 })
    }

    // OTP confirmed by Twilio. Mint a short-lived signed token that
    // /api/leads will require before accepting the contact. We also bind the
    // token to the funnel-supplied leadId (when present) so a leaked token
    // can't be replayed against a different lead within the TTL window.
    const safeLeadId = typeof leadId === 'string' && /^LEAD[A-Za-z0-9]{8,}$/.test(leadId)
      ? leadId
      : null
    let otpToken: string
    try {
      otpToken = await signOtpToken(e164, { leadId: safeLeadId })
    } catch (signErr: any) {
      console.error('verify-otp: failed to sign token', signErr?.message)
      return NextResponse.json(
        { error: 'Configuration serveur manquante.', code: 'TOKEN_MISCONFIGURED' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, otpToken })
  } catch (error: any) {
    console.error('verify-otp error:', error.message, error.code)

    if (error.code === 60202) {
      return NextResponse.json({ error: 'Trop de tentatives. Demandez un nouveau code.', expired: true }, { status: 400 })
    }
    if (error.code === 60200 || error.code === 20404) {
      return NextResponse.json({ error: 'Code expiré. Demandez un nouveau code.', expired: true }, { status: 400 })
    }

    return NextResponse.json({ error: 'Erreur de vérification. Veuillez réessayer.' }, { status: 500 })
  }
}
