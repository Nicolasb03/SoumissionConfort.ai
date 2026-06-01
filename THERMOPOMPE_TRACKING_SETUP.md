# Thermopompe Facebook Pixel Tracking Setup

## Overview
This document describes the complete Facebook Pixel tracking implementation for the thermopompes page, including both client-side and server-side tracking.

## Implementation Summary

### 1. Client-Side Tracking (Browser)
**Location:** `/app/thermopompes/page.tsx` (lines 276-282)

**When it fires:** When a lead is captured (after user submits their contact information)

**Code:**
```typescript
// Facebook Pixel tracking
if (typeof window !== 'undefined' && (window as any).fbq) {
  const eventId = crypto.randomUUID();
  (window as any).fbq('track', 'Lead', {
    service_type: 'thermopompe'
  }, { eventID: eventId });
}
```

**Parameters:**
- `service_type: 'thermopompe'` - Identifies this as a heat pump lead
- `eventID` - Unique ID for deduplication with server-side events

### 2. Server-Side Tracking (Meta Conversion API)
**Location:** `/app/api/leads/route.ts` (lines 372-412)

**When it fires:** After successful webhook delivery to CRM

**Code:**
```typescript
// Server-side Meta Conversion API tracking for HVAC leads
if (isHVAC && successfulWebhooks > 0) {
  try {
    const metaPixelId = process.env.META_PIXEL_ID
    const metaAccessToken = process.env.META_ACCESS_TOKEN
    
    if (metaPixelId && metaAccessToken) {
      const metaAPI = initializeMetaConversionAPI(metaPixelId, metaAccessToken)
      
      // Get client IP and user agent from request headers
      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                      request.headers.get('x-real-ip') || 
                      'unknown'
      const userAgent = request.headers.get('user-agent') || 'unknown'
      
      // Calculate estimated value for tracking
      const estimatedValue = leadData.estimatedPrice || 
                            ((leadData.estimatedPriceMin || 0) + (leadData.estimatedPriceMax || 0)) / 2
      
      await metaAPI.trackLead({
        email: leadData.email,
        phone: leadData.phone,
        firstName: leadData.firstName,
        lastName: leadData.lastName,
        value: estimatedValue,
        clientIp,
        userAgent,
        sourceUrl: `${request.headers.get('origin') || 'https://soumissionconfort.com'}/thermopompes`,
        customData: {
          service_type: 'thermopompe'
        }
      })
    }
  } catch (metaError) {
    console.error('❌ LEADS API: Meta Conversion API error:', metaError)
    // Don't fail the request if Meta tracking fails
  }
}
```

**Data Sent:**
- **User Data (hashed):** email, phone, firstName, lastName
- **Client Info:** IP address, user agent
- **Value:** Estimated price of the heat pump installation
- **Custom Data:** `service_type: 'thermopompe'`
- **Source URL:** The thermopompes page URL

### 3. Enhanced Meta Conversion API Library
**Location:** `/lib/meta-conversion-api.ts`

**Changes:**
- Added `customData` parameter support to `trackLead` method
- Allows passing custom parameters like `service_type` to Meta
- Custom data is merged with default tracking parameters

## Environment Variables Required

Make sure these are set in your `.env.local` or production environment:

```bash
META_PIXEL_ID=your_pixel_id
META_ACCESS_TOKEN=your_access_token
```

## How It Works

1. **User Journey:**
   - User enters address on `/thermopompes` page
   - Completes questionnaire about their home
   - Submits contact information (lead capture)

2. **Client-Side Event:**
   - Browser fires `fbq('track', 'Lead')` with `service_type: 'thermopompe'`
   - Event ID is generated for deduplication

3. **Server-Side Event:**
   - Lead data is sent to `/api/leads` endpoint
   - Webhook is sent to CRM (Make.com)
   - If webhook succeeds, server-side Meta event is fired
   - Includes hashed PII, client info, and custom parameters

## Benefits of Dual Tracking

1. **Reliability:** If client-side tracking is blocked by ad blockers, server-side still works
2. **Data Quality:** Server-side includes IP and user agent for better attribution
3. **Deduplication:** Event IDs prevent double-counting
4. **Privacy Compliant:** PII is hashed before sending to Meta

## Testing

To test the implementation:

1. **Client-Side:** Open browser console on `/thermopompes` page and check for:
   ```
   📱 Firing Meta Pixel "Lead" event (client-side)
   ```

2. **Server-Side:** Check server logs for:
   ```
   📊 LEADS API: Sending server-side Meta Lead event for thermopompe
   ✅ LEADS API: Server-side Meta Lead event sent successfully
   ```

3. **Meta Events Manager:** Check for Lead events with `service_type: thermopompe` parameter

## Comparison with Isolation Form

The isolation form (`/components/user-questionnaire-wizard.tsx`) has similar tracking but with:
- `service_type: 'isolation'`
- Includes pricing value in the event
- Only client-side tracking (no server-side yet)

## Next Steps

If you want to add server-side tracking for isolation leads as well, you would:
1. Update the isolation lead handling in `/app/api/leads/route.ts`
2. Add similar Meta tracking code for `leadType === 'isolation'`
3. Use `service_type: 'isolation'` in the custom data
