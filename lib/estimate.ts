import type { HydroBracketCode } from './funnel-config';

const BASE_ESTIMATES: Record<HydroBracketCode, { min: number; max: number }> = {
  under_150: { min: 1500, max: 3500 },
  '150_250': { min: 3000, max: 6000 },
  '250_350': { min: 4500, max: 8500 },
  '350_500': { min: 6000, max: 11000 },
  over_500:  { min: 8000, max: 15000 },
};

const HIGH_SYMPTOM_THRESHOLD = 4;
const HIGH_SYMPTOM_MULTIPLIER = 1.15;

export interface EstimateResult {
  min: number;
  max: number;
  mid: number;
  label: string;
}

export function computeEstimate(
  hydroBracket: HydroBracketCode,
  symptomsCount: number
): EstimateResult {
  const base = BASE_ESTIMATES[hydroBracket];
  const multiplier = symptomsCount >= HIGH_SYMPTOM_THRESHOLD ? HIGH_SYMPTOM_MULTIPLIER : 1;

  const min = Math.round((base.min * multiplier) / 100) * 100;
  const max = Math.round((base.max * multiplier) / 100) * 100;
  const mid = Math.round((min + max) / 2);

  return {
    min,
    max,
    mid,
    label: `${formatCAD(min)} – ${formatCAD(max)}`,
  };
}

export function formatCAD(amount: number): string {
  return `${amount.toLocaleString('fr-CA').replace(/,/g, ' ')} $`;
}
