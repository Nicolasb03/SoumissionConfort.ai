import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { isValidQuebecPhone, normalizePhone } from '@/lib/phone'

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()

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

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID

    if (!accountSid || !authToken || !serviceSid) {
      console.error('send-otp: missing env vars', { accountSid: !!accountSid, authToken: !!authToken, serviceSid: !!serviceSid })
      return NextResponse.json({ error: 'Configuration serveur manquante.' }, { status: 500 })
    }

    const client = twilio(accountSid, authToken)
    await client.verify.v2
      .services(serviceSid)
      .verifications.create({ to: e164, channel: 'sms' })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('send-otp error:', error.code, error.message, error.status)

    if (error.code === 60203) {
      return NextResponse.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, { status: 429 })
    }

    return NextResponse.json({
      error: "Erreur lors de l'envoi du SMS. Veuillez réessayer.",
      debug: `Twilio error ${error.code}: ${error.message}`
    }, { status: 500 })
  }
}
