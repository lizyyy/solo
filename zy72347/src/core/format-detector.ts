import { ValueFormat, RawValue } from '../types';

export function detectFormat(value: string): ValueFormat {
  const trimmed = value.trim();

  if (trimmed === '' || trimmed === '-' || trimmed === 'N/A') {
    return 'unknown';
  }

  const hasPercentage = trimmed.includes('%');
  const numericStr = trimmed.replace(/%/g, '').trim();
  const numericValue = parseFloat(numericStr);

  if (isNaN(numericValue)) {
    return 'unknown';
  }

  if (hasPercentage) {
    return 'percentage';
  }

  if (numericValue >= 0 && numericValue <= 1) {
    return 'decimal';
  }

  if (numericValue > 1 && numericValue <= 100) {
    return 'percentage';
  }

  return 'unknown';
}

export function parseValue(value: string): RawValue {
  const trimmed = value.trim();
  const format = detectFormat(trimmed);

  let numericValue = 0;
  if (format !== 'unknown') {
    const numericStr = trimmed.replace(/%/g, '').trim();
    numericValue = parseFloat(numericStr);
    if (format === 'percentage' && numericValue > 1) {
      numericValue = numericValue / 100;
    }
  }

  return {
    original: trimmed,
    numericValue,
    format,
  };
}

export function detectMixedFormat(values: RawValue[]): boolean {
  const formats = values
    .map((v) => v.format)
    .filter((f) => f !== 'unknown');

  if (formats.length <= 1) {
    return false;
  }

  const uniqueFormats = new Set(formats);
  return uniqueFormats.has('percentage') && uniqueFormats.has('decimal');
}

export function normalizeValue(value: RawValue, targetFormat: 'decimal' | 'percentage'): number {
  if (value.format === 'unknown') {
    return value.numericValue;
  }

  if (targetFormat === 'decimal') {
    if (value.format === 'percentage' && value.original.includes('%')) {
      return value.numericValue;
    }
    if (value.format === 'percentage' && value.numericValue > 1) {
      return value.numericValue / 100;
    }
    return value.numericValue;
  } else {
    if (value.format === 'decimal' && value.numericValue <= 1) {
      return value.numericValue * 100;
    }
    return value.numericValue;
  }
}

export function formatValue(numericValue: number, targetFormat: 'decimal' | 'percentage'): string {
  if (targetFormat === 'decimal') {
    return numericValue.toFixed(4);
  } else {
    return `${(numericValue * 100).toFixed(2)}%`;
  }
}
