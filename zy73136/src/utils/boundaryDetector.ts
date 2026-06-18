import type { BuoyLog, WaterQualityParams } from '../types';
import { getThreshold } from './anomalyDetector';

export function detectBoundarySample(log: BuoyLog): boolean {
  const params = Object.values(log.parameters);
  const mean = params.reduce((a, b) => a + b, 0) / params.length;
  const std = Math.sqrt(
    params.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / params.length
  );

  const hasOutlier = params.some((p) => Math.abs(p - mean) > 3 * std);
  const isNonStandardTime = new Date(log.timestamp).getMinutes() !== 0;

  const multipleNearThreshold =
    Object.entries(log.parameters).filter(([key, value]) => {
      const threshold = getThreshold(key as keyof WaterQualityParams);
      return value >= threshold * 0.9;
    }).length >= 3;

  return hasOutlier || (isNonStandardTime && multipleNearThreshold);
}

export function identifySourceRow(log: BuoyLog): string {
  if (log.sourceRow) {
    return log.sourceRow;
  }

  const date = new Date(log.timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  if (log.isBoundarySample) {
    return `手动补录-${month}-${day}-${hours}:${minutes}-异常应急监测`;
  }

  return `自动采集-${month}-${day}-${hours}:${minutes}-标准整点数据`;
}

export function isBoundarySampleValue(
  value: number,
  threshold: number
): boolean {
  const ratio = value / threshold;
  return ratio >= 0.9 && ratio < 1.1;
}

export function getBoundaryRiskLevel(log: BuoyLog): 'low' | 'medium' | 'high' | 'critical' {
  const paramKeys = Object.keys(log.parameters) as (keyof WaterQualityParams)[];
  let criticalCount = 0;
  let nearThresholdCount = 0;

  for (const param of paramKeys) {
    const value = log.parameters[param];
    const threshold = getThreshold(param);
    const ratio = value / threshold;

    if (ratio > 1.5) criticalCount++;
    if (ratio >= 0.9 && ratio <= 1.5) nearThresholdCount++;
  }

  if (criticalCount >= 2) return 'critical';
  if (criticalCount >= 1 || nearThresholdCount >= 3) return 'high';
  if (nearThresholdCount >= 2) return 'medium';
  return 'low';
}
