import { toMetaPhone } from './phone';

interface MetaConversionEvent {
  event_name: string;
  event_id?: string;
  event_time: number;
  action_source: string;
  user_data?: {
    em?: string | string[]; // email (hashed) - can be array
    ph?: string | (string | null)[]; // phone (hashed) - can be array
    fn?: string; // first name (hashed)
    ln?: string; // last name (hashed)
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string; // Facebook click ID
    fbp?: string; // Facebook browser ID
    external_id?: string; // stable id (hashed) — improves match quality
  };
  custom_data?: {
    content_type?: string;
    content_name?: string;
    value?: number | string;
    currency?: string;
    search_string?: string;
    [key: string]: any;
  };
  attribution_data?: {
    attribution_share?: string | number;
  };
  original_event_data?: {
    event_name?: string;
    event_time?: number;
  };
  event_source_url?: string;
}

interface MetaConversionPayload {
  data: MetaConversionEvent[];
  test_event_code?: string;
}

// Hash function for PII data (required by Meta)
async function hashData(data: string): Promise<string> {
  const normalizedData = data.toLowerCase().trim();
  
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Client-side hashing
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(normalizedData);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Server-side hashing - use Node.js crypto
  try {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(normalizedData).digest('hex');
  } catch (error) {
    console.error('Failed to hash data:', error);
    throw new Error('Hashing failed');
  }
}

// Get client information for tracking
function getClientInfo() {
  if (typeof window === 'undefined') {
    return {};
  }
  
  return {
    client_ip_address: '', // Will be filled by server
    client_user_agent: navigator.userAgent,
    event_source_url: window.location.href,
    fbc: getCookie('_fbc'),
    fbp: getCookie('_fbp')
  };
}

// Helper to get cookie value
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift();
  }
  return undefined;
}

// Meta Conversion API service
export class MetaConversionAPI {
  private pixelId: string;
  private accessToken: string;
  private testEventCode?: string;

  constructor(pixelId: string, accessToken: string, testEventCode?: string) {
    this.pixelId = pixelId;
    this.accessToken = accessToken;
    this.testEventCode = testEventCode;
  }

  // Track ViewContent event. Accepts an object so the /analysis wizard can pass
  // an eventId for browser↔CAPI dedup, plus server-side client info (ip/ua/url)
  // that getClientInfo() can't supply outside the browser.
  async trackViewContent(data: {
    contentName?: string
    contentType?: string
    searchString?: string
    eventId?: string
    clientIp?: string
    userAgent?: string
    sourceUrl?: string
  } = {}) {
    // Prefer explicit server-passed client info; fall back to browser cookies
    // (_fbp/_fbc) + UA when called client-side.
    const userData: NonNullable<MetaConversionEvent['user_data']> = { ...getClientInfo() };
    if (data.clientIp) userData.client_ip_address = data.clientIp;
    if (data.userAgent) userData.client_user_agent = data.userAgent;

    const event: MetaConversionEvent = {
      event_name: 'ViewContent',
      event_id: data.eventId,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      user_data: userData,
      custom_data: {
        content_type: data.contentType || 'website',
        content_name: data.contentName || 'Homepage',
        currency: 'CAD',
        ...(data.searchString ? { search_string: data.searchString } : {}),
      },
      event_source_url: data.sourceUrl
        || (typeof window !== 'undefined' ? window.location.href : undefined),
    };

    return this.sendEvent(event);
  }

  // Track FindLocation event (when user searches with address)
  async trackFindLocation(searchString: string, userEmail?: string) {
    const userData: any = {
      ...getClientInfo()
    };

    if (userEmail) {
      userData.em = await hashData(userEmail);
    }

    const event: MetaConversionEvent = {
      event_name: 'Search',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      user_data: userData,
      custom_data: {
        content_type: 'location_search',
        search_string: searchString,
        currency: 'CAD'
      },
      event_source_url: typeof window !== 'undefined' ? window.location.href : undefined
    };

    return this.sendEvent(event);
  }

