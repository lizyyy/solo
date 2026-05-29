import type { ThrustUnit } from '@/types';

export const thrustUnitLabels: Record<ThrustUnit, string> = {
  g: '克 (g)',
  kg: '千克 (kg)',
  N: '牛顿 (N)',
  lbf: '磅力 (lbf)',
};

const conversionFactors: Record<ThrustUnit, number> = {
  g: 0.00980665,
  kg: 9.80665,
  N: 1,
  lbf: 4.44822,
};

export function convertThrust(value: number, fromUnit: ThrustUnit, toUnit: ThrustUnit): number {
  const inNewtons = value * conversionFactors[fromUnit];
  return inNewtons / conversionFactors[toUnit];
}

export function inchToMeter(inches: number): number {
  return inches * 0.0254;
}

export function meterToInch(meters: number): number {
  return meters / 0.0254;
}

export function formatNumber(value: number, decimals: number = 4): string {
  return value.toFixed(decimals);
}

export function formatScientific(value: number): string {
  if (Math.abs(value) >= 1000 || Math.abs(value) < 0.001) {
    return value.toExponential(4);
  }
  return value.toFixed(4);
}
