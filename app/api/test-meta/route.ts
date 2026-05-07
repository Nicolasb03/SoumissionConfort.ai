import { type NextRequest, NextResponse } from "next/server"
import { initializeMeta, isMetaConfigured } from "@/lib/meta-config"
import { trackLead, trackViewContent } from "@/lib/meta-conversion-api"

export async function POST(request: NextRequest) {
  // Test endpoints are dev-only utilities. Block in production so the public
  // URL can't be used to inject fake leads ("test@example.com") into the live
  // Meta attribution stream.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test endpoints are disabled in production' },
      { status: 403 },
    )
  }

  console.log('🧪 META TEST ENDPOINT CALLED')

  try {
    // Initialize Meta Conversion API
    initializeMeta()
    
    // Check configuration
    const isConfigured = isMetaConfigured()
    console.log('🔧 Meta Configuration Status:', isConfigured)
    console.log('🔧 Environment Variables:', {
      pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID ? 'SET' : 'MISSING',
      accessToken: process.env.META_CONVERSION_ACCESS_TOKEN ? 'SET' : 'MISSING',
      testCode: process.env.META_TEST_EVENT_CODE ? 'SET' : 'NOT_SET'
    })

    if (!isConfigured) {
      return NextResponse.json({
        success: false,
        error: 'Meta Conversion API not configured',
        details: {
          pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID ? 'SET' : 'MISSING',
          accessToken: process.env.META_CONVERSION_ACCESS_TOKEN ? 'SET' : 'MISSING'
        }
      }, { status: 400 })
    }

    // Test ViewContent event
    console.log('🧪 Testing ViewContent event...')
    const viewContentResult = await trackViewContent('Test Page', 'test')
    console.log('📊 ViewContent Result:', viewContentResult)

    // Test Lead event with sample data
    console.log('🧪 Testing Lead event...')
    const leadResult = await trackLead({
      email: 'test@example.com',
      phone: '514-123-4567',
      firstName: 'Test',
      lastName: 'User',
      value: 5000,
      clientIp: request.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: request.headers.get('user-agent') || 'Test Agent',
      sourceUrl: 'https://soumission-toiture.ai/test'
    })
    console.log('📊 Lead Result:', leadResult)

    return NextResponse.json({
      success: true,
      message: 'Meta tracking test completed',
      results: {
        configuration: {
          isConfigured,
          pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID ? 'SET' : 'MISSING',
          accessToken: process.env.META_CONVERSION_ACCESS_TOKEN ? 'SET' : 'MISSING',
          testCode: process.env.META_TEST_EVENT_CODE ? 'SET' : 'NOT_SET'
        },
        viewContent: viewContentResult,
        lead: leadResult
      }
    })

  } catch (error) {
    console.error('❌ Meta test error:', error)
    return NextResponse.json({
      success: false,
      error: 'Meta test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Meta Test Endpoint - Use POST to run tests',
    usage: 'POST /api/test-meta to test Meta Conversion API tracking'
  })
}
