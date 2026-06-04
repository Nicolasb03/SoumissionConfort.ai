import { type NextRequest, NextResponse } from "next/server"
import { initializeMetaConversionAPI } from "@/lib/meta-conversion-api"
import { isGHLEnabled, postLeadToGHL, type LeadVertical, type NormalizedLead } from "@/lib/ghl-client"
import { isValidQuebecPhone, normalizePhone } from "@/lib/phone"
import { verifyOtpToken } from "@/lib/otp-token"

console.log('🔥🔥🔥 LEADS API FILE LOADED - THIS SHOULD SHOW ON SERVER START 🔥🔥🔥')

const OTP_REQUIRED = process.env.NEXT_PUBLIC_OTP_ENABLED === 'true'

export async function POST(request: NextRequest) {
  console.log('🚨🚨🚨 LEADS API ENDPOINT CALLED - START OF FUNCTION 🚨🚨🚨')
  console.log('🕐 TIMESTAMP:', new Date().toISOString())
  console.log('🌍 REQUEST URL:', request.url)
  console.log('📍 REQUEST METHOD:', request.method)

  try {
    const leadData = await request.json()
    console.log('🔥 LEADS API: Received lead data:', JSON.stringify(leadData, null, 2))

    // ────────────────────────────────────────────────────────────────────
    // Phone validation + OTP token check (fail-closed before CRM writes)
    // ────────────────────────────────────────────────────────────────────
    if (!isValidQuebecPhone(leadData.phone)) {
      return NextResponse.json(
        { error: 'Numéro de téléphone invalide.', code: 'INVALID_PHONE' },
        { status: 400 },
      )
    }
    const e164Phone = normalizePhone(leadData.phone)
    if (!e164Phone) {
      return NextResponse.json(
        { error: 'Numéro de téléphone invalide.', code: 'INVALID_PHONE' },
        { status: 400 },
      )
    }

    if (OTP_REQUIRED) {
      // Bind token verification to the leadId when the client supplied a
      // well-formed one. /api/verify-otp issues the token with this leadId
      // in its claims, so a leaked token cannot be replayed against a
      // different lead within the 15min TTL.
      const candidateLeadId =
        typeof leadData.leadId === 'string' && /^LEAD[A-Za-z0-9]{8,}$/.test(leadData.leadId)
          ? leadData.leadId
          : null
      const tokenResult = await verifyOtpToken(leadData.otpToken, e164Phone, candidateLeadId)
      if (!tokenResult.ok) {
        const codeMap = {
          EXPIRED: { status: 401, code: 'OTP_TOKEN_EXPIRED' as const, msg: 'Code OTP expiré.' },
          PHONE_MISMATCH: { status: 401, code: 'OTP_TOKEN_INVALID' as const, msg: 'Jeton OTP invalide.' },
          LEAD_ID_MISMATCH: { status: 401, code: 'OTP_TOKEN_INVALID' as const, msg: 'Jeton OTP invalide.' },
          INVALID: { status: 401, code: 'OTP_TOKEN_INVALID' as const, msg: 'Jeton OTP invalide.' },
          MISCONFIGURED: { status: 500, code: 'OTP_TOKEN_MISCONFIGURED' as const, msg: 'Configuration serveur manquante.' },
        }
        const m = codeMap[tokenResult.reason]
        console.error('🚫 LEADS API: OTP token check failed:', tokenResult.reason)
        return NextResponse.json({ error: m.msg, code: m.code }, { status: m.status })
      }
      // Replace the (possibly differently formatted) client phone with the
      // canonical E.164 form proven by the OTP token. Downstream payloads
      // become consistent and GHL gets the validated value.
      leadData.phone = e164Phone
    } else {
      leadData.phone = e164Phone
    }

    const leadType = leadData.leadType || 'isolation'
    const isHVAC = leadType === 'hvac'
    const isSubvention = leadType === 'subvention'
    const isSoumissionRapide = leadType === 'isolation_soumission_rapide'

    // Validate required fields by lead type
    if (isHVAC) {
      const requiredFields = ["firstName", "lastName", "email", "phone", "address"]
      for (const field of requiredFields) {
        if (!leadData[field]) {
          return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
        }
      }
    } else if (isSubvention || isSoumissionRapide) {
      const requiredFields = ["firstName", "lastName", "email", "phone"]
      for (const field of requiredFields) {
        if (!leadData[field]) {
          return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
        }
      }
    } else {
      const requiredFields = ["firstName", "lastName", "email", "phone", "roofData", "userAnswers", "pricingData"]
      for (const field of requiredFields) {
        if (!leadData[field]) {
          return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
        }
      }
    }

    // Extract UTM parameters if provided
    const utmParams = leadData.utmParams || {}
    console.log('🏷️ LEADS API: UTM Parameters received:', utmParams)

    // Meta CAPI advanced-matching extras (EMQ). fbp/fbc are the browser cookies
    // (_fbp/_fbc) forwarded in the payload so the CAPI Lead matches/dedups against
    // the browser Lead (the server can't read those cookies itself). If _fbc is
    // absent but we captured an fbclid, rebuild it as fb.1.<seconds>.<fbclid>
    // (timestamp is approximate but still improves matching). The email is reused
    // as external_id (hashed inside trackLead).
    const metaFbp: string | undefined =
      typeof leadData.fbp === 'string' && leadData.fbp ? leadData.fbp : undefined
    const metaFbc: string | undefined =
      typeof leadData.fbc === 'string' && leadData.fbc
        ? leadData.fbc
        : utmParams.fbclid
          ? `fb.1.${Math.floor(Date.now() / 1000)}.${utmParams.fbclid}`
          : undefined

    // Lead ID: honor a client-supplied value when it matches our format
    // (the funnel needs the ID in the URL before /api/leads is called when
    // OTP_ENABLED=true). Otherwise generate one server-side.
    const clientLeadId = typeof leadData.leadId === 'string' ? leadData.leadId : ''
    const isWellFormedLeadId = /^LEAD[A-Za-z0-9]{8,}$/.test(clientLeadId)
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 10) // 8 character random string
    const leadId = isWellFormedLeadId ? clientLeadId : `LEAD${timestamp}${randomString}`

    // Helpers to present data in French for HVAC leads
    const formatBoolFr = (val: any) => val === true ? 'Oui' : val === false ? 'Non' : ''
    const translateHeatingType = (type?: string) => {
      switch (type) {
        case 'electric': return 'Électricité'
        case 'oil-gas': return 'Mazout / Gaz'
        case 'gas': return 'Gaz'
        case 'bi-energy': return 'Bi-énergie'
        case 'forced-air': return 'Air pulsé'
        default: return type || ''
      }
    }
    const translateGarage = (type?: string) => {
      switch (type) {
        case 'double': return 'Garage double'
        case 'single': return 'Garage simple'
        case 'none': return 'Aucun garage'
        default: return type || ''
      }
    }

    // Normalize location data once — used by both GHL and legacy webhook branches
    const rawAddress = leadData.address || leadData.userAnswers?.address || leadData.roofData?.address || ""
    let extractedCity = leadData.city || leadData.roofData?.city || leadData.ville || ""
    let extractedPostalCode = leadData.postalCode || leadData.roofData?.postalCode || ""

    if (!extractedCity && rawAddress) {
      // Format typique Google: "123 Rue X, Montreal, QC H2X 1Y4, Canada"
      const parts = rawAddress.split(',').map((p: string) => p.trim())
      if (parts.length >= 3) {
        extractedCity = parts[1] || ""
      } else if (parts.length === 2) {
        extractedCity = parts[0] || ""
      }
    }

    if (!extractedPostalCode && rawAddress) {
      const match = rawAddress.match(/[A-Za-z]\d[A-Za-z]\s*\d[A-Za-z]\d/)
      if (match) extractedPostalCode = match[0].toUpperCase().trim()
    }

    const extractedProvince = leadData.province || leadData.roofData?.coordinates?.province || ''
    console.log('📍 LEADS API: Normalized location:', { rawAddress, extractedCity, extractedPostalCode, extractedProvince })

    // GHL DIRECT branch — controlled by GHL_ENABLED env flag.
    // When enabled, contact goes straight to GoHighLevel (Make/Close bypassed).
    // When disabled, the legacy Make webhook path runs unchanged.
    if (isGHLEnabled()) {
      console.log('🟢 LEADS API: GHL_ENABLED=true → posting to GoHighLevel directly')
      try {
        const vertical: LeadVertical = isHVAC
          ? 'hvac'
          : isSubvention
          ? 'subvention'
          : isSoumissionRapide
          ? 'isolation_soumission_rapide'
          : 'isolation'

        const ghlPayload: NormalizedLead = {
          vertical,
          firstName: leadData.firstName,
          lastName: leadData.lastName,
          email: leadData.email,
          phone: leadData.phone,
          address1: rawAddress || undefined,
          city: extractedCity || undefined,
          state: extractedProvince || undefined,
          postalCode: extractedPostalCode || undefined,
          utmSource: utmParams.utm_source,
          utmCampaign: utmParams.utm_campaign,
          utmContent: utmParams.utm_content,
          utmMedium: utmParams.utm_medium,
          utmTerm: utmParams.utm_term,
          fbclid: utmParams.fbclid,
          landingPage: leadData.landingPage,
          leadSource: leadData.source || 'soumission-confort-ai',
          internalLeadId: leadId,
          custom: {
            ...(isHVAC && {
              superficie_total: leadData.finalArea || leadData.roofData?.roofArea,
              annee_de_construction: leadData.thermal?.constructionYear,
              isolation_renovee: leadData.thermal?.insulationUpgraded ? 'Oui' : 'Non',
              systeme_de_chauffage: leadData.thermal?.currentHeatingType,
              garage: leadData.geometric?.garageType,
              nombre_d_etages: leadData.geometric?.floors,
              soussol_fini: leadData.geometric?.hasFinishedBasement ? 'Oui' : 'Non',
              souhaite_extraire_le_mazout: leadData.wantsOilTankRemoval ? 'Oui' : 'Non',
              prix_minimum: leadData.estimatedPriceMin,
              prix_maximum: leadData.estimatedPriceMax,
              latitude: leadData.coordinates?.lat?.toString() || leadData.roofData?.coordinates?.lat?.toString(),
              longitude: leadData.coordinates?.lng?.toString() || leadData.roofData?.coordinates?.lng?.toString(),
              province: leadData.province || leadData.roofData?.coordinates?.province || 'QC',
              prix: leadData.estimatedPrice,
            }),
            ...(!isHVAC && !isSubvention && !isSoumissionRapide && {
              hauteur_du_batiment: leadData.roofData?.buildingHeight,
              isolation_actuelle: leadData.userAnswers?.currentInsulation,
              acces_entretoit: leadData.userAnswers?.atticAccess,
              systeme_de_chauffage: leadData.userAnswers?.heatingSystem,
              // V2 funnel fields — wired Phase 2 (IDs in GHL_FIELDS_ISO 41-43).
              // V1 defaults above are kept for backward-compat with existing
              // GHL workflows; these add the real V2 answers alongside.
              symptoms: Array.isArray(leadData.userAnswers?.symptoms)
                ? leadData.userAnswers.symptoms.join(',')
                : leadData.userAnswers?.symptoms,
              hydro_bracket: leadData.userAnswers?.hydroBracket,
              intent: leadData.userAnswers?.intent,
              problemes_identifies: Array.isArray(leadData.userAnswers?.identifiedProblems)
                ? leadData.userAnswers.identifiedProblems.join(', ')
                : leadData.userAnswers?.identifiedProblems,
              econo__prix_min: leadData.pricingData?.ranges?.economique?.totalCost?.min,
              econo__prix_max: leadData.pricingData?.ranges?.economique?.totalCost?.max,
              standard__prix_min: leadData.pricingData?.ranges?.standard?.totalCost?.min,
              standard__prix_max: leadData.pricingData?.ranges?.standard?.totalCost?.max,
              premium__prix_min: leadData.pricingData?.ranges?.premium?.totalCost?.min,
              premium__prix_max: leadData.pricingData?.ranges?.premium?.totalCost?.max,
              superficie_total: leadData.roofData?.roofArea,
              latitude: leadData.roofData?.coordinates?.lat?.toString(),
              longitude: leadData.roofData?.coordinates?.lng?.toString(),
              province: leadData.roofData?.coordinates?.province || 'QC',
              forme_du_toit: leadData.roofData?.roofShape,
              complexite_pente: leadData.roofData?.pitchComplexity,
              obstacles: Array.isArray(leadData.roofData?.obstacles)
                ? leadData.roofData.obstacles.join(', ')
                : leadData.roofData?.obstacles,
              nb_segments_toiture: leadData.roofData?.segments,
              surface_utilisable: leadData.roofData?.usableArea,
              difficulte_acces: leadData.roofData?.accessDifficulty,
            }),
            ...(isSoumissionRapide && {
              type_habitation: leadData.userAnswers?.habitationType,
              statut_proprietaire: leadData.userAnswers?.ownershipStatus,
              isolation_actuelle: leadData.userAnswers?.insulationStatus || leadData.userAnswers?.currentInsulation,
              latitude: leadData.coordinates?.lat?.toString(),
              longitude: leadData.coordinates?.lng?.toString(),
              province: leadData.province || 'QC',
            }),
            ...(isSubvention && {
              eligible_subvention: leadData.eligible ? 'Oui' : 'Non',
              type_habitation: leadData.subventionAnswers?.buildingType,
              statut_proprietaire: leadData.subventionAnswers?.owner === 'oui' ? 'Propriétaire' : 'Non-propriétaire',
              systeme_de_chauffage: leadData.subventionAnswers?.heating,
              isolation_actuelle: leadData.subventionAnswers?.insulation,
            }),
          },
        }

        // Phase 2 V2: dynamic qualification tag for the /analysis funnel.
        //  - qualified → 'Lead Iso Hot' + drop 'Lead Iso Curieux' (override).
        //  - curious   → 'Lead Iso Curieux' (no removal: once hot, stays hot —
        //    qualified→curious does NOT strip 'Lead Iso Hot', Zack v2 décision 8).
        if (vertical === 'isolation' && leadData.userAnswers?.intent) {
          if (leadData.userAnswers.intent === 'qualified') {
            ghlPayload.tagOverride = 'Lead Iso Hot'
            ghlPayload.tagsToRemove = ['Lead Iso Curieux']
          } else if (leadData.userAnswers.intent === 'curious') {
            ghlPayload.tagOverride = 'Lead Iso Curieux'
          }
        }

        const ghlResult = await postLeadToGHL(ghlPayload)
        console.log('🟢 LEADS API: GHL post result:', ghlResult)

        if (!ghlResult.contactId) {
          console.error('❌ LEADS API: GHL contact creation failed', ghlResult.contactError)
          return NextResponse.json(
            {
              success: false,
              leadId,
              error: ghlResult.contactError || 'GHL contact creation failed',
              ghl: ghlResult,
            },
            { status: 502 },
          )
        }

        // Mirror the legacy Meta CAPI server-side call so attribution survives
        // the GHL cutover. The legacy block at the bottom of this file is
        // skipped by the early return below; without this duplicate, GHL
        // contacts wouldn't get a Meta Lead event.
        //
        // Phase 2 V2: for vertical='isolation' (the /analysis funnel) the Lead
        // routes to the DEDICATED soumissionconfort pixel and is gated by
        // intent === 'qualified'. Every other vertical stays on the shared
        // pixel, ungated, exactly as before.
        try {
          // Isolation 2026-06 : SEUL le funnel /analysis (vertical isolation)
          // alimente Meta. Les autres verticals (hvac/subvention/rapide)
          // n'envoient plus AUCUN event CAPI — le canal partagé est mort.
          if (vertical !== 'isolation') {
            console.log(`[leads] skip Meta CAPI Lead — vertical='${vertical}' (shared channel disabled)`)
          } else {
            // .trim(): a trailing \n in the Vercel env value makes the CAPI POST
            // hit graph.facebook.com/<id>%0A/events → Lead silently lost (incident
            // 2026-06-03). Ids/tokens never carry meaningful edge whitespace.
            const metaPixelId = (process.env.NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT || '').trim()
            const metaAccessToken = (process.env.META_CONVERSION_ACCESS_TOKEN_SOUMISSIONCONFORT || '').trim()
            const metaTestEventCode = (process.env.META_TEST_EVENT_CODE_SOUMISSIONCONFORT || '').trim() || undefined

            const isPlaceholder = (v?: string) => !!v && /^X+$/i.test(v)
            // Isolation Lead stays intent-gated (Zack v2 décision : qualified only).
            const intentGateOk = leadData.userAnswers?.intent === 'qualified'
            // isTest gate (Zack v2 décision 7): replay/debug payloads never reach Meta.
            const isTestLead = leadData.isTest === true

            if (
              !isTestLead
              && metaPixelId && metaAccessToken
              && !isPlaceholder(metaPixelId) && !isPlaceholder(metaAccessToken)
              && intentGateOk
            ) {
              const metaAPI = initializeMetaConversionAPI(metaPixelId, metaAccessToken, metaTestEventCode)
              const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                               request.headers.get('x-real-ip') || 'unknown'
              const userAgent = request.headers.get('user-agent') || 'unknown'
              const stdMin = leadData.pricingData?.ranges?.standard?.totalCost?.min || 0
              const stdMax = leadData.pricingData?.ranges?.standard?.totalCost?.max || 0
              const estimatedValue = (stdMin + stdMax) / 2
              const origin = request.headers.get('origin') || 'https://www.soumissionconfort.com'
              await metaAPI.trackLead({
                email: leadData.email,
                phone: leadData.phone,
                firstName: leadData.firstName,
                lastName: leadData.lastName,
                value: estimatedValue,
                clientIp,
                userAgent,
                sourceUrl: `${origin}/analysis`,
                eventId: leadData.eventId || undefined,
                fbp: metaFbp,
                fbc: metaFbc,
                externalId: leadData.email,
                customData: { service_type: 'isolation' },
              })
              console.log('✅ LEADS API: Meta CAPI Lead sent (GHL branch, isolation, dedicated pixel)')
            } else if (isTestLead) {
              console.log('[leads] skip Meta CAPI Lead — isTest=true')
            } else if (!intentGateOk) {
              console.log('[leads] skip Meta CAPI Lead — intent !== qualified')
            } else if (isPlaceholder(metaPixelId) || isPlaceholder(metaAccessToken)) {
              console.warn('[leads] skip Meta CAPI Lead — soumissionconfort pixel/token is placeholder XXXXXX')
            } else {
              console.warn('⚠️ LEADS API: Meta CAPI not configured (GHL branch)')
            }
          }
        } catch (metaErr) {
          console.error('❌ LEADS API: Meta CAPI error in GHL branch:', metaErr)
          // Don't fail the request if Meta tracking fails
        }

        // Return early so we skip the Make webhook code path.
        return NextResponse.json({
          success: true,
          leadId,
          message: '✅ LEADS API: Lead sent to GoHighLevel',
          ghl: ghlResult,
          debugInfo: {
            timestamp: new Date().toISOString(),
            endpoint: '/api/leads/route.ts',
            version: 'GHL_DIRECT',
            generatedLeadId: leadId,
            ghlEnabled: true,
          },
        })
      } catch (ghlError) {
        console.error('💥 LEADS API: GHL branch error:', ghlError)
        return NextResponse.json(
          {
            success: false,
            leadId,
            error: ghlError instanceof Error ? ghlError.message : 'GHL branch crashed',
          },
          { status: 500 },
        )
      }
    }

    // Send to webhook endpoints - DIRECT CALL TO MAKE.COM (legacy path)
    try {
      console.log('🚨 LEADS API: ENTERING WEBHOOK TRY BLOCK')
      console.log('🚨🚨🚨 LEADS API: ABOUT TO CALL WEBHOOK DIRECTLY 🚨🚨🚨')

      // Get webhook URLs directly from environment
      const webhookUrlsEnv = process.env.WEBHOOK_URLS
      console.log('🔍 LEADS API: WEBHOOK_URLS configured:', webhookUrlsEnv ? 'YES' : 'NO')

      if (!webhookUrlsEnv) {
        console.error('❌ LEADS API: No webhook URLs configured')
        throw new Error('WEBHOOK_URLS not configured')
      }
      
      const webhookUrls = webhookUrlsEnv.split(',').map(url => url.trim()).filter(url => url.length > 0)
      console.log('🌐 LEADS API: Webhook URLs count:', webhookUrls.length)
      console.log('📋 LEADS API: Webhook URLs:', webhookUrls)
      
      // Prepare webhook payload depending on lead type
      const webhookPayload = isSoumissionRapide
        ? {
            timestamp: new Date().toISOString(),
            leadId,
            webhookType: "isolation_soumission_rapide",
            leadType,
            contact: {
              firstName: leadData.firstName,
              lastName: leadData.lastName,
              email: leadData.email,
              phone: leadData.phone,
            },
            property: {
              address: rawAddress || "",
              city: extractedCity || "",
              postalCode: extractedPostalCode || "",
              ville: leadData.ville || "",
            },
            projectDetails: {
              projectType: leadData.userAnswers?.projectType || "",
              currentInsulation: leadData.userAnswers?.currentInsulation || "",
              problems: leadData.userAnswers?.problems || "",
              timeline: leadData.userAnswers?.timeline || "",
              contactTime: leadData.userAnswers?.contactTime || "",
            },
            utmParams,
            source: "soumission-rapide-isolation",
          }
        : isSubvention
        ? {
            timestamp: new Date().toISOString(),
            leadId,
            webhookType: "subvention_contact",
            leadType,
            contact: {
              firstName: leadData.firstName,
              lastName: leadData.lastName,
              email: leadData.email,
              phone: leadData.phone,
            },
            property: {
              address: leadData.address || "",
            },
            subventionDetails: {
              answers: leadData.subventionAnswers || {},
              eligible: leadData.eligible || false,
              eligibilityCriteria: leadData.eligibilityCriteria || [],
            },
            utmParams,
            source: "soumission-subvention-ai",
          }
        : isHVAC
        ? {
            timestamp: new Date().toISOString(),
            leadId,
            webhookType: "hvac_contact",
            leadType,
            contact: {
              firstName: leadData.firstName,
              lastName: leadData.lastName,
              email: leadData.email,
              phone: leadData.phone,
            },
            property: {
              address: leadData.address || leadData.roofData?.address || "",
              postalCode: leadData.postalCode || leadData.roofData?.postalCode || "",
              city: leadData.city || leadData.roofData?.city || "",
              roofArea: leadData.finalArea || leadData.roofData?.roofArea || 0,
              coordinates: leadData.roofData?.coordinates || null,
            },
            projectDetails: {
              constructionYear: leadData.thermal?.constructionYear || "",
              insulationUpgraded: leadData.thermal?.insulationUpgraded,
              currentHeatingType: leadData.thermal?.currentHeatingType || "",
              garageType: leadData.geometric?.garageType || "",
              floors: leadData.geometric?.floors || 0,
              hasFinishedBasement: leadData.geometric?.hasFinishedBasement,
              wantsOilTankRemoval: leadData.wantsOilTankRemoval,
            },
            pricing: {
              estimatedPrice: leadData.estimatedPrice || null,
              estimatedPriceMin: leadData.estimatedPriceMin || null,
              estimatedPriceMax: leadData.estimatedPriceMax || null,
            },
            utmParams,
            source: "soumission-hvac-ai",
          }
        : {
            timestamp: new Date().toISOString(),
            leadId: leadId, // Consistent leadId for webhook linking
            webhookType: "isolation_contact", // First webhook type
            contact: {
              firstName: leadData.firstName,
              lastName: leadData.lastName,
              email: leadData.email,
              phone: leadData.phone,
            },
            property: {
              address: leadData.roofData?.address || "",
              city: leadData.roofData?.city || "",
              postalCode: leadData.roofData?.postalCode || "",
              roofArea: leadData.roofData?.roofArea || 0,
              buildingHeight: leadData.roofData?.buildingHeight || 0,
              pitchComplexity: leadData.roofData?.pitchComplexity || "",
              obstacles: leadData.roofData?.obstacles || [],
              coordinates: leadData.roofData?.coordinates || null,
            },
            projectDetails: {
              // Questions d'isolation
              heatingSystem: leadData.userAnswers?.heatingSystem || "",
              currentInsulation: leadData.userAnswers?.currentInsulation || "",
              atticAccess: leadData.userAnswers?.atticAccess || "",
              identifiedProblems: leadData.userAnswers?.identifiedProblems || [],
              
              // Anciennes questions (pour compatibilité)
              roofConditions: leadData.userAnswers?.roofConditions || leadData.userAnswers?.identifiedProblems || [],
              roofAge: leadData.userAnswers?.roofAge || "",
              roofMaterial: leadData.userAnswers?.roofMaterial || "",
              propertyAccess: leadData.userAnswers?.propertyAccess || leadData.userAnswers?.atticAccess || "",
              serviceType: leadData.userAnswers?.serviceType || [],
              timeline: leadData.userAnswers?.timeline || "",
              contactPreference: leadData.userAnswers?.contactPreference || "",
              contactTime: leadData.userAnswers?.contactTime || "",
            },
            pricing: {
              // Fourchette principale (Standard - recommandée)
              estimatedCost: leadData.pricingData || null,
              
              // 3 Fourchettes de prix détaillées
              ranges: {
                economique: {
                  name: "Économique",
                  type: "Fibre de verre soufflée",
                  rValue: 50,
                  min: leadData.pricingData?.ranges?.economique?.totalCost?.min || null,
                  max: leadData.pricingData?.ranges?.economique?.totalCost?.max || null,
                  annualSavings: {
                    min: leadData.pricingData?.ranges?.economique?.annualSavings?.min || null,
                    max: leadData.pricingData?.ranges?.economique?.annualSavings?.max || null,
                  },
                  paybackPeriod: {
                    min: leadData.pricingData?.ranges?.economique?.paybackPeriod?.min || null,
                    max: leadData.pricingData?.ranges?.economique?.paybackPeriod?.max || null,
                  },
                },
                standard: {
                  name: "Standard",
                  type: "Cellulose soufflée",
                  rValue: 55,
                  recommended: true,
                  min: leadData.pricingData?.ranges?.standard?.totalCost?.min || null,
                  max: leadData.pricingData?.ranges?.standard?.totalCost?.max || null,
                  annualSavings: {
                    min: leadData.pricingData?.ranges?.standard?.annualSavings?.min || null,
                    max: leadData.pricingData?.ranges?.standard?.annualSavings?.max || null,
                  },
                  paybackPeriod: {
                    min: leadData.pricingData?.ranges?.standard?.paybackPeriod?.min || null,
                    max: leadData.pricingData?.ranges?.standard?.paybackPeriod?.max || null,
                  },
                },
                premium: {
                  name: "Premium",
                  type: "Uréthane giclé",
                  rValue: 60,
                  min: leadData.pricingData?.ranges?.premium?.totalCost?.min || null,
                  max: leadData.pricingData?.ranges?.premium?.totalCost?.max || null,
                  annualSavings: {
                    min: leadData.pricingData?.ranges?.premium?.annualSavings?.min || null,
                    max: leadData.pricingData?.ranges?.premium?.annualSavings?.max || null,
                  },
                  paybackPeriod: {
                    min: leadData.pricingData?.ranges?.premium?.paybackPeriod?.min || null,
                    max: leadData.pricingData?.ranges?.premium?.paybackPeriod?.max || null,
                  },
                },
              },
              
              // Détails supplémentaires
              adjustedArea: leadData.pricingData?.adjustedArea || leadData.roofData?.roofArea || 0,
              calculationFactors: {
                pitchMultiplier: leadData.pricingData?.pitchMultiplier || 1.0,
                accessMultiplier: leadData.pricingData?.accessMultiplier || 1.0,
                currentRValue: leadData.pricingData?.currentRValue || 0,
              },
            },
            utmParams: utmParams, // Include UTM parameters in webhook payload
            source: "soumission-toiture-ai",
          }
      
      console.log('🔍 LEADS API: EXACT WEBHOOK PAYLOAD BEING SENT:')
      console.log('📦 LEADS API: Full payload:', JSON.stringify(webhookPayload, null, 2))
      console.log('📏 LEADS API: Payload size:', JSON.stringify(webhookPayload).length, 'characters')
      console.log('🎯 LEADS API: Contact info:', webhookPayload.contact)
      console.log('🏠 LEADS API: Property info:', webhookPayload.property)
      console.log('📋 LEADS API: Project details:', webhookPayload.projectDetails)
      console.log('💰 LEADS API: Pricing info:', webhookPayload.pricing)
      console.log('🏷️ LEADS API: UTM Parameters:', webhookPayload.utmParams)
      
      // Prepare formatted payload for Make.com (matching Google Sheets structure)
      const makeComPayload = isSoumissionRapide
        ? {
            "Prénom (A)": webhookPayload.contact.firstName,
            "Nom (B)": webhookPayload.contact.lastName,
            "Adresse courriel (C)": webhookPayload.contact.email,
            "Téléphone (D)": webhookPayload.contact.phone,
            "Adresse (E)": (webhookPayload as any).property?.address || "",
            "Code postal (E2)": (webhookPayload as any).property?.postalCode || "",
            "Ville (E3)": (webhookPayload as any).property?.city || (webhookPayload as any).property?.ville || "",
            "Type de projet (F)": (webhookPayload as any).projectDetails?.projectType || "",
            "Isolation actuelle (G)": (webhookPayload as any).projectDetails?.currentInsulation || "",
            "Problèmes (H)": (webhookPayload as any).projectDetails?.problems || "",
            "Échéancier (I)": (webhookPayload as any).projectDetails?.timeline || "",
            "Heure de contact (J)": (webhookPayload as any).projectDetails?.contactTime || "",
            "UTM Source (AF)": webhookPayload.utmParams?.utm_source || "",
            "UTM Campaign (AG)": webhookPayload.utmParams?.utm_campaign || "",
            "UTM Content (AH)": webhookPayload.utmParams?.utm_content || "",
            "UTM Medium (AI)": webhookPayload.utmParams?.utm_medium || "",
            "UTM Term (AJ)": webhookPayload.utmParams?.utm_term || "",
            "Lead ID (AK)": leadId,
            "Webhook Type (AL)": "isolation_soumission_rapide"
          }
        : isSubvention
        ? {
            "Prénom (A)": webhookPayload.contact.firstName,
            "Nom (B)": webhookPayload.contact.lastName,
            "Adresse courriel (C)": webhookPayload.contact.email,
            "Téléphone (D)": webhookPayload.contact.phone,
            "Adresse (E)": (webhookPayload as any).property?.address || "",
            "Admissible (F)": (webhookPayload as any).subventionDetails?.eligible ? "Oui" : "Non",
            "Réponses subvention (G)": JSON.stringify((webhookPayload as any).subventionDetails?.answers || {}),
            "Critères éligibilité (H)": JSON.stringify((webhookPayload as any).subventionDetails?.eligibilityCriteria || []),
            "UTM Source (AF)": webhookPayload.utmParams?.utm_source || "",
            "UTM Campaign (AG)": webhookPayload.utmParams?.utm_campaign || "",
            "UTM Content (AH)": webhookPayload.utmParams?.utm_content || "",
            "UTM Medium (AI)": webhookPayload.utmParams?.utm_medium || "",
            "UTM Term (AJ)": webhookPayload.utmParams?.utm_term || "",
            "Lead ID (AK)": leadId,
            "Webhook Type (AL)": "subvention_contact"
          }
        : isHVAC
        ? {
            "Prénom (A)": webhookPayload.contact.firstName,
            "Nom (B)": webhookPayload.contact.lastName,
            "Adresse courriel (C)": webhookPayload.contact.email,
            "Téléphone (D)": webhookPayload.contact.phone,
            "Adresse (E)": webhookPayload.property.address || "",
            "Code postal (F)": webhookPayload.property.postalCode || "",
            "Ville (G)": webhookPayload.property.city || "",
            "Superficie (H)": webhookPayload.property.roofArea || 0,
            "Type chauffage actuel (I)": translateHeatingType(webhookPayload.projectDetails?.currentHeatingType),
            "Année construction (J)": webhookPayload.projectDetails?.constructionYear || "",
            "Isolation améliorée (K)": formatBoolFr(webhookPayload.projectDetails?.insulationUpgraded),
            "Garage (L)": translateGarage(webhookPayload.projectDetails?.garageType),
            "Étages (M)": webhookPayload.projectDetails?.floors || 0,
            "Sous-sol fini (N)": formatBoolFr(webhookPayload.projectDetails?.hasFinishedBasement),
            "Retrait réservoir mazout (O)": formatBoolFr(webhookPayload.projectDetails?.wantsOilTankRemoval),
            "Prix estimé min (P)": webhookPayload.pricing?.estimatedPriceMin || 0,
            "Prix estimé max (Q)": webhookPayload.pricing?.estimatedPriceMax || 0,
            "UTM Source (AF)": webhookPayload.utmParams?.utm_source || "",
            "UTM Campaign (AG)": webhookPayload.utmParams?.utm_campaign || "",
            "UTM Content (AH)": webhookPayload.utmParams?.utm_content || "",
            "UTM Medium (AI)": webhookPayload.utmParams?.utm_medium || "",
            "UTM Term (AJ)": webhookPayload.utmParams?.utm_term || "",
            "Lead ID (AK)": leadId,
            "Webhook Type (AL)": "hvac_contact"
          }
        : {
            // Contact (A-D)
            "Prénom (A)": webhookPayload.contact.firstName,
            "Nom (B)": webhookPayload.contact.lastName,
            "Adresse courriel (C)": webhookPayload.contact.email,
            "Téléphone (D)": webhookPayload.contact.phone,
            
            // Propriété (E-I)
            "Adresse (E)": webhookPayload.property.address || "",
            "Code postal (F)": webhookPayload.property.postalCode || "",
            "Ville (G)": webhookPayload.property.city || "",
            "Superficie entretoit (H)": webhookPayload.property.roofArea || 0,
            "Hauteur du bâtiment (I)": webhookPayload.property.buildingHeight || 0,
            
            // Questions d'isolation (J-M)
            "Système de chauffage (J)": webhookPayload.projectDetails?.heatingSystem || "",
            "Isolation actuelle (K)": webhookPayload.projectDetails?.currentInsulation || "",
            "Accès entretoit (L)": webhookPayload.projectDetails?.atticAccess || "",
            "Problèmes identifiés (M)": Array.isArray(webhookPayload.projectDetails?.identifiedProblems) 
              ? webhookPayload.projectDetails?.identifiedProblems.join(", ") 
              : webhookPayload.projectDetails?.identifiedProblems || "",
            
            // Gamme Économique (N-S)
            "Économique - Prix min (N)": webhookPayload.pricing?.ranges?.economique?.min || 0,
            "Économique - Prix max (O)": webhookPayload.pricing?.ranges?.economique?.max || 0,
            "Économique - Économies min (P)": webhookPayload.pricing?.ranges?.economique?.annualSavings?.min || 0,
            "Économique - Économies max (Q)": webhookPayload.pricing?.ranges?.economique?.annualSavings?.max || 0,
            "Économique - Retour min (R)": webhookPayload.pricing?.ranges?.economique?.paybackPeriod?.min || 0,
            "Économique - Retour max (S)": webhookPayload.pricing?.ranges?.economique?.paybackPeriod?.max || 0,
            
            // Gamme Standard (T-Y)
            "Standard - Prix min (T)": webhookPayload.pricing?.ranges?.standard?.min || 0,
            "Standard - Prix max (U)": webhookPayload.pricing?.ranges?.standard?.max || 0,
            "Standard - Économies min (V)": webhookPayload.pricing?.ranges?.standard?.annualSavings?.min || 0,
            "Standard - Économies max (W)": webhookPayload.pricing?.ranges?.standard?.annualSavings?.max || 0,
            "Standard - Retour min (X)": webhookPayload.pricing?.ranges?.standard?.paybackPeriod?.min || 0,
            "Standard - Retour max (Y)": webhookPayload.pricing?.ranges?.standard?.paybackPeriod?.max || 0,
            
            // Gamme Premium (Z-AE)
            "Premium - Prix min (Z)": webhookPayload.pricing?.ranges?.premium?.min || 0,
            "Premium - Prix max (AA)": webhookPayload.pricing?.ranges?.premium?.max || 0,
            "Premium - Économies min (AB)": webhookPayload.pricing?.ranges?.premium?.annualSavings?.min || 0,
            "Premium - Économies max (AC)": webhookPayload.pricing?.ranges?.premium?.annualSavings?.max || 0,
            "Premium - Retour min (AD)": webhookPayload.pricing?.ranges?.premium?.paybackPeriod?.min || 0,
            "Premium - Retour max (AE)": webhookPayload.pricing?.ranges?.premium?.paybackPeriod?.max || 0,
            
            // UTM Parameters (AF-AJ)
            "UTM Source (AF)": webhookPayload.utmParams?.utm_source || "",
            "UTM Campaign (AG)": webhookPayload.utmParams?.utm_campaign || "",
            "UTM Content (AH)": webhookPayload.utmParams?.utm_content || "",
            "UTM Medium (AI)": webhookPayload.utmParams?.utm_medium || "",
            "UTM Term (AJ)": webhookPayload.utmParams?.utm_term || "",
            
            // Métadonnées (AK-AL)
            "Lead ID (AK)": leadId,
            "Webhook Type (AL)": "initial_contact"
          }
      
      console.log('📦 LEADS API: Make.com formatted payload:', JSON.stringify(makeComPayload, null, 2))
      
      // Send to all webhook URLs
      const webhookPromises = webhookUrls.map(async (url, index) => {
        try {
          console.log(`📤 LEADS API: Sending to webhook ${index + 1}/${webhookUrls.length}:`, url)
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'Soumission-Toiture-AI/1.0',
            },
            body: JSON.stringify(makeComPayload),
            signal: AbortSignal.timeout(30000)
          })
          
          const responseText = await response.text().catch(() => 'Could not read response body')
          
          console.log(`📥 LEADS API: Webhook ${index + 1} response:`, {
            status: response.status,
            statusText: response.statusText,
            body: responseText.substring(0, 200)
          })
          
          return {
            url,
            status: response.ok ? 'success' : 'error',
            statusCode: response.status,
            responseBody: responseText
          }
        } catch (error) {
          console.error(`❌ LEADS API: Webhook ${index + 1} error:`, error)
          return {
            url,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })
      
      const webhookResults = await Promise.all(webhookPromises)
      const successfulWebhooks = webhookResults.filter(r => r.status === 'success').length
      
      console.log(`✅ LEADS API: Webhooks sent - ${successfulWebhooks}/${webhookUrls.length} successful`)
      
      if (successfulWebhooks > 0) {
        console.log('✅ LEADS API: At least one webhook sent successfully')
      } else {
        console.error('❌ LEADS API: All webhooks failed')
      }
      
      // Server-side Meta Conversion API tracking for ALL lead types.
      // NOTE: this legacy Make path is NOT executed in prod (GHL_ENABLED=true),
      // but we mirror the GHL-branch gating for consistency: isolation routes to
      // the dedicated pixel + intent gate, others stay on the shared pixel,
      // and isTest leads never reach Meta.
      if (successfulWebhooks > 0) {
        try {
          // Isolation 2026-06 : SEUL le funnel /analysis alimente Meta. Les autres
          // verticals ne POSTent plus aucun event CAPI (canal partagé mort). Ce
          // chemin legacy n'est PAS exécuté en prod (GHL_ENABLED), aligné par cohérence.
          if (leadType !== 'isolation') {
            console.log(`[leads] skip Meta CAPI Lead — leadType='${leadType}', shared channel disabled (legacy path)`)
          } else {
            // .trim(): a trailing \n in the Vercel env value makes the CAPI POST
            // hit graph.facebook.com/<id>%0A/events → Lead silently lost (incident
            // 2026-06-03). Ids/tokens never carry meaningful edge whitespace.
            const metaPixelId = (process.env.NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT || '').trim()
            const metaAccessToken = (process.env.META_CONVERSION_ACCESS_TOKEN_SOUMISSIONCONFORT || '').trim()
            const metaTestEventCode = (process.env.META_TEST_EVENT_CODE_SOUMISSIONCONFORT || '').trim() || undefined

            const isPlaceholder = (v?: string) => !!v && /^X+$/i.test(v)
            const intentGateOk = leadData.userAnswers?.intent === 'qualified'
            const isTestLead = leadData.isTest === true

            if (
              !isTestLead
              && metaPixelId && metaAccessToken
              && !isPlaceholder(metaPixelId) && !isPlaceholder(metaAccessToken)
              && intentGateOk
            ) {
              const metaAPI = initializeMetaConversionAPI(metaPixelId, metaAccessToken, metaTestEventCode)

              const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                              request.headers.get('x-real-ip') ||
                              'unknown'
              const userAgent = request.headers.get('user-agent') || 'unknown'

              const stdMin = leadData.pricingData?.ranges?.standard?.totalCost?.min || 0
              const stdMax = leadData.pricingData?.ranges?.standard?.totalCost?.max || 0
              const estimatedValue = (stdMin + stdMax) / 2

              const origin = request.headers.get('origin') || 'https://www.soumissionconfort.com'

              console.log(`📊 LEADS API: Sending server-side Meta Lead event for isolation (eventId: ${leadData.eventId || 'none'}, dedicated pixel)`)

              await metaAPI.trackLead({
                email: leadData.email,
                phone: leadData.phone,
                firstName: leadData.firstName,
                lastName: leadData.lastName,
                value: estimatedValue,
                clientIp,
                userAgent,
                sourceUrl: `${origin}/analysis`,
                eventId: leadData.eventId || undefined,
                fbp: metaFbp,
                fbc: metaFbc,
                externalId: leadData.email,
                customData: {
                  service_type: 'isolation'
                }
              })

              console.log('✅ LEADS API: Server-side Meta Lead event sent successfully for isolation')
            } else if (isTestLead) {
              console.log('[leads] skip Meta CAPI Lead — isTest=true (legacy path)')
            } else if (!intentGateOk) {
              console.log('[leads] skip Meta CAPI Lead — intent !== qualified (legacy path)')
            } else if (isPlaceholder(metaPixelId) || isPlaceholder(metaAccessToken)) {
              console.warn('[leads] skip Meta CAPI Lead — soumissionconfort pixel/token is placeholder XXXXXX (legacy path)')
            } else {
              console.warn('⚠️ LEADS API: Meta Pixel credentials not configured for server-side tracking')
            }
          }
        } catch (metaError) {
          console.error('❌ LEADS API: Meta Conversion API error:', metaError)
          // Don't fail the request if Meta tracking fails
        }
      }
      
      // Return success with webhook results
      return NextResponse.json({
        success: true,
        leadId: leadId,
        message: "✅ LEADS API: Lead processed and webhooks sent",
        webhookResults: webhookResults,
        debugInfo: {
          timestamp: new Date().toISOString(),
          endpoint: "/api/leads/route.ts",
          version: "DIRECT_WEBHOOK_CALL",
          webhooksSent: successfulWebhooks,
          webhooksTotal: webhookUrls.length,
          generatedLeadId: leadId
        }
      })
      
    } catch (webhookError) {
      console.error('💥 LEADS API: Webhook error:', webhookError)
      console.error('💥 LEADS API: Error details:', {
        message: webhookError instanceof Error ? webhookError.message : 'Unknown',
        stack: webhookError instanceof Error ? webhookError.stack : 'No stack'
      })
      
      // Return error response with details
      return NextResponse.json({
        success: false,
        leadId: leadId,
        message: "❌ LEADS API: Webhook failed",
        error: webhookError instanceof Error ? webhookError.message : 'Unknown error',
        debugInfo: {
          timestamp: new Date().toISOString(),
          endpoint: "/api/leads/route.ts",
          version: "WEBHOOK_ERROR",
          errorStack: webhookError instanceof Error ? webhookError.stack : 'No stack'
        }
      }, { status: 500 })
    }
  } catch (error) {
    console.error("Lead submission error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
