import { Decimal } from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type RoundingMethod = 'round_half_up' | 'truncate' | 'bankers';

export const toDecimal = (value: string | number | Decimal): Decimal => {
  return new Decimal(value);
};

export const roundDecimal = (
  value: Decimal,
  precision: number,
  method: RoundingMethod = 'round_half_up'
): Decimal => {
  switch (method) {
    case 'truncate':
      return value.toDecimalPlaces(precision, Decimal.ROUND_DOWN);
    case 'bankers':
      return value.toDecimalPlaces(precision, Decimal.ROUND_HALF_EVEN);
    case 'round_half_up':
    default:
      return value.toDecimalPlaces(precision, Decimal.ROUND_HALF_UP);
  }
};

export const parseNumber = (text: string): Decimal | null => {
  const cleaned = text.replace(/[^\d.]/g, '');
  if (cleaned === '' || cleaned === '.') return null;
  try {
    return new Decimal(cleaned);
  } catch {
    return null;
  }
};

export const parsePercent = (text: string): Decimal | null => {
  const match = text.match(/([\d.]+)%/);
  if (match) {
    return new Decimal(match[1]).div(100);
  }
  const numMatch = text.match(/[\d.]+/);
  if (numMatch) {
    const num = new Decimal(numMatch[0]);
    if (num.gt(1)) {
      return num.div(100);
    }
    return num;
  }
  return null;
};

export const formatDecimal = (value: Decimal, precision: number = 2): string => {
  return value.toFixed(precision);
};

export const isZero = (value: Decimal): boolean => {
  return value.isZero();
};

export const isEqual = (a: Decimal, b: Decimal, tolerance: number = 0): boolean => {
  if (tolerance > 0) {
    return a.sub(b).abs().lte(tolerance);
  }
  return a.eq(b);
};
