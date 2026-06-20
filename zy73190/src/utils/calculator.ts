import type { ParamVersion, Sample, SampleStatus } from '@/types';

export function calculateNextTerm(
  sequence: number[],
  params: { a: number; b: number; c: number }
): number {
  const n = sequence.length;
  if (n < 2) return NaN;
  return sequence[n - 1] * params.a + sequence[n - 2] * params.b + params.c;
}

export function calculateDeviation(actual: number, expected: number): number {
  if (expected === 0) return 100;
  return Math.abs((actual - expected) / expected) * 100;
}

export function determineStatus(
  deviation: number,
  threshold: number,
  isDuplicate: boolean
): SampleStatus {
  if (isDuplicate) return 'duplicate';
  if (deviation > threshold) return 'abnormal';
  return 'normal';
}

export function checkDuplicate(
  sample: Sample,
  allSamples: Sample[]
): string[] {
  const duplicates: string[] = [];
  for (const other of allSamples) {
    if (other.id === sample.id) continue;
    if (
      other.sequence.length === sample.sequence.length &&
      other.sequence.every((v, i) => v === sample.sequence[i])
    ) {
      duplicates.push(other.id);
    }
  }
  return duplicates;
}

export function generateCalculationTrace(
  sequence: number[],
  params: { a: number; b: number; c: number },
  actual: number
): string {
  const n = sequence.length;
  const a1 = sequence[n - 1];
  const a2 = sequence[n - 2];
  const expected = a1 * params.a + a2 * params.b + params.c;
  return `a(${n + 1}) = ${a1}×${params.a} + ${a2}×${params.b} + ${params.c} = ${a1 * params.a} + ${a2 * params.b} + ${params.c} = ${expected}；学生答案为${actual}，偏差${calculateDeviation(actual, expected).toFixed(2)}%`;
}

export function recalculateSample(
  sample: Sample,
  paramVersion: ParamVersion,
  allSamples: Sample[]
): Sample {
  const actual = calculateNextTerm(sample.sequence, paramVersion.params);
  const deviation = calculateDeviation(actual, sample.expected);
  const duplicateOf = checkDuplicate(sample, allSamples);
  const status = determineStatus(deviation, paramVersion.threshold, duplicateOf.length > 0);
  const calculationTrace = generateCalculationTrace(
    sample.sequence,
    paramVersion.params,
    sample.actual
  );

  return {
    ...sample,
    paramVersionId: paramVersion.id,
    actual,
    deviation,
    status,
    duplicateOf,
    calculationTrace,
    updatedAt: new Date().toLocaleString('zh-CN'),
  };
}

export function recalculateAllSamples(
  samples: Sample[],
  paramVersion: ParamVersion
): Sample[] {
  return samples.map((sample) => recalculateSample(sample, paramVersion, samples));
}
