import { type NextRequest, NextResponse } from "next/server"
import { initializeMetaConversionAPI } from "@/lib/meta-conversion-api"

export async function GET(request: NextRequest) {
  // Test endpoints are dev-only utilities. Block in production so the public
  // URL can't be used to inject fake leads ("test@example.com") into the live
  // Meta attribution stream.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test endpoints are disabled in production' },
      { status: 403 },
    )
  }

  console.log('🧪 TEST THERMOPOMPE: Starting test event')

  try {
    const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
    const metaAccessToken = process.env.META_CONVERSION_ACCESS_TOKEN
    const testEventCode = process.env.META_TEST_EVENT_CODE
    
    console.log('🔍 TEST THERMOPOMPE: Pixel ID configured:', !!metaPixelId)
    console.log('🔍 TEST THERMOPOMPE: Access Token configured:', !!metaAccessToken)
    console.log('🔍 TEST THERMOPOMPE: Test Event Code:', testEventCode)
    
    if (!metaPixelId || !metaAccessToken) {
      return NextResponse.json({
        success: false,
        error: 'Meta Pixel credentials not configured',
        details: {
          hasPixelId: !!metaPixelId,
          hasAccessToken: !!metaAccessToken
        }
      }, { status: 500 })
    }
    
    // Initialize Meta API with test event code
    const metaAPI = initializeMetaConversionAPI(metaPixelId, metaAccessToken, testEventCode)
    
    // Get client info from request
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                    request.headers.get('x-real-ip') || 
                    '127.0.0.1'
    const userAgent = request.headers.get('user-agent') || 'Test User Agent'
    
    console.log('📊 TEST THERMOPOMPE: Sending test Lead event with service_type: thermopompe')
    
    // Send test lead event
    const result = await metaAPI.trackLead({
      email: 'test@example.com',
      phone: '+15145551234',
      firstName: 'Test',
      lastName: 'Thermopompe',
      value: 15000,
      clientIp,
      userAgent,
      sourceUrl: `${request.headers.get('origin') || 'https://soumissionconfort.ai'}/thermopompes`,
      customData: {
        service_type: 'thermopompe',
        test_event: true
      }
    })
    
    console.log('📥 TEST THERMOPOMPE: Meta API response:', result)
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: '✅ Test thermopompe Lead event sent successfully!',
        details: {
          pixelId: metaPixelId,
          testEventCode: testEventCode,
          eventData: {
            email: 'test@example.com (hashed)',
            phone: '+15145551234 (hashed)',
            firstName: 'Test (hashed)',
            lastName: 'Thermopompe (hashed)',
            value: 15000,
            service_type: 'thermopompe',
            clientIp,
            userAgent: userAgent.substring(0, 50) + '...'
          },
          metaResponse: result.data
        },
        instructions: testEventCode 
          ? '🔍 Check Meta Events Manager > Test Events tab to see this event'
          : '🔍 Check Meta Events Manager > Events tab to see this event'
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to send event to Meta',
        details: result.error
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('❌ TEST THERMOPOMPE: Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
