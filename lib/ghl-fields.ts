// Barrel for GHL custom field maps. Each sub-account has its own field IDs;
// dispatch by lead vertical so the right map is used at runtime.
//
//   - ghl-fields-hvac.ts → legacy "Powerflow Leads" sub-account (HVAC only)
//   - ghl-fields-iso.ts  → "Soumission Confort Iso" sub-account (iso/rapide/subvention)

import { GHL_FIELDS_HVAC } from './ghl-fields-hvac'
import { GHL_FIELDS_ISO } from './ghl-fields-iso'

export interface GHLFieldDef {
  id: string
  name: string
  key: string
  type: string
}

export type LeadVertical =
  | 'isolation'
  | 'hvac'
  | 'subvention'
  | 'isolation_soumission_rapide'
  | 'roofing'

export function getFieldsFor(vertical: LeadVertical): Record<string, GHLFieldDef> {
  if (vertical === 'hvac' || vertical === 'roofing') return GHL_FIELDS_HVAC
  return GHL_FIELDS_ISO
}
