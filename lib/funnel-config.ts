export type SymptomCode =
  | 'hydro_high'
  | 'cold_winter'
  | 'hot_summer'
  | 'ice_roof'
  | 'drafts'
  | 'uneven_temp'
  | 'humidity';

export type HydroBracketCode =
  | 'under_150'
  | '150_250'
  | '250_350'
  | '350_500'
  | 'over_500';

export type IntentCode = 'qualified' | 'curious';

export interface SymptomOption {
  code: SymptomCode;
  emoji: string;
  label: string;
}

export interface HydroBracketOption {
  code: HydroBracketCode;
  emoji: string;
  label: string;
  colorClass: string;
}

export interface IntentOption {
  code: IntentCode;
  emoji: string;
  label: string;
  description: string;
}

export const SYMPTOMS_OPTIONS: readonly SymptomOption[] = [
  { code: 'hydro_high',  emoji: '⚡',  label: "Ma facture d'Hydro monte chaque année" },
  { code: 'cold_winter', emoji: '🥶', label: 'Ma maison est frette en hiver' },
  { code: 'hot_summer',  emoji: '🥵', label: "C'est étouffant l'été, surtout en haut" },
  { code: 'ice_roof',    emoji: '🧊', label: 'J\'ai de la glace ou des glaçons sur le toit' },
  { code: 'drafts',      emoji: '💨', label: "Je sens des courants d'air (fenêtres, prises)" },
  { code: 'uneven_temp', emoji: '🌡️', label: 'Un étage est chaud, l\'autre est froid' },
  { code: 'humidity',    emoji: '💧', label: 'J\'ai de l\'humidité ou des moisissures' },
] as const;

export const HYDRO_BRACKETS: readonly HydroBracketOption[] = [
  {
    code: 'under_150',
    emoji: '💰',
    label: 'Moins de 150 $ / mois',
    colorClass: 'bg-blue-50 border-blue-400 hover:bg-blue-100 text-blue-900',
  },
  {
    code: '150_250',
    emoji: '💰💰',
    label: 'Entre 150 $ et 250 $ / mois',
    colorClass: 'bg-green-50 border-green-400 hover:bg-green-100 text-green-900',
  },
  {
    code: '250_350',
    emoji: '💰💰💰',
    label: 'Entre 250 $ et 350 $ / mois',
    colorClass: 'bg-yellow-50 border-yellow-400 hover:bg-yellow-100 text-yellow-900',
  },
  {
    code: '350_500',
    emoji: '💰💰💰💰',
    label: 'Entre 350 $ et 500 $ / mois',
    colorClass: 'bg-orange-50 border-orange-400 hover:bg-orange-100 text-orange-900',
  },
  {
    code: 'over_500',
    emoji: '🔥',
    label: 'Plus de 500 $ / mois',
    colorClass: 'bg-red-50 border-red-400 hover:bg-red-100 text-red-900',
  },
] as const;

export const INTENT_OPTIONS: readonly IntentOption[] = [
  {
    code: 'qualified',
    emoji: '🔨',
    label: 'Je veux faire faire les travaux',
    description: 'Je suis prêt à recevoir des soumissions',
  },
  {
    code: 'curious',
    emoji: '💭',
    label: 'Je suis juste curieux du coût',
    description: 'Juste pour savoir, pas pressé',
  },
] as const;

export const SESSION_STORAGE_KEYS = {
  ESTIMATE_INPUTS: 'soumission-rapide-estimate-inputs',
  PENDING_LEAD: 'soumission-rapide-lead',
} as const;

export interface EstimateInputs {
  hydroBracket: HydroBracketCode;
  symptoms: SymptomCode[];
  intent: IntentCode;
}

export function getSymptomLabel(code: SymptomCode): string {
  const opt = SYMPTOMS_OPTIONS.find((o) => o.code === code);
  return opt?.label ?? code;
}

export function getHydroBracketLabel(code: HydroBracketCode): string {
  const opt = HYDRO_BRACKETS.find((o) => o.code === code);
  return opt?.label ?? code;
}
