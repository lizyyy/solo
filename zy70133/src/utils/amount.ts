const DECIMAL_PLACES = 4;

export function formatAmount(amount: number): number {
  return Number(amount.toFixed(DECIMAL_PLACES));
}

export function addAmount(a: number, b: number): number {
  return formatAmount(a + b);
}

export function subtractAmount(a: number, b: number): number {
  return formatAmount(a - b);
}

export function multiplyAmount(a: number, b: number): number {
  return formatAmount(a * b);
}

export function divideAmount(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Cannot divide by zero');
  }
  return formatAmount(a / b);
}

export function isAmountPositive(amount: number): boolean {
  return amount > 0;
}

export function isAmountNegative(amount: number): boolean {
  return amount < 0;
}

export function isAmountZero(amount: number): boolean {
  return Math.abs(amount) < 0.00000001;
}

export function compareAmount(a: number, b: number): number {
  const diff = a - b;
  if (Math.abs(diff) < 0.00000001) {
    return 0;
  }
  return diff > 0 ? 1 : -1;
}

export function greaterThan(a: number, b: number): boolean {
  return compareAmount(a, b) > 0;
}

export function greaterThanOrEqual(a: number, b: number): boolean {
  return compareAmount(a, b) >= 0;
}

export function lessThan(a: number, b: number): boolean {
  return compareAmount(a, b) < 0;
}

export function lessThanOrEqual(a: number, b: number): boolean {
  return compareAmount(a, b) <= 0;
}

export function equals(a: number, b: number): boolean {
  return compareAmount(a, b) === 0;
}
