// V2 funnel configuration — symptoms, hydro brackets, intent
// Used by /analysis wizard V2 + lead-capture-form for V2 → V1 mapping.

export const SYMPTOMS_OPTIONS = [
  { code: 'hydro_up',      label: "Ma facture d'Hydro monte chaque année",     emoji: '⚡' },
  { code: 'cold_winter',   label: "Ma maison est froide en hiver",              emoji: '🥶' },
  { code: 'hot_summer',    label: "C'est étouffant l'été, surtout en haut",     emoji: '🥵' },
  { code: 'ice_roof',      label: "J'ai de la glace ou des glaçons sur le toit", emoji: '🧊' },
  { code: 'drafts',        label: "Je sens des courants d'air",                 emoji: '💨' },
  { code: 'uneven_temp',   label: "Un étage est chaud, l'autre est froid",      emoji: '🌡️' },
  { code: 'humidity_mold', label: "J'ai de l'humidité ou de la moisissure",     emoji: '💧' },
] as const

export type SymptomCode = typeof SYMPTOMS_OPTIONS[number]['code']

export const HYDRO_BRACKETS = [
  { code: 'lt_125',  label: 'Moins de 125 $ / mois',       emoji: '💰',
    base:     'border-green-700 bg-green-100',
    selected: 'border-green-800 bg-green-200 ring-2 ring-inset ring-green-800' },
  { code: '125_200', label: 'Entre 125 $ et 200 $ / mois', emoji: '💰💰',
    base:     'border-yellow-700 bg-yellow-100',
    selected: 'border-yellow-800 bg-yellow-200 ring-2 ring-inset ring-yellow-800' },
  { code: '200_300', label: 'Entre 200 $ et 300 $ / mois', emoji: '💰💰💰',
    base:     'border-orange-700 bg-orange-100',
    selected: 'border-orange-800 bg-orange-200 ring-2 ring-inset ring-orange-800' },
  { code: 'gt_300',  label: 'Plus de 300 $ / mois',        emoji: '🔥',
    base:     'border-red-700 bg-red-100',
    selected: 'border-red-800 bg-red-200 ring-2 ring-inset ring-red-800' },
] as const

export type HydroBracketCode = typeof HYDRO_BRACKETS[number]['code']

export const INTENT_OPTIONS = [
  { code: 'qualified', label: 'Je veux faire les travaux',     sub: 'Je suis prêt à recevoir un inspecteur qualifié', emoji: '🔨' },
  { code: 'curious',   label: 'Je suis juste curieux du coût', sub: 'Juste pour savoir, pas pressé',                  emoji: '💭' },
] as const

export type IntentCode = typeof INTENT_OPTIONS[number]['code']

export interface V2Answers {
  symptoms: SymptomCode[]
  hydroBracket: HydroBracketCode | ''
  intent: IntentCode | ''
}

// Map V2 symptoms (new codes) to V1 identifiedProblems (legacy codes used by
// calculateInsulationPricing and GHL/Make payload). Defaults to ['aucun'] when
// nothing maps so legacy consumers don't choke on empty arrays.
export function mapV2SymptomsToV1(v2Symptoms: readonly string[]): string[] {
  const map: Record<string, string> = {
    humidity_mold: 'moisissure',
    drafts: 'courants-air',
    hydro_up: 'factures-elevees',
    uneven_temp: 'temperature-inegale',
    ice_roof: 'glace',
    cold_winter: 'temperature-inegale',
    hot_summer: 'temperature-inegale',
  }
  const v1 = v2Symptoms.map((s) => map[s]).filter(Boolean)
  return v1.length ? Array.from(new Set(v1)) : ['aucun']
}

// V1-shaped answers built from V2 answers + conservative defaults. Used both by
// LeadCaptureForm (to compute pricingData submitted to /api/leads) and by
// /analysis state="pricing" (to render InsulationResults with the same inputs
// so the displayed estimate matches the one stored in GHL).
export interface V1AnswersForPricing {
  heatingSystem: string
  currentInsulation: string
  atticAccess: string
  identifiedProblems: string[]
}

export function buildV1AnswersFromV2(v2: V2Answers): V1AnswersForPricing {
  return {
    heatingSystem: 'electricite',
    currentInsulation: 'partielle',
    atticAccess: 'facile',
    identifiedProblems: mapV2SymptomsToV1(v2.symptoms),
  }
}
