import type { LengthUnit, DensityUnit, UnitConversionResult } from '@/types';

const LENGTH_TO_MM: Record<LengthUnit, number> = {
  mm: 1,
  cm: 10,
  in: 25.4,
};

const DENSITY_TO_KG_M3: Record<DensityUnit, number> = {
  kg_m3: 1,
  g_cm3: 1000,
};

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): UnitConversionResult {
  const mmValue = value * LENGTH_TO_MM[from];
  const converted = mmValue / LENGTH_TO_MM[to];
  return {
    originalValue: value,
    originalUnit: from,
    convertedValue: Math.round(converted * 10000) / 10000,
    targetUnit: to,
  };
}

export function convertDensity(value: number, from: DensityUnit, to: DensityUnit): UnitConversionResult {
  const kgM3Value = value * DENSITY_TO_KG_M3[from];
  const converted = kgM3Value / DENSITY_TO_KG_M3[to];
  return {
    originalValue: value,
    originalUnit: from,
    convertedValue: Math.round(converted * 10000) / 10000,
    targetUnit: to,
  };
}

export function toMM(value: number, unit: LengthUnit): number {
  return value * LENGTH_TO_MM[unit];
}

export function toKgM3(value: number, unit: DensityUnit): number {
  return value * DENSITY_TO_KG_M3[unit];
}

export const LENGTH_UNIT_LABELS: Record<LengthUnit, string> = {
  mm: 'mm',
  cm: 'cm',
  in: 'in',
};

export const DENSITY_UNIT_LABELS: Record<DensityUnit, string> = {
  kg_m3: 'kg/m³',
  g_cm3: 'g/cm³',
};
