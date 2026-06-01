import type { ExtremeDetectionResult } from '@/types';

export function detectByStdDev(
  values: number[],
  k: number = 3,
): { flags: boolean[]; mean: number; stdDev: number } {
  const validValues = values.filter((v) => v !== null && !isNaN(v));
  const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
  const variance =
    validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    validValues.length;
  const stdDev = Math.sqrt(variance);

  const flags = values.map((v) => {
    if (v === null || isNaN(v)) return false;
    return Math.abs(v - mean) > k * stdDev;
  });

  return { flags, mean, stdDev };
}

export function detectByIQR(
  values: number[],
  k: number = 1.5,
): { flags: boolean[]; q1: number; q3: number; iqr: number } {
  const validValues = values
    .filter((v) => v !== null && !isNaN(v))
    .sort((a, b) => a - b);

  const q1 = quantile(validValues, 0.25);
  const q3 = quantile(validValues, 0.75);
  const iqr = q3 - q1;
  const lowerBound = q1 - k * iqr;
  const upperBound = q3 + k * iqr;

  const flags = values.map((v) => {
    if (v === null || isNaN(v)) return false;
    return v < lowerBound || v > upperBound;
  });

  return { flags, q1, q3, iqr };
}

export function detectExtremeValues(
  values: number[],
  stdDevK: number = 3,
  iqrK: number = 1.5,
): ExtremeDetectionResult {
  const stdResult = detectByStdDev(values, stdDevK);
  const iqrResult = detectByIQR(values, iqrK);

  const flags = stdResult.flags.map(
    (flag, i) => flag && iqrResult.flags[i],
  );

  const validValues = values.filter(
    (v, i) => v !== null && !isNaN(v) && !flags[i],
  );
  const allValidValues = values.filter((v) => v !== null && !isNaN(v));

  const meanWithExtremes =
    allValidValues.reduce((a, b) => a + b, 0) / allValidValues.length;
  const meanWithoutExtremes =
    validValues.reduce((a, b) => a + b, 0) / validValues.length;
  const excludedCount = flags.filter((f) => f).length;

  return {
    flags,
    method: 'both',
    meanWithExtremes,
    meanWithoutExtremes,
    excludedCount,
    stdDev: stdResult.stdDev,
    iqr: iqrResult.iqr,
    q1: iqrResult.q1,
    q3: iqrResult.q3,
  };
}

export function calculateMeanExcludingExtremes(
  values: number[],
  extremeFlags: boolean[],
): {
  meanWithExtremes: number;
  meanWithoutExtremes: number;
  excludedCount: number;
} {
  const validValues = values.filter(
    (v, i) => v !== null && !isNaN(v) && !extremeFlags[i],
  );
  const allValidValues = values.filter((v) => v !== null && !isNaN(v));

  const meanWithExtremes =
    allValidValues.reduce((a, b) => a + b, 0) / allValidValues.length;
  const meanWithoutExtremes =
    validValues.reduce((a, b) => a + b, 0) / validValues.length;

  return {
    meanWithExtremes,
    meanWithoutExtremes,
    excludedCount: allValidValues.length - validValues.length,
  };
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;

  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  } else {
    return sorted[base];
  }
}
