import { UnitType } from '../types';

export const PHYSICAL_CONSTANTS = {
  STANDARD_TEMPERATURE: 25,
  AIR_DENSITY: 1.2,
  DIFFUSION_COEFFICIENT: 0.00002,
  KINETIC_VISCOSITY: 0.000015,
  GRAVITY: 9.81,
  THERMAL_EXPANSION: 0.0034,
};

export const CONCENTRATION_LIMITS = {
  LEGAL_LIMIT_MG_M3: 2.0,
  WARNING_THRESHOLD_MG_M3: 1.5,
  IDEAL_LEVEL_MG_M3: 0.5,
};

export const UNIT_CONVERSIONS: Record<UnitType, Record<string, number>> = {
  m: { m: 1, cm: 100, mm: 1000 },
  cm: { m: 0.01, cm: 1, mm: 10 },
  mm: { m: 0.001, cm: 0.1, mm: 1 },
  'm³/h': { 'm³/h': 1, 'm³/s': 1 / 3600 },
  'm³/s': { 'm³/h': 3600, 'm³/s': 1 },
  'mg/m³': { 'mg/m³': 1, ppm: 0.001 },
  ppm: { 'mg/m³': 1000, ppm: 1 },
  Pa: { Pa: 1 },
};

export function convertUnit(value: number, fromUnit: UnitType, toUnit: UnitType): number {
  if (fromUnit === toUnit) return value;
  const factor = UNIT_CONVERSIONS[fromUnit]?.[toUnit];
  if (factor === undefined) {
    throw new Error(`Cannot convert from ${fromUnit} to ${toUnit}`);
  }
  return value * factor;
}

export function normalizeToMeters(value: number, unit: UnitType): number {
  return convertUnit(value, unit, 'm');
}

export function normalizeAirflow(value: number, unit: UnitType): number {
  return convertUnit(value, unit, 'm³/h');
}

export function normalizeConcentration(value: number, unit: UnitType): number {
  return convertUnit(value, unit, 'mg/m³');
}

export const STOVE_FUME_RATES: Record<string, number> = {
  wok: 800,
  fryer: 500,
  grill: 600,
  steamer: 300,
  oven: 400,
};

export const STOVE_HEAT_OUTPUTS: Record<string, number> = {
  wok: 25000,
  fryer: 15000,
  grill: 18000,
  steamer: 10000,
  oven: 12000,
};

export const RECOMMENDED_AIRFLOW_PER_STOVE: Record<string, number> = {
  wok: 3000,
  fryer: 2500,
  grill: 2800,
  steamer: 2000,
  oven: 2200,
};

export function validateUnit(value: any, expectedType: string): boolean {
  if (typeof value !== 'number') return false;
  if (isNaN(value) || !isFinite(value)) return false;
  if (expectedType === 'length' && value < 0) return false;
  if (expectedType === 'airflow' && value < 0) return false;
  if (expectedType === 'concentration' && value < 0) return false;
  return true;
}
