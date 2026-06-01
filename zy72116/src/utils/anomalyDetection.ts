import { DataPoint, AnomalyConfig, AnomalyStatistics } from '../types';

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

export function detectAnomaliesIQR(
  points: DataPoint[],
  multiplier: number = 1.5
): DataPoint[] {
  const values = points.map(p => p.centrifugalForce);
  const q1 = calculatePercentile(values, 25);
  const q3 = calculatePercentile(values, 75);
  const iqr = q3 - q1;
  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  return points.map(point => {
    const isAnomaly = point.centrifugalForce < lowerBound || point.centrifugalForce > upperBound;
    let reason = '';
    
    if (isAnomaly) {
      if (point.centrifugalForce > upperBound) {
        reason = `IQR检测：值 ${point.centrifugalForce.toFixed(1)} 超过上界 ${upperBound.toFixed(1)}（Q3+${multiplier}*IQR）`;
      } else {
        reason = `IQR检测：值 ${point.centrifugalForce.toFixed(1)} 低于下界 ${lowerBound.toFixed(1)}（Q1-${multiplier}*IQR）`;
      }
    }

    return {
      ...point,
      isAnomaly,
      anomalyReason: reason || point.anomalyReason
    };
  });
}

export function detectAnomaliesZScore(
  points: DataPoint[],
  threshold: number = 3.0
): DataPoint[] {
  const values = points.map(p => p.centrifugalForce);
  const mean = calculateMean(values);
  const stdDev = calculateStdDev(values, mean);

  if (stdDev === 0) {
    return points.map(p => ({ ...p, isAnomaly: false }));
  }

  return points.map(point => {
    const zScore = (point.centrifugalForce - mean) / stdDev;
    const isAnomaly = Math.abs(zScore) > threshold;
    const reason = isAnomaly 
      ? `Z-Score检测：Z值 ${zScore.toFixed(2)} 超过阈值 ${threshold}（均值=${mean.toFixed(1)}, 标准差=${stdDev.toFixed(1)}）`
      : '';

    return {
      ...point,
      isAnomaly,
      anomalyReason: reason || point.anomalyReason
    };
  });
}

export function detectAnomaliesThreshold(
  points: DataPoint[],
  min: number,
  max: number
): DataPoint[] {
  return points.map(point => {
    const isAnomaly = point.centrifugalForce < min || point.centrifugalForce > max;
    let reason = '';
    
    if (isAnomaly) {
      if (point.centrifugalForce > max) {
        reason = `阈值检测：值 ${point.centrifugalForce.toFixed(1)} 超过上限 ${max}`;
      } else {
        reason = `阈值检测：值 ${point.centrifugalForce.toFixed(1)} 低于下限 ${min}`;
      }
    }

    return {
      ...point,
      isAnomaly,
      anomalyReason: reason || point.anomalyReason
    };
  });
}

export function detectAnomalies(
  points: DataPoint[],
  config: AnomalyConfig
): DataPoint[] {
  switch (config.method) {
    case 'iqr':
      return detectAnomaliesIQR(points, config.iqrMultiplier);
    case 'zscore':
      return detectAnomaliesZScore(points, config.zscoreThreshold);
    case 'threshold':
      if (config.manualThreshold) {
        return detectAnomaliesThreshold(
          points,
          config.manualThreshold.min,
          config.manualThreshold.max
        );
      }
      return detectAnomaliesIQR(points, config.iqrMultiplier);
    default:
      return detectAnomaliesIQR(points, config.iqrMultiplier);
  }
}

export function calculateStatistics(points: DataPoint[]): AnomalyStatistics {
  const values = points.map(p => p.centrifugalForce);
  const anomalyPoints = points.filter(p => p.isAnomaly);
  const anomalyValues = anomalyPoints.map(p => p.centrifugalForce);

  return {
    totalCount: points.length,
    anomalyCount: anomalyPoints.length,
    normalCount: points.length - anomalyPoints.length,
    maxValue: Math.max(...values),
    minValue: Math.min(...values),
    avgValue: calculateMean(values),
    maxAnomalyValue: anomalyValues.length > 0 ? Math.max(...anomalyValues) : undefined,
    anomalyPoints
  };
}

export function calculateMovingAverage(
  points: DataPoint[],
  windowSize: number = 3
): { timeLabel: string; value: number }[] {
  const result: { timeLabel: string; value: number }[] = [];
  
  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(points.length, i + Math.floor(windowSize / 2) + 1);
    const window = points.slice(start, end);
    const avg = calculateMean(window.map(p => p.centrifugalForce));
    
    result.push({
      timeLabel: points[i].timeLabel,
      value: avg
    });
  }
  
  return result;
}
