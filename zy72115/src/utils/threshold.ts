import type { ThresholdLevel, ThresholdResult } from '@/types';
import { THRESHOLD_BOUNDARIES } from '@/types';

export function judgeThreshold(amplitudeMmPerS: number): ThresholdResult {
  if (amplitudeMmPerS < THRESHOLD_BOUNDARIES.normal) {
    return { level: '正常', value: amplitudeMmPerS, color: '#10b981' };
  }
  if (amplitudeMmPerS < THRESHOLD_BOUNDARIES.warning) {
    return { level: '警告', value: amplitudeMmPerS, color: '#f59e0b' };
  }
  return { level: '危险', value: amplitudeMmPerS, color: '#ef4444' };
}

export function getThresholdLevelColor(level: ThresholdLevel): string {
  switch (level) {
    case '正常': return '#10b981';
    case '警告': return '#f59e0b';
    case '危险': return '#ef4444';
  }
}

export function getThresholdLevelBg(level: ThresholdLevel): string {
  switch (level) {
    case '正常': return 'bg-emerald-500/20 border-emerald-500/30';
    case '警告': return 'bg-amber-500/20 border-amber-500/30';
    case '危险': return 'bg-red-500/20 border-red-500/30';
  }
}

export function getThresholdLevelText(level: ThresholdLevel): string {
  switch (level) {
    case '正常': return 'text-emerald-400';
    case '警告': return 'text-amber-400';
    case '危险': return 'text-red-400';
  }
}

export function detectExtremeValues(values: number[]): boolean[] {
  if (values.length < 3) return values.map(() => false);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
  if (stdDev === 0) return values.map(() => false);
  return values.map(v => Math.abs(v - mean) > 2 * stdDev);
}
