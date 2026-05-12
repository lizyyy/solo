export function toDecimal(num: string | number): number {
  return Number(Number(num).toFixed(2));
}

export function add(a: string | number, b: string | number): number {
  return toDecimal(Number(a) + Number(b));
}

export function subtract(a: string | number, b: string | number): number {
  return toDecimal(Number(a) - Number(b));
}

export function multiply(a: string | number, b: string | number): number {
  return toDecimal(Number(a) * Number(b));
}

export function divide(a: string | number, b: string | number): number {
  return toDecimal(Number(a) / Number(b));
}

export function isNegative(num: string | number): boolean {
  return Number(num) < 0;
}

export function isPositive(num: string | number): boolean {
  return Number(num) > 0;
}

export function isZero(num: string | number): boolean {
  return Number(num) === 0;
}

export function abs(num: string | number): number {
  return Math.abs(Number(num));
}
