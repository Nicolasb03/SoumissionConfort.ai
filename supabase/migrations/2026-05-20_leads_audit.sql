-- Audit trail for every /api/leads attempt from soumissionconfort.com.
-- Lets us reconcile Meta Ads "Lead" count vs GHL "new contacts" precisely
-- in SQL: duplicates (re-submissions, same meta_event_id within 48h) are
-- distinguished from genuinely new leads via the ghl_new flag.

create table if not exists public.leads_audit (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  lead_id text not null,
  vertical text not null,             -- 'isolation' | 'isolation_soumission_rapide' | 'subvention' | 'hvac' | 'roofing'
  phone_e164 text not null,           -- already normalized by /api/leads
  email text not null,
  meta_event_id text,                 -- deterministic per (phone,email); same value re-emitted on re-submissions
  ghl_contact_id text,
  ghl_new boolean,                    -- true = new contact created, false = duplicate-upsert merged, null = error
  ghl_status_code integer,
  ghl_error text,
  utm_source text,
  utm_campaign text,
  fbclid text
);

create index if not exists leads_audit_occurred_at_idx on public.leads_audit (occurred_at desc);
create index if not exists leads_audit_phone_idx on public.leads_audit (phone_e164);
create index if not exists leads_audit_meta_event_id_idx on public.leads_audit (meta_event_id);

-- RLS: only service_role inserts/reads. No public access.
alter table public.leads_audit enable row level security;
