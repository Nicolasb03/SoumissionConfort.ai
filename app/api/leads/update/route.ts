import { type NextRequest, NextResponse } from "next/server"
import { isGHLEnabled, findGHLContactByEmail, appendGHLNote, addGHLContactTag } from "@/lib/ghl-client"

const PRECISE_QUOTE_ACTION = 'clicked_precise_quote_button'
const DEMANDE_3_SOUMISSIONS_TAG = 'Demande 3 soumissions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { leadId, action, email } = body as { leadId?: string; action?: string; email?: string }

    console.log('📝 Lead Update API: Updating lead', leadId, 'with action:', action)

    if (!leadId || !action) {
      return NextResponse.json({ error: "Missing leadId or action" }, { status: 400 })
    }

    // GHL DIRECT branch — controlled by GHL_ENABLED env flag.
    // When enabled, look up contact by email and append a note describing the action.
    // The legacy Make path is bypassed entirely so we don't double-write.
    if (isGHLEnabled()) {
      console.log('🟢 LEAD UPDATE: GHL_ENABLED=true → routing to GoHighLevel')
      if (!email) {
        // Frontend hasn't been updated yet to send email — return success but log.
        // Cutover (Phase 5) will require pricing-calculator.tsx to also send email.
        console.warn('⚠️ LEAD UPDATE: GHL branch requires email in body. Skipping note (no-op).')
        return NextResponse.json({
          success: true,
          leadId,
          message: 'GHL_ENABLED no-op (email missing)',
          ghl: { skipped: true },
        })
      }
      // The pricing calculator is iso-only, so this route exclusively touches
      // the iso sub-account. Pass vertical explicitly so the multi-tenant
      // dispatcher hits the right credentials/location.
      const contact = await findGHLContactByEmail(email, 'isolation')
      if (!contact) {
        console.warn('⚠️ LEAD UPDATE: GHL contact not found for', email)
        return NextResponse.json({
          success: true,
          leadId,
          message: 'GHL contact not found, no-op',
          ghl: { found: false },
        })
      }
      const noteBody = `[${new Date().toISOString()}] Action: ${action} (leadId=${leadId})`
      const ok = await appendGHLNote(contact.id, noteBody, 'isolation')

      // For "demande 3 soumissions" CTA: also tag the contact so a downstream
      // GHL workflow can move the opportunity to the "ask for 3 soumissions"
      // stage and notify the setter that this is a hot lead.
      let tagAdded = false
      if (action === PRECISE_QUOTE_ACTION) {
        tagAdded = await addGHLContactTag(contact.id, DEMANDE_3_SOUMISSIONS_TAG, 'isolation')
        console.log(`🔥 LEAD UPDATE: hot lead — tag '${DEMANDE_3_SOUMISSIONS_TAG}' added=${tagAdded}`)
      }

      return NextResponse.json({
        success: ok,
        leadId,
        action,
        ghl: { contactId: contact.id, noteAppended: ok, hotLeadTagAdded: tagAdded },
      })
    }

    // Prepare updated webhook payload with same structure as main webhook (legacy path)
    const updatePayload = {
      "Lead ID (Y)": leadId,
      "Webhook Type (Z)": "quote_request", // Second webhook type
      "Action (AA)": action,
      "Timestamp (BB)": new Date().toISOString(),
      "A cliqué pour soumission précise (CC)": true,
    }

    // Get webhook URLs from environment — fail explicit instead of hidden hardcoded fallback.
    const webhookUrlsEnv = process.env.WEBHOOK_URLS
    if (!webhookUrlsEnv) {
      return NextResponse.json(
        { error: "WEBHOOK_URLS not configured and GHL_ENABLED is not true" },
        { status: 500 },
      )
    }
    const webhookUrls = webhookUrlsEnv.split(',').map(url => url.trim()).filter(url => url.length > 0)

    console.log('🔄 Sending lead update to webhook:', updatePayload)

    // Send update to webhook URLs
    const webhookPromises = webhookUrls.map(async (url) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Soumission-Toiture-AI/1.0',
          },
          body: JSON.stringify(updatePayload),
          signal: AbortSignal.timeout(30000)
        })

        const responseText = await response.text().catch(() => 'Could not read response body')
        
        console.log('✅ Lead update webhook response:', {
          url: url,
          status: response.status,
          responseBody: responseText.substring(0, 200)
        })

        return {
          url: url,
          status: response.ok ? 'success' : 'error',
          statusCode: response.status,
          responseBody: responseText
        }
      } catch (error) {
        console.error('❌ Lead update webhook error:', error)
        return {
          url: url,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    const results = await Promise.all(webhookPromises)

    return NextResponse.json({
      success: true,
      message: "Lead updated successfully",
      leadId: leadId,
      action: action,
      webhookResults: results,
      debugInfo: {
        timestamp: new Date().toISOString(),
        endpoint: "/api/leads/update",
        payloadSent: updatePayload
      }
    })

  } catch (error) {
    console.error("Lead update error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
