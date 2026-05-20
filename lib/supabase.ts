import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazy admin client for server-side audit writes from /api/leads.
// Returns null when env is missing so the lead path never throws on a missing
// optional dependency — audit writes are best-effort, not user-blocking.
//
// Required env:
//   SUPABASE_URL — same Supabase project as powerflow-geofencing
//   SUPABASE_SERVICE_ROLE_KEY — bypasses RLS for server inserts
let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false } })
  }
  return cached
}
