import type { AmplitudeUnit } from '@/types';

export type ConversionResult =
  | { ok: true; value: number; note?: string }
  | { ok: false; value: number; note: string };

export function convertToMmPerS(value: number, unit: AmplitudeUnit, frequencyHz?: number): number {
  const result = convertToMmPerSSafe(value, unit, frequencyHz);
  return result.ok ? result.value : NaN;
}

export function convertToMmPerSSafe(value: number, unit: AmplitudeUnit, frequencyHz?: number): ConversionResult {
  if (unit === 'mm/s') {
    return { ok: true, value };
  }

  if (unit === 'in/s') {
    return { ok: true, value: value / 0.03937, note: `${value} in/s → ${(value / 0.03937).toFixed(2)} mm/s` };
  }

  const needsFrequency: AmplitudeUnit[] = ['μm', 'mil', 'm/s²', 'g'];
  const unitTypeLabel: Record<string, string> = {
    'μm': '位移(μm)',
    'mil': '位移(mil)',
    'm/s²': '加速度(m/s²)',
    'g': '加速度(g)',
  };

  if (needsFrequency.includes(unit)) {
    if (!frequencyHz || frequencyHz <= 0) {
      return {
        ok: false,
        value,
        note: `单位为${unitTypeLabel[unit]}，需要频率才能换算为速度(mm/s)。当前缺少有效频率值，无法完成换算，请补充频率。`,
      };
    }

    if (unit === 'μm') {
      const displacementMm = value / 1000;
      const velocityMmPerS = displacementMm * 2 * Math.PI * frequencyHz;
      const converted = Math.round(velocityMmPerS * 10000) / 10000;
      return {
        ok: true,
        value: converted,
        note: `${value} μm ÷ 1000 × 2π × ${frequencyHz} Hz = ${converted.toFixed(2)} mm/s`,
      };
    }

    if (unit === 'mil') {
      const displacementMm = value * 0.0254;
      const velocityMmPerS = displacementMm * 2 * Math.PI * frequencyHz;
      const converted = Math.round(velocityMmPerS * 10000) / 10000;
      return {
        ok: true,
        value: converted,
        note: `${value} mil × 0.0254 × 2π × ${frequencyHz} Hz = ${converted.toFixed(2)} mm/s`,
      };
    }

    if (unit === 'm/s²') {
      const velocityMmPerS = (value / (2 * Math.PI * frequencyHz)) * 1000;
      const converted = Math.round(velocityMmPerS * 10000) / 10000;
      return {
        ok: true,
        value: converted,
        note: `${value} m/s² ÷ (2π × ${frequencyHz} Hz) × 1000 = ${converted.toFixed(2)} mm/s`,
      };
    }

    if (unit === 'g') {
      const mPerS2 = value * 9.81;
      const velocityMmPerS = (mPerS2 / (2 * Math.PI * frequencyHz)) * 1000;
      const converted = Math.round(velocityMmPerS * 10000) / 10000;
      return {
        ok: true,
        value: converted,
        note: `${value} g × 9.81 ÷ (2π × ${frequencyHz} Hz) × 1000 = ${converted.toFixed(2)} mm/s`,
      };
    }
  }

  return { ok: true, value };
}

export function convertFromMmPerS(valueMmPerS: number, targetUnit: AmplitudeUnit, frequencyHz?: number): number {
  if (targetUnit === 'mm/s') return valueMmPerS;
  if (targetUnit === 'in/s') return valueMmPerS * 0.03937;
  if (targetUnit === 'μm' && frequencyHz && frequencyHz > 0) {
    const displacementMm = valueMmPerS / (2 * Math.PI * frequencyHz);
    return displacementMm * 1000;
  }
  if (targetUnit === 'mil' && frequencyHz && frequencyHz > 0) {
    const displacementMm = valueMmPerS / (2 * Math.PI * frequencyHz);
    return displacementMm / 0.0254;
  }
  if (targetUnit === 'm/s²' && frequencyHz && frequencyHz > 0) {
    return (valueMmPerS / 1000) * 2 * Math.PI * frequencyHz;
  }
  if (targetUnit === 'g' && frequencyHz && frequencyHz > 0) {
    const mPerS2 = (valueMmPerS / 1000) * 2 * Math.PI * frequencyHz;
    return mPerS2 / 9.81;
  }
  return NaN;
}

export function formatConversion(original: number, originalUnit: AmplitudeUnit, converted: number): string {
  return `${original} ${originalUnit} → ${converted.toFixed(2)} mm/s`;
}

export function needsConversion(unit: AmplitudeUnit): boolean {
  return unit !== 'mm/s';
}

export function unitNeedsFrequency(unit: AmplitudeUnit): boolean {
  return ['μm', 'mil', 'm/s²', 'g'].includes(unit);
}

export const UNIT_LABELS: Record<AmplitudeUnit, string> = {
  'mm/s': 'mm/s (速度)',
  'μm': 'μm (位移，需频率换算)',
  'in/s': 'in/s (英制速度)',
  'mil': 'mil (英制位移，需频率换算)',
  'm/s²': 'm/s² (加速度，需频率换算)',
  'g': 'g (重力加速度，需频率换算)',
};

export const VALID_UNITS: AmplitudeUnit[] = ['mm/s', 'μm', 'in/s', 'mil', 'm/s²', 'g'];
