import type { Annotation } from '@/types';

export function computeRobustMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q1Idx = Math.floor(n * 0.25);
  const q3Idx = Math.floor(n * 0.75);
  const q1 = sorted[q1Idx];
  const q3 = sorted[q3Idx];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const filtered = sorted.filter((v) => v >= lower && v <= upper);
  if (filtered.length === 0) return sorted[Math.floor(n / 2)];
  const mIdx = Math.floor(filtered.length / 2);
  return filtered.length % 2 === 0
    ? (filtered[mIdx - 1] + filtered[mIdx]) / 2
    : filtered[mIdx];
}

export function computeMediansFromAnnotations(annotations: Annotation[]): { subject: string; value: number }[] {
  const groups: Record<string, number[]> = {};
  for (const ann of annotations) {
    if (!groups[ann.subject]) groups[ann.subject] = [];
    const denom = Number(ann.denominator) || 0;
    if (denom > 0) {
      groups[ann.subject].push(ann.score / denom);
    }
  }
  return Object.entries(groups).map(([subject, vals]) => ({
    subject,
    value: computeRobustMedian(vals),
  }));
}
