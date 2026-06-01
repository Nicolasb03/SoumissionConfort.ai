import { initializeMetaConversionAPI } from './meta-conversion-api';

// Meta Conversion API configuration
export const META_CONFIG = {
  PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID || '',
  ACCESS_TOKEN: process.env.META_CONVERSION_ACCESS_TOKEN || '',
  TEST_EVENT_CODE: process.env.META_TEST_EVENT_CODE || undefined,
};

// Initialize Meta Conversion API on app startup
export function initializeMeta() {
  if (META_CONFIG.PIXEL_ID && META_CONFIG.ACCESS_TOKEN) {
    return initializeMetaConversionAPI(
      META_CONFIG.PIXEL_ID,
      META_CONFIG.ACCESS_TOKEN,
      META_CONFIG.TEST_EVENT_CODE
    );
  } else {
    // ACCESS_TOKEN is server-only — this warning is expected in the browser
    if (typeof window === 'undefined') {
      console.warn('Meta Conversion API not configured. Please set NEXT_PUBLIC_META_PIXEL_ID and META_CONVERSION_ACCESS_TOKEN environment variables.');
    }
    return null;
  }
}

// Check if Meta Conversion API is properly configured
export function isMetaConfigured(): boolean {
  return !!(META_CONFIG.PIXEL_ID && META_CONFIG.ACCESS_TOKEN);
}

// ───────────────────────────────────────────────────────────────────────────
// Dedicated soumissionconfort pixel — funnel /analysis only (Phase 2 V2).
// Separate Meta Business Manager pixel, cohabits with META_CONFIG (the Niku
// shared pixel that keeps serving homepage/thermopompes/subventions/rapide).
// ───────────────────────────────────────────────────────────────────────────
export const META_CONFIG_SOUMISSIONCONFORT = {
  PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID_SOUMISSIONCONFORT || '',
  ACCESS_TOKEN: process.env.META_CONVERSION_ACCESS_TOKEN_SOUMISSIONCONFORT || '',
  TEST_EVENT_CODE: process.env.META_TEST_EVENT_CODE_SOUMISSIONCONFORT || undefined,
};

// True only when both id + token are real (not empty, not the XXXXXX
// placeholder). Lets the CAPI routes skip silently during the rollout window
// before the pixel exists, instead of POSTing garbage to Meta.
export function isSoumissionConfortMetaConfigured(): boolean {
  const id = META_CONFIG_SOUMISSIONCONFORT.PIXEL_ID;
  const token = META_CONFIG_SOUMISSIONCONFORT.ACCESS_TOKEN;
  if (!id || !token) return false;
  // Guard against the XXXXXX placeholder Zack writes before the pixel exists.
  if (/^X+$/i.test(id) || /^X+$/i.test(token)) return false;
  return true;
}
