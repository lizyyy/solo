import type { AmplitudeUnit } from '@/types';

const CONVERSION_TO_MM_PER_S: Record<AmplitudeUnit, (v: number) => number> = {
  'mm/s': (v) => v,
  'μm': (v) => v,
  'in/s': (v) => v / 0.03937,
  'mil': (v) => v,
  'm/s²': (v) => v,
  'g': (v) => v,
};

export function convertToMmPerS(value: number, unit: AmplitudeUnit, frequencyHz?: number): number {
  if (unit === 'mm/s') return value;
  if (unit === 'in/s') return value / 0.03937;
  if (unit === 'μm' && frequencyHz && frequencyHz > 0) {
    const displacementMm = value / 1000;
    const velocityMmPerS = displacementMm * 2 * Math.PI * frequencyHz;
    return velocityMmPerS;
  }
  if (unit === 'm/s²' && frequencyHz && frequencyHz > 0) {
    const velocityMmPerS = (value / (2 * Math.PI * frequencyHz)) * 1000;
    return velocityMmPerS;
  }
  if (unit === 'g' && frequencyHz && frequencyHz > 0) {
    const mPerS2 = value * 9.81;
    const velocityMmPerS = (mPerS2 / (2 * Math.PI * frequencyHz)) * 1000;
    return velocityMmPerS;
  }
  return value;
}

export function convertFromMmPerS(valueMmPerS: number, targetUnit: AmplitudeUnit, frequencyHz?: number): number {
  if (targetUnit === 'mm/s') return valueMmPerS;
  if (targetUnit === 'in/s') return valueMmPerS * 0.03937;
  if (targetUnit === 'μm' && frequencyHz && frequencyHz > 0) {
    const displacementMm = valueMmPerS / (2 * Math.PI * frequencyHz);
    return displacementMm * 1000;
  }
  return valueMmPerS;
}

export function formatConversion(original: number, originalUnit: AmplitudeUnit, converted: number): string {
  return `${original} ${originalUnit} → ${converted.toFixed(2)} mm/s`;
}

export function needsConversion(unit: AmplitudeUnit): boolean {
  return unit !== 'mm/s';
}

export const UNIT_LABELS: Record<AmplitudeUnit, string> = {
  'mm/s': 'mm/s (速度)',
  'μm': 'μm (位移)',
  'in/s': 'in/s (英制速度)',
  'mil': 'mil (英制位移)',
  'm/s²': 'm/s² (加速度)',
  'g': 'g (重力加速度)',
};

export { CONVERSION_TO_MM_PER_S };
