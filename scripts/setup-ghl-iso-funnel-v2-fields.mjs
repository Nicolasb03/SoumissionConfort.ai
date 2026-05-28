#!/usr/bin/env node
// One-off script: creates the 3 V2 funnel custom fields in the Iso GHL sub-account.
// Run: node --env-file=.env.local scripts/setup-ghl-iso-funnel-v2-fields.mjs
//
// After it runs, copy the printed IDs into lib/ghl-fields-iso.ts (manual edit).
// The fields:
//   - symptoms      → V2 symptoms multi-select stored as CSV (TEXT)
//   - hydro_bracket → V2 hydro bracket single value (TEXT)
//   - intent        → V2 intent single value 'qualified' | 'curious' (TEXT)

const API_BASE = 'https://services.leadconnectorhq.com'
const VERSION = '2021-07-28'

const apiKey = process.env.GHL_API_KEY_ISO
const locationId = process.env.GHL_LOCATION_ID_ISO

if (!apiKey || !locationId) {
  console.error('❌ GHL_API_KEY_ISO and GHL_LOCATION_ID_ISO must be set in .env.local')
  process.exit(1)
}

const FIELDS_TO_CREATE = [
  {
    name: 'Symptoms',
    fieldKey: 'symptoms',
    dataType: 'TEXT',
    placeholder: 'hydro_up,drafts,humidity_mold',
  },
  {
    name: 'Hydro Bracket',
    fieldKey: 'hydro_bracket',
    dataType: 'TEXT',
    placeholder: 'lt_125 | 125_200 | 200_300 | gt_300',
  },
  {
    name: 'Intent',
    fieldKey: 'intent',
    dataType: 'TEXT',
    placeholder: 'qualified | curious',
  },
]

async function listExistingFields() {
  const res = await fetch(`${API_BASE}/locations/${locationId}/customFields`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: VERSION,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`List failed: ${res.status} ${text}`)
  }
  const body = await res.json()
  return body.customFields || body.data || []
}

async function createField({ name, fieldKey, dataType, placeholder }) {
  const payload = {
    name,
    dataType,
    placeholder,
    model: 'contact',
  }
  const res = await fetch(`${API_BASE}/locations/${locationId}/customFields/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Create "${name}" failed: ${res.status} ${text}`)
  }
  return JSON.parse(text)
}

async function main() {
  console.log(`📍 Sub-account: ${locationId}`)
  console.log(`🔍 Listing existing custom fields…`)
  const existing = await listExistingFields()
  console.log(`   Found ${existing.length} existing fields.`)

  const created = {}
  for (const def of FIELDS_TO_CREATE) {
    // Match by name or fieldKey to avoid duplicates.
    const dup = existing.find(
      (f) =>
        f.name?.toLowerCase() === def.name.toLowerCase() ||
        f.fieldKey?.toLowerCase() === def.fieldKey.toLowerCase() ||
        f.fieldKey?.toLowerCase() === `contact.${def.fieldKey.toLowerCase()}`,
    )
    if (dup) {
      console.log(`⏭  Skipping "${def.name}" — already exists (id ${dup.id})`)
      created[def.fieldKey] = { id: dup.id, name: dup.name, fieldKey: dup.fieldKey, type: dup.dataType }
      continue
    }
    console.log(`➕ Creating "${def.name}"…`)
    const resp = await createField(def)
    const field = resp.customField || resp.field || resp
    created[def.fieldKey] = {
      id: field.id,
      name: field.name,
      fieldKey: field.fieldKey || def.fieldKey,
      type: field.dataType || def.dataType,
    }
    console.log(`   ✅ Created. id=${field.id}`)
  }

  console.log('')
  console.log('====================================================================')
  console.log('Paste this into lib/ghl-fields-iso.ts inside GHL_FIELDS_ISO map:')
  console.log('====================================================================')
  for (const [key, f] of Object.entries(created)) {
    console.log(`  ${key}: { id: '${f.id}', name: '${f.name}', key: '${key}', type: '${f.type}' },`)
  }
}

main().catch((err) => {
  console.error('❌', err.message || err)
  process.exit(1)
})
