import { type NextRequest, NextResponse } from "next/server"
import { isGHLEnabled, postLeadToGHL, type LeadVertical, type NormalizedLead } from "@/lib/ghl-client"

export async function POST(request: NextRequest) {
  console.log('🚨🚨🚨 WEBHOOK ENDPOINT CALLED - THIS SHOULD APPEAR IN LOGS 🚨🚨🚨')
  
  // Check for Vercel automation bypass
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  if (bypassSecret) {
    console.log('🔓 Vercel bypass secret configured')
  }
  
  try {
    const leadData = await request.json()
    
    console.log('🎯 WEBHOOK ENDPOINT: RECEIVED PAYLOAD FROM LEADS API:')
    console.log('📥 WEBHOOK: Full received payload:', JSON.stringify(leadData, null, 2))
    console.log('📏 WEBHOOK: Received payload size:', JSON.stringify(leadData).length, 'characters')

    // Validate required nested fields
    if (!leadData.contact || !leadData.contact.firstName || !leadData.contact.lastName || 
        !leadData.contact.email || !leadData.contact.phone) {
      return NextResponse.json({ 
        error: "Missing required contact fields: firstName, lastName, email, phone" 
      }, { status: 400 })
    }

    if (!leadData.property || !leadData.projectDetails) {
      return NextResponse.json({
        error: "Missing required fields: property, projectDetails"
      }, { status: 400 })
    }

    // GHL DIRECT (defensive branch — this route is normally only hit by external services).
    // When GHL_ENABLED=true, push the contact to GHL and short-circuit before the Make webhook.
    if (isGHLEnabled()) {
      console.log('🟢 WEBHOOK: GHL_ENABLED=true → posting to GoHighLevel directly')
      try {
        const wt = (leadData.webhookType ?? '') as string
        const vertical: LeadVertical = wt === 'hvac_contact'
          ? 'hvac'
          : wt === 'subvention_contact'
          ? 'subvention'
          : wt === 'isolation_soumission_rapide'
          ? 'isolation_soumission_rapide'
          : 'isolation'

        const ghlPayload: NormalizedLead = {
          vertical,
          firstName: leadData.contact.firstName,
          lastName: leadData.contact.lastName,
          email: leadData.contact.email,
          phone: leadData.contact.phone,
          address1: leadData.property.address,
          city: leadData.property.city || leadData.property.ville,
          postalCode: leadData.property.postalCode,
          utmSource: leadData.utmParams?.utm_source,
          utmCampaign: leadData.utmParams?.utm_campaign,
          utmContent: leadData.utmParams?.utm_content,
          utmMedium: leadData.utmParams?.utm_medium,
          utmTerm: leadData.utmParams?.utm_term,
          fbclid: leadData.utmParams?.fbclid,
          leadSource: leadData.source || 'soumission-confort-ai',
          internalLeadId: leadData.leadId,
          custom: {
            isolation_actuelle: leadData.projectDetails?.currentInsulation,
            acces_entretoit: leadData.projectDetails?.atticAccess,
            systeme_de_chauffage: leadData.projectDetails?.heatingSystem,
            problemes_identifies: Array.isArray(leadData.projectDetails?.identifiedProblems)
              ? leadData.projectDetails.identifiedProblems.join(', ')
              : leadData.projectDetails?.identifiedProblems,
            econo__prix_min: leadData.pricing?.ranges?.economique?.min,
            econo__prix_max: leadData.pricing?.ranges?.economique?.max,
            standard__prix_min: leadData.pricing?.ranges?.standard?.min,
            standard__prix_max: leadData.pricing?.ranges?.standard?.max,
            premium__prix_min: leadData.pricing?.ranges?.premium?.min,
            premium__prix_max: leadData.pricing?.ranges?.premium?.max,
          },
        }

        const ghlResult = await postLeadToGHL(ghlPayload)
        console.log('🟢 WEBHOOK: GHL post result:', ghlResult)

        if (!ghlResult.contactId) {
          return NextResponse.json(
            { success: false, error: ghlResult.contactError, ghl: ghlResult },
            { status: 502 },
          )
        }

        // Meta CAPI retiré (isolation 2026-06) : le canal partagé est désactivé.
        // Le Lead Meta du funnel /analysis est émis par /api/leads (isolation
        // only), pas par ce webhook.

        return NextResponse.json({
          success: true,
          message: '✅ WEBHOOK: Lead sent to GoHighLevel',
          ghl: ghlResult,
          debugInfo: {
            timestamp: new Date().toISOString(),
            endpoint: '/api/webhook/route.ts',
            version: 'GHL_DIRECT_DEFENSIVE',
          },
        })
      } catch (ghlError) {
        console.error('💥 WEBHOOK: GHL branch error:', ghlError)
        return NextResponse.json(
          {
            success: false,
            error: ghlError instanceof Error ? ghlError.message : 'GHL branch crashed',
          },
          { status: 500 },
        )
      }
    }

    // Meta CAPI Lead retiré (isolation 2026-06) : canal partagé désactivé.
    // Le Lead Meta isolation est émis par /api/leads, pas par ce webhook.

    // Extract UTM parameters
    const utmParams = leadData.utmParams || {}
    console.log('🏷️ WEBHOOK: UTM Parameters received:', utmParams)
    
    // Debug pricing data
    console.log('💰 WEBHOOK: Pricing data received:', leadData.pricing)
    console.log('💰 WEBHOOK: Low estimate:', leadData.pricing?.lowEstimate)
    console.log('💰 WEBHOOK: High estimate:', leadData.pricing?.highEstimate)

    // Prepare webhook payload to match Google Sheets structure
    const webhookPayload = {
      // Contact (A-D)
      "Prénom (A)": leadData.contact.firstName,
      "Nom (B)": leadData.contact.lastName,
      "Adresse courriel (C)": leadData.contact.email,
      "Téléphone (D)": leadData.contact.phone,
      
      // Propriété (E-I)
      "Adresse (E)": leadData.property.address || "",
      "Code postal (F)": leadData.property.postalCode || "",
      "Ville (G)": leadData.property.city || "",
      "Superficie entretoit (H)": leadData.property.roofArea || 0,
      "Hauteur du bâtiment (I)": leadData.property.buildingHeight || 0,
      
      // Questions d'isolation (J-M)
      "Système de chauffage (J)": leadData.projectDetails.heatingSystem || "",
      "Isolation actuelle (K)": leadData.projectDetails.currentInsulation || "",
      "Accès entretoit (L)": leadData.projectDetails.atticAccess || "",
      "Problèmes identifiés (M)": Array.isArray(leadData.projectDetails.identifiedProblems) 
        ? leadData.projectDetails.identifiedProblems.join(", ") 
        : leadData.projectDetails.identifiedProblems || "",
      
      // Gamme Économique (N-S)
      "Économique - Prix min (N)": leadData.pricing?.ranges?.economique?.min || 0,
      "Économique - Prix max (O)": leadData.pricing?.ranges?.economique?.max || 0,
      "Économique - Économies min (P)": leadData.pricing?.ranges?.economique?.annualSavings?.min || 0,
      "Économique - Économies max (Q)": leadData.pricing?.ranges?.economique?.annualSavings?.max || 0,
      "Économique - Retour min (R)": leadData.pricing?.ranges?.economique?.paybackPeriod?.min || 0,
      "Économique - Retour max (S)": leadData.pricing?.ranges?.economique?.paybackPeriod?.max || 0,
      
      // Gamme Standard (T-Y)
      "Standard - Prix min (T)": leadData.pricing?.ranges?.standard?.min || 0,
      "Standard - Prix max (U)": leadData.pricing?.ranges?.standard?.max || 0,
      "Standard - Économies min (V)": leadData.pricing?.ranges?.standard?.annualSavings?.min || 0,
      "Standard - Économies max (W)": leadData.pricing?.ranges?.standard?.annualSavings?.max || 0,
      "Standard - Retour min (X)": leadData.pricing?.ranges?.standard?.paybackPeriod?.min || 0,
      "Standard - Retour max (Y)": leadData.pricing?.ranges?.standard?.paybackPeriod?.max || 0,
      
      // Gamme Premium (Z-AE)
      "Premium - Prix min (Z)": leadData.pricing?.ranges?.premium?.min || 0,
      "Premium - Prix max (AA)": leadData.pricing?.ranges?.premium?.max || 0,
      "Premium - Économies min (AB)": leadData.pricing?.ranges?.premium?.annualSavings?.min || 0,
      "Premium - Économies max (AC)": leadData.pricing?.ranges?.premium?.annualSavings?.max || 0,
      "Premium - Retour min (AD)": leadData.pricing?.ranges?.premium?.paybackPeriod?.min || 0,
      "Premium - Retour max (AE)": leadData.pricing?.ranges?.premium?.paybackPeriod?.max || 0,
      
      // UTM Parameters (AF-AJ)
      "UTM Source (AF)": utmParams.utm_source || "",
      "UTM Campaign (AG)": utmParams.utm_campaign || "",
      "UTM Content (AH)": utmParams.utm_content || "",
      "UTM Medium (AI)": utmParams.utm_medium || "",
      "UTM Term (AJ)": utmParams.utm_term || "",

      // Facebook Click ID (AK)
      "Facebook Click ID (AK)": utmParams.fbclid || null,

      // Métadonnées (AL-AM)
      "Lead ID (AL)": leadData.leadId || "",
      "Webhook Type (AM)": leadData.webhookType || "initial_contact"
    }

    // Get webhook URLs from environment
    const webhookUrlsEnv = process.env.WEBHOOK_URLS
    console.log('🔍 Environment check - WEBHOOK_URLS configured:', webhookUrlsEnv ? 'YES' : 'NO')
    console.log('🔗 Using webhook URL:', webhookUrlsEnv)
    
    if (!webhookUrlsEnv) {
      console.error('❌ WEBHOOK: No webhook URLs configured')
      return NextResponse.json({
        success: false,
        message: "❌ WEBHOOK ENDPOINT ERROR: WEBHOOK_URLS NOT CONFIGURED ❌",
        error: "No webhook URLs set",
        debugInfo: {
          timestamp: new Date().toISOString(),
          endpoint: "/api/webhook/route.ts",
          version: "WEBHOOK_ERROR"
        }
      })
    }

    const webhookUrls = webhookUrlsEnv.split(',').map(url => url.trim()).filter(url => url.length > 0)
    console.log('🌐 WEBHOOK: Webhook URLs configured:', webhookUrls.length)
    console.log('📋 WEBHOOK: Webhook URLs:', webhookUrls)

    // Send to external webhook URLs (configured in environment variables)
    const webhookPromises = webhookUrls.map(async (url, index) => {
      const trimmedUrl = url.trim()
      if (!trimmedUrl) return null
      
      try {
        const startTime = Date.now()
        
        // Log the exact payload being sent
        const payloadString = JSON.stringify(webhookPayload, null, 2)
        console.log(`📤 Sending webhook ${index + 1}/${webhookUrls.length} to:`, trimmedUrl)
        console.log(`📦 Full payload being sent:`, payloadString)
        
        const response = await fetch(trimmedUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Soumission-Toiture-AI/1.0',
          },
          body: payloadString,
          // Increase timeout to 30 seconds
          signal: AbortSignal.timeout(30000)
        })

        const duration = Date.now() - startTime
        
        // Always try to read response body for debugging
        const responseText = await response.text().catch(() => 'Could not read response body')
        
        // Enhanced debugging for Make.com
        if (trimmedUrl.includes('make.com')) {
          console.log('🔧 MAKE.COM DETAILED DEBUG:')
          console.log('📤 Request URL:', trimmedUrl)
          console.log('📤 Request Method: POST')
          console.log('📤 Request Headers:', {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Soumission-Toiture-AI/1.0'
          })
          console.log('📤 Payload sent to Make.com:', payloadString)
          console.log('📤 Payload length:', payloadString.length)
          console.log('📥 Make.com response status:', response.status)
          console.log('📥 Make.com response headers:', Object.fromEntries(response.headers.entries()))
          console.log('📥 Make.com response body:', responseText)
          console.log('📥 Response is HTML?', responseText.includes('<!doctype') || responseText.includes('<html'))
          
          if (responseText.includes('<!doctype') || responseText.includes('<html')) {
            console.log('⚠️  Make.com returned HTML instead of JSON - this usually means:')
            console.log('   1. The webhook URL is incorrect or expired')
            console.log('   2. The payload format is not accepted')
            console.log('   3. Make.com is redirecting the request')
            console.log('   4. There is an authentication issue')
          }
        }
        
        console.log(`✅ Webhook ${index + 1} response:`, {
          url: trimmedUrl,
          status: response.status,
          statusText: response.statusText,
          duration: `${duration}ms`,
          headers: Object.fromEntries(response.headers.entries()),
          responseBody: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : '')
        })

        if (!response.ok) {
          console.error(`❌ Webhook ${index + 1} failed:`, {
            status: response.status,
            statusText: response.statusText,
            body: responseText,
            url: trimmedUrl
          })
          
          // Don't throw error, just return error status
          return {
            url: trimmedUrl,
            status: 'error',
            statusCode: response.status,
            error: `HTTP ${response.status}: ${response.statusText}`,
            responseBody: responseText,
            duration
          }
        }

        return {
          url: trimmedUrl,
          status: 'success',
          statusCode: response.status,
          duration,
          responseBody: responseText
        }
      } catch (error) {
        console.error(`Webhook error for ${trimmedUrl}:`, error)
        return {
          url: trimmedUrl,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    const results = await Promise.all(webhookPromises)
    const successfulWebhooks = results.filter(r => r?.status === 'success').length
    const failedWebhooks = results.filter(r => r?.status === 'error').length

    return NextResponse.json({
      success: true,
      message: "🚨 WEBHOOK ENDPOINT CONFIRMED - RESPONSE FROM /api/webhook/route.ts 🚨",
      webhookResults: results,
      debugInfo: {
        timestamp: new Date().toISOString(),
        endpoint: "/api/webhook/route.ts",
        version: "WEBHOOK_DEBUG_VERSION_2.0",
        webhookUrlsCount: webhookUrls.length,
        payloadSent: webhookPayload,
        makeComResponses: results.filter(r => r !== null).map(r => ({
          url: r!.url,
          status: r!.status,
          responseBody: r!.responseBody
        }))
      }
    })

  } catch (error) {
    console.error("Webhook endpoint error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function TEST(request: NextRequest) {
  try {
    const webhookUrlsEnv = process.env.WEBHOOK_URLS
    console.log('🔍 Environment check - WEBHOOK_URLS configured:', webhookUrlsEnv ? 'YES' : 'NO')
    console.log('🔗 Using webhook URL:', webhookUrlsEnv)
    
    if (!webhookUrlsEnv) {
      console.error('❌ WEBHOOK: No webhook URLs configured')
      return NextResponse.json({
        success: false,
        message: "❌ WEBHOOK ENDPOINT ERROR: WEBHOOK_URLS NOT CONFIGURED ❌",
        error: "No webhook URLs set",
        debugInfo: {
          timestamp: new Date().toISOString(),
          endpoint: "/api/webhook/route.ts",
          version: "WEBHOOK_ERROR"
        }
      })
    }

    const webhookUrls = webhookUrlsEnv.split(',').map(url => url.trim()).filter(url => url.length > 0)
    console.log('🌐 WEBHOOK: Webhook URLs configured:', webhookUrls.length)
    console.log('📋 WEBHOOK: Webhook URLs:', webhookUrls)

    const testWebhookPayload = {
      "Prénom (A)": "John",
      "Nom (B)": "Doe",
      "Adresse courriel (C)": "john.doe@example.com",
      "Téléphone (D)": "123-456-7890",
      "Adresse (E)": "",
      "Code postal (F)": "",
      "Ville (G)": "",
      "Superficie du toit (H)": 0,
      "Hauteur du bâtiment (I)": 0,
      "Condition particulières (J)": "",
      "Âge du toit (K)": "",
      "Matériau du toit (L)": "",
      "Accès (M)": "",
      "Type de service (N)": "",
      "Date du projet (O)": "",
      "Méthode de contact (P)": "",
      "Meilleur moment (Q)": ""
    }

    const webhookPromises = webhookUrls.map(async (url, index) => {
      const trimmedUrl = url.trim()
      if (!trimmedUrl) return null
      
      try {
        const startTime = Date.now()
        
        // Log the exact payload being sent
        const payloadString = JSON.stringify(testWebhookPayload, null, 2)
        console.log(`📤 Sending test webhook ${index + 1}/${webhookUrls.length} to:`, trimmedUrl)
        console.log(`📦 Full payload being sent:`, payloadString)
        
        const response = await fetch(trimmedUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Soumission-Toiture-AI/1.0',
          },
          body: payloadString,
          // Increase timeout to 30 seconds
          signal: AbortSignal.timeout(30000)
        })

        const duration = Date.now() - startTime
        
        // Always try to read response body for debugging
        const responseText = await response.text().catch(() => 'Could not read response body')
        
        console.log(`✅ Test Webhook ${index + 1} response:`, {
          url: trimmedUrl,
          status: response.status,
          statusText: response.statusText,
          duration: `${duration}ms`,
          headers: Object.fromEntries(response.headers.entries()),
          responseBody: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : '')
        })

        if (!response.ok) {
          console.error(`❌ Test Webhook ${index + 1} failed:`, {
            status: response.status,
            statusText: response.statusText,
            body: responseText,
            url: trimmedUrl
          })
          
          // Don't throw error, just return error status
          return {
            url: trimmedUrl,
            status: 'error',
            statusCode: response.status,
            error: `HTTP ${response.status}: ${response.statusText}`,
            responseBody: responseText,
            duration
          }
        }

        return {
          url: trimmedUrl,
          status: 'success',
          statusCode: response.status,
          duration,
          responseBody: responseText
        }
      } catch (error) {
        console.error(`Test Webhook error for ${trimmedUrl}:`, error)
        return {
          url: trimmedUrl,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    const results = await Promise.all(webhookPromises)
    const successfulWebhooks = results.filter(r => r?.status === 'success').length
    const failedWebhooks = results.filter(r => r?.status === 'error').length

    return NextResponse.json({
      success: true,
      message: "🚨 TEST WEBHOOK ENDPOINT CONFIRMED - RESPONSE FROM /api/webhook/route.ts 🚨",
      webhookResults: results,
      debugInfo: {
        timestamp: new Date().toISOString(),
        endpoint: "/api/webhook/route.ts",
        version: "WEBHOOK_DEBUG_VERSION_2.0",
        webhookUrlsCount: webhookUrls.length,
        payloadSent: testWebhookPayload,
        makeComResponses: results.filter(r => r !== null).map(r => ({
          url: r!.url,
          status: r!.status,
          responseBody: r!.responseBody
        }))
      }
    })

  } catch (error) {
    console.error("Test Webhook endpoint error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
