import { RhythmCode } from '@/types';

export function normalizeRhythm(durations: number[]): RhythmCode {
  if (durations.length === 0) {
    return {
      normalized: [],
      pattern: '',
      stretchFactor: 1,
    };
  }

  const totalDuration = durations.reduce((a, b) => a + b, 0);
  const normalized = durations.map((d) => d / totalDuration);

  const gcdValue = findGCD(durations);
  const quantized = durations.map((d) => Math.round(d / gcdValue));

  const patternSymbols = quantized.map((q) => {
    if (q === 1) return '16';
    if (q === 2) return '8';
    if (q === 3) return '8.';
    if (q === 4) return '4';
    if (q === 6) return '4.';
    if (q === 8) return '2';
    return `[${q}]`;
  });

  const pattern = patternSymbols.join('-');

  return {
    normalized,
    pattern,
    stretchFactor: totalDuration / durations.length,
  };
}

function findGCD(numbers: number[]): number {
  const integers = numbers.map((n) => Math.round(n * 1000));
  return integers.reduce((a, b) => gcd(a, b)) / 1000;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function getRhythmNormalizationSteps(durations: number[]): {
  input: number[];
  output: number[];
  stretchFactor: number;
  steps: string[];
} {
  const steps: string[] = [];
  steps.push(`输入时长序列: [${durations.join(', ')}]`);

  const totalDuration = durations.reduce((a, b) => a + b, 0);
  steps.push(`总时长: ${totalDuration.toFixed(3)} 拍`);

  const normalized = durations.map((d) => d / totalDuration);
  steps.push(`归一化后: [${normalized.map((n) => n.toFixed(3)).join(', ')}]`);

  const rhythm = normalizeRhythm(durations);
  steps.push(`节奏型: ${rhythm.pattern}`);

  return {
    input: durations,
    output: normalized,
    stretchFactor: rhythm.stretchFactor,
    steps,
  };
}

export function calculateTimeStretch(
  queryDurations: number[],
  targetDurations: number[]
): number {
  const queryTotal = queryDurations.reduce((a, b) => a + b, 0);
  const targetTotal = targetDurations.reduce((a, b) => a + b, 0);

  if (queryTotal === 0) return 1;
  return targetTotal / queryTotal;
}

export function isWithinStretchThreshold(
  stretchRatio: number,
  threshold: number
): boolean {
  const minRatio = 1 - threshold;
  const maxRatio = 1 + threshold;
  return stretchRatio >= minRatio && stretchRatio <= maxRatio;
}
