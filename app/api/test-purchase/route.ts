import { type NextRequest, NextResponse } from "next/server"
import { initializeMeta, isMetaConfigured } from "@/lib/meta-config"
import { trackPurchase } from "@/lib/meta-conversion-api"

export async function POST(request: NextRequest) {
  // Test endpoints are dev-only utilities. Block in production so the public
  // URL can't be used to inject fake Purchase events into the live Meta stream.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test endpoints are disabled in production' },
      { status: 403 },
    )
  }

  console.log('🛒 TEST PURCHASE ENDPOINT CALLED')

  try {
    const data = await request.json()
    
    // Initialize Meta Conversion API
    initializeMeta()
    
    if (!isMetaConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Meta Conversion API not configured',
        details: 'Missing NEXT_PUBLIC_META_PIXEL_ID or META_CONVERSION_ACCESS_TOKEN'
      }, { status: 400 })
    }

    // Get client information from request headers
    const clientIp = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    '127.0.0.1'
    const userAgent = request.headers.get('user-agent') || ''
    const sourceUrl = request.headers.get('referer') || 'https://soumissionconfort.com'

    console.log('📊 Tracking Purchase event with data:', {
      email: data.email,
      value: data.value,
      currency: data.currency || 'USD',
      clientIp,
      userAgent: userAgent.substring(0, 50) + '...'
    })

    // Track Purchase event
    const result = await trackPurchase({
      email: data.email,
      phone: data.phone,
      firstName: data.firstName,
      lastName: data.lastName,
      value: data.value,
      currency: data.currency || 'USD',
      clientIp,
      userAgent,
      sourceUrl,
      attributionShare: data.attributionShare || '0.3',
      contentName: data.contentName || 'Test Purchase',
      contentType: data.contentType || 'test'
    })

    if (result.success) {
      console.log('✅ Purchase event tracked successfully')
      return NextResponse.json({
        success: true,
        message: 'Purchase event tracked successfully',
        data: result.data
      })
    } else {
      console.error('❌ Purchase event tracking failed:', result.error)
      return NextResponse.json({
        success: false,
        error: 'Failed to track purchase event',
        details: result.error
      }, { status: 500 })
    }

  } catch (error) {
    console.error('💥 Test Purchase endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
