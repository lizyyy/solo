import type { SedimentLevel } from '@/types';

export function calculateSedimentLevel(
  sedimentDepth: number,
  threshold: number
): SedimentLevel {
  if (sedimentDepth < threshold * 0.5) {
    return 'normal';
  }
  if (sedimentDepth < threshold) {
    return 'mild';
  }
  if (sedimentDepth < threshold * 2) {
    return 'moderate';
  }
  return 'severe';
}

export function getSedimentLevelLabel(level: SedimentLevel): string {
  const labels: Record<SedimentLevel, string> = {
    normal: '正常',
    mild: '轻度淤积',
    moderate: '中度淤积',
    severe: '严重淤积',
  };
  return labels[level];
}

export function getSedimentLevelColor(level: SedimentLevel): string {
  const colors: Record<SedimentLevel, string> = {
    normal: 'text-green-600 bg-green-50',
    mild: 'text-yellow-600 bg-yellow-50',
    moderate: 'text-orange-600 bg-orange-50',
    severe: 'text-red-600 bg-red-50',
  };
  return colors[level];
}

export function getSedimentLevelBorderColor(level: SedimentLevel): string {
  const colors: Record<SedimentLevel, string> = {
    normal: 'border-green-400',
    mild: 'border-yellow-400',
    moderate: 'border-orange-400',
    severe: 'border-red-500',
  };
  return colors[level];
}

export function formatDepth(depth: number | undefined, unit: 'meter' | 'fathom' = 'meter'): string {
  if (depth === undefined || depth === null) return '-';
  if (unit === 'fathom') {
    return (depth * 0.5468).toFixed(2) + ' 英寻';
  }
  return depth.toFixed(2) + ' m';
}

export function meterToFathom(meters: number): number {
  return meters * 0.546807;
}

export function fathomToMeter(fathoms: number): number {
  return fathoms / 0.546807;
}
