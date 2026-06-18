import type { BuoyLog, WaterQualityParams, AnomalyLevel } from '../types';
import { PARAMETER_THRESHOLDS } from '../types';

export function getThreshold(param: keyof WaterQualityParams): number {
  return PARAMETER_THRESHOLDS[param].max;
}

export function calculateAnomalyLevel(value: number, threshold: number): AnomalyLevel {
  const ratio = value / threshold;
  if (ratio > 2) return 'critical';
  if (ratio > 1.5) return 'high';
  if (ratio > 1.2) return 'medium';
  if (ratio > 1) return 'low';
  return 'low';
}

export function detectParameterExceed(log: BuoyLog): {
  parameter: keyof WaterQualityParams;
  value: number;
  threshold: number;
  level: AnomalyLevel;
}[] {
  const results: {
    parameter: keyof WaterQualityParams;
    value: number;
    threshold: number;
    level: AnomalyLevel;
  }[] = [];

  const paramKeys = Object.keys(log.parameters) as (keyof WaterQualityParams)[];
  
  for (const param of paramKeys) {
    const value = log.parameters[param];
    const threshold = getThreshold(param);
    
    if (value > threshold) {
      results.push({
        parameter: param,
        value,
        threshold,
        level: calculateAnomalyLevel(value, threshold),
      });
    }
    
    if (param === 'ph') {
      const minThreshold = PARAMETER_THRESHOLDS.ph.min;
      if (value < minThreshold) {
        results.push({
          parameter: param,
          value,
          threshold: minThreshold,
          level: calculateAnomalyLevel(minThreshold / value, 1),
        });
      }
    }
    
    if (param === 'dissolvedOxygen') {
      const minThreshold = PARAMETER_THRESHOLDS.dissolvedOxygen.min;
      if (value < minThreshold) {
        results.push({
          parameter: param,
          value,
          threshold: minThreshold,
          level: calculateAnomalyLevel(minThreshold / value, 1),
        });
      }
    }
  }

  return results;
}

export function detectTrendAnomaly(logs: BuoyLog[], windowSize: number = 6): {
  parameter: keyof WaterQualityParams;
  trend: 'increasing' | 'decreasing';
  changeAmount: number;
}[] {
  if (logs.length < windowSize) return [];

  const results: {
    parameter: keyof WaterQualityParams;
    trend: 'increasing' | 'decreasing';
    changeAmount: number;
  }[] = [];

  const recentLogs = logs.slice(-windowSize);
  const paramKeys = Object.keys(recentLogs[0].parameters) as (keyof WaterQualityParams)[];

  for (const param of paramKeys) {
    const values = recentLogs.map(l => l.parameters[param]);
    const firstHalfAvg = values.slice(0, windowSize / 2).reduce((a, b) => a + b, 0) / (windowSize / 2);
    const secondHalfAvg = values.slice(windowSize / 2).reduce((a, b) => a + b, 0) / (windowSize / 2);
    
    const change = secondHalfAvg - firstHalfAvg;
    const changePercent = Math.abs(change) / firstHalfAvg;
    
    if (changePercent > 0.3) {
      results.push({
        parameter: param,
        trend: change > 0 ? 'increasing' : 'decreasing',
        changeAmount: Math.abs(change),
      });
    }
  }

  return results;
}

export function generateAnomalyDescription(
  type: 'parameter_exceed' | 'boundary_anomaly' | 'trend_abnormal',
  param: keyof WaterQualityParams,
  value: number,
  threshold: number
): string {
  const paramInfo = PARAMETER_THRESHOLDS[param];
  
  switch (type) {
    case 'parameter_exceed':
      return `参数${paramInfo.name}超标：${value.toFixed(2)} ${paramInfo.unit}，阈值 ${threshold} ${paramInfo.unit}`;
    case 'boundary_anomaly':
      return `边界样本异常：${paramInfo.name} ${value.toFixed(2)} ${paramInfo.unit}，超过阈值 ${threshold} ${paramInfo.unit}`;
    case 'trend_abnormal':
      return `趋势异常：${paramInfo.name}持续${value > threshold ? '上升' : '下降'}，当前值 ${value.toFixed(2)} ${paramInfo.unit}`;
  }
}
