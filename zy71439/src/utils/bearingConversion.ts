export interface DMS {
  degrees: number;
  minutes: number;
  seconds: number;
}

export function dmsToDecimal(dms: DMS): number {
  return dms.degrees + dms.minutes / 60 + dms.seconds / 3600;
}

export function decimalToDMS(decimal: number): DMS {
  const degrees = Math.floor(decimal);
  const minutesDecimal = (decimal - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = Math.round((minutesDecimal - minutes) * 60 * 100) / 100;
  return { degrees, minutes, seconds };
}

export function validateDMS(dms: DMS): { valid: boolean; error?: string } {
  if (dms.degrees < 0 || dms.degrees > 359) {
    return { valid: false, error: '度数必须在 0-359 之间' };
  }
  if (dms.minutes < 0 || dms.minutes > 59) {
    return { valid: false, error: '分数必须在 0-59 之间' };
  }
  if (dms.seconds < 0 || dms.seconds > 59.99) {
    return { valid: false, error: '秒数必须在 0-59.99 之间' };
  }
  return { valid: true };
}

export function validateDecimal(decimal: number): { valid: boolean; error?: string } {
  if (decimal < 0 || decimal >= 360) {
    return { valid: false, error: '十进制度必须在 0-360 之间' };
  }
  return { valid: true };
}

export function formatBearingDMS(dms: DMS): string {
  return `${dms.degrees}°${dms.minutes}'${dms.seconds.toFixed(1)}"`;
}

export function formatBearingDecimal(decimal: number): string {
  return `${decimal.toFixed(4)}°`;
}

export function detectUnitError(
  value: number,
  expectedUnit: 'dms' | 'decimal',
  inputUnit: 'dms' | 'decimal'
): boolean {
  if (expectedUnit !== inputUnit) {
    return true;
  }
  if (inputUnit === 'dms') {
    return value > 360 || value < 0;
  }
  return false;
}