  // Track Lead event (when user submits contact form)
  async trackLead(leadData: {
    email: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    value?: number;
    clientIp?: string;
    userAgent?: string;
    sourceUrl?: string;
    eventId?: string;
    fbp?: string;
    fbc?: string;
    externalId?: string;
    customData?: Record<string, any>;
  }) {
    try {
      const userData: any = {
        em: await hashData(leadData.email)
      };

      if (leadData.phone) {
        // Hash the Meta-canonical phone (digits only, country code, no '+') — the
        // EXACT string fbevents hashes client-side, so the browser AM hash and the
        // CAPI hash match AND the value is in Meta's expected format. The E.164
        // "+1..." would hash differently (the '+' survives hashData) and waste the
        // phone signal. Skip ph entirely if no digits can be derived.
        const ph = toMetaPhone(leadData.phone);
        if (ph) userData.ph = await hashData(ph);
      }
      if (leadData.firstName) {
        userData.fn = await hashData(leadData.firstName);
      }
      if (leadData.lastName) {
        userData.ln = await hashData(leadData.lastName);
      }

      // fbp/fbc are sent RAW (never hashed) — they're the same cookie values the
      // browser Lead already sends, so the two channels match/dedup. external_id
      // is hashed (Meta convention); we use the email as the stable id.
      if (leadData.fbp) {
        userData.fbp = leadData.fbp;
      }
      if (leadData.fbc) {
        userData.fbc = leadData.fbc;
      }
      if (leadData.externalId) {
        userData.external_id = await hashData(leadData.externalId);
      }

      // Add server-side client information
      if (leadData.clientIp) {
        userData.client_ip_address = leadData.clientIp;
      }
      if (leadData.userAgent) {
        userData.client_user_agent = leadData.userAgent;
      }

      const event: MetaConversionEvent = {
        event_name: 'Lead',
        event_id: leadData.eventId,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        user_data: userData,
        custom_data: {
          content_type: 'lead_form',
          content_name: 'Estimation isolation',
          value: leadData.value || 0,
          currency: 'CAD',
          ...(leadData.customData || {})
        },
        event_source_url: leadData.sourceUrl || (typeof window !== 'undefined' ? window.location.href : undefined)
      };

      return this.sendEvent(event);
    } catch (error) {
      console.error('Error in trackLead:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Track Purchase event (when customer completes a purchase)
  async trackPurchase(purchaseData: {
    email: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    value: number | string;
    currency?: string;
    clientIp?: string;
    userAgent?: string;
    sourceUrl?: string;
    attributionShare?: string | number;
    contentName?: string;
    contentType?: string;
  }) {
    try {
      const userData: any = {
        em: [await hashData(purchaseData.email)]
      };

      if (purchaseData.phone) {
        userData.ph = [await hashData(purchaseData.phone)];
      } else {
        userData.ph = [null];
      }
      
      if (purchaseData.firstName) {
        userData.fn = await hashData(purchaseData.firstName);
      }
      if (purchaseData.lastName) {
        userData.ln = await hashData(purchaseData.lastName);
      }
      
      // Add server-side client information
      if (purchaseData.clientIp) {
        userData.client_ip_address = purchaseData.clientIp;
      }
      if (purchaseData.userAgent) {
        userData.client_user_agent = purchaseData.userAgent;
      }

      const eventTime = Math.floor(Date.now() / 1000);

      const event: MetaConversionEvent = {
        event_name: 'Purchase',
        event_time: eventTime,
        action_source: 'website',
        user_data: userData,
        custom_data: {
          currency: purchaseData.currency || 'USD',
          value: purchaseData.value.toString(),
          content_type: purchaseData.contentType,
          content_name: purchaseData.contentName
        },
        event_source_url: purchaseData.sourceUrl || (typeof window !== 'undefined' ? window.location.href : undefined)
      };

      // Add attribution data if provided
      if (purchaseData.attributionShare) {
        event.attribution_data = {
          attribution_share: purchaseData.attributionShare.toString()
        };
      }

      // Add original event data
      event.original_event_data = {
        event_name: 'Purchase',
        event_time: eventTime
      };

      return this.sendEvent(event);
    } catch (error) {
      console.error('Error in trackPurchase:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Send event to Meta Conversion API
  private async sendEvent(event: MetaConversionEvent) {
    try {
      const payload: MetaConversionPayload = {
        data: [event]
      };

      // Guard: ignore test_event_code in production. A misconfigured prod env
      // var here silently routes all CAPI events to Meta's test stream, which
      // breaks pixel attribution and ad optimization (incident 2026-05-07).
      if (this.testEventCode && process.env.NODE_ENV !== 'production') {
        payload.test_event_code = this.testEventCode;
      } else if (this.testEventCode) {
        console.warn('⚠️ Meta CAPI: test_event_code set in production env — ignored. Remove META_TEST_EVENT_CODE from prod.');
      }

      const response = await fetch(`https://graph.facebook.com/v18.0/${this.pixelId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Meta Conversion API error:', result);
        return { success: false, error: result };
      }

      console.log('Meta Conversion API event sent successfully:', event.event_name);
      return { success: true, data: result };
    } catch (error) {
      console.error('Meta Conversion API request failed:', error);
      return { success: false, error };
    }
  }
}

// Singleton instance
let metaAPI: MetaConversionAPI | null = null;

// Initialize Meta Conversion API
export function initializeMetaConversionAPI(
  pixelId: string, 
  accessToken: string, 
  testEventCode?: string
): MetaConversionAPI {
  metaAPI = new MetaConversionAPI(pixelId, accessToken, testEventCode);
  return metaAPI;
}

// Get Meta Conversion API instance
export function getMetaConversionAPI(): MetaConversionAPI | null {
  return metaAPI;
}

// Convenience functions for tracking events
export async function trackViewContent(data: {
  contentName?: string
  contentType?: string
  searchString?: string
  eventId?: string
  clientIp?: string
  userAgent?: string
  sourceUrl?: string
} = {}) {
  if (metaAPI) {
    return await metaAPI.trackViewContent(data);
  }
  console.warn('Meta Conversion API not initialized');
  return { success: false, error: 'API not initialized' };
}

export async function trackFindLocation(searchString: string, userEmail?: string) {
  if (metaAPI) {
    return await metaAPI.trackFindLocation(searchString, userEmail);
  }
  console.warn('Meta Conversion API not initialized');
  return { success: false, error: 'API not initialized' };
}

export async function trackLead(leadData: {
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  value?: number;
  clientIp?: string;
  userAgent?: string;
  sourceUrl?: string;
  customData?: Record<string, any>;
}) {
  if (metaAPI) {
    return await metaAPI.trackLead(leadData);
  }
  console.warn('Meta Conversion API not initialized');
  return { success: false, error: 'API not initialized' };
}

export async function trackPurchase(purchaseData: {
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  value: number | string;
  currency?: string;
  clientIp?: string;
  userAgent?: string;
  sourceUrl?: string;
  attributionShare?: string | number;
  contentName?: string;
  contentType?: string;
}) {
  if (metaAPI) {
    return await metaAPI.trackPurchase(purchaseData);
  }
  console.warn('Meta Conversion API not initialized');
  return { success: false, error: 'API not initialized' };
}
