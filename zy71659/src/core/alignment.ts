import type { RawSample, AlignedSample, Calibration } from '../types';
import { calculateTorque } from './torque';

export const ALIGNMENT_THRESHOLD_MS = 50;
export const SAMPLE_RATE_MS = 100;

function calculateCrossCorrelation(
  series1: number[],
  series2: number[],
  maxLag: number
): { lag: number; correlation: number }[] {
  const results: { lag: number; correlation: number }[] = [];
  const n = series1.length;
  
  const mean1 = series1.reduce((a, b) => a + b, 0) / n;
  const mean2 = series2.reduce((a, b) => a + b, 0) / n;
  
  const variance1 = series1.reduce((acc, val) => acc + Math.pow(val - mean1, 2), 0);
  const variance2 = series2.reduce((acc, val) => acc + Math.pow(val - mean2, 2), 0);
  const denom = Math.sqrt(variance1 * variance2);
  
  if (denom === 0) {
    return [{ lag: 0, correlation: 0 }];
  }
  
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let sum = 0;
    const startIdx = Math.max(0, lag);
    const endIdx = Math.min(n, n + lag);
    
    for (let i = startIdx; i < endIdx; i++) {
      sum += (series1[i] - mean1) * (series2[i - lag] - mean2);
    }
    
    const correlation = sum / denom;
    results.push({ lag, correlation: Math.round(correlation * 1000) / 1000 });
  }
  
  return results;
}

function findBestLag(correlations: { lag: number; correlation: number }[]): number {
  let bestLag = 0;
  let maxCorrelation = -Infinity;
  
  for (const { lag, correlation } of correlations) {
    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      bestLag = lag;
    }
  }
  
  return bestLag;
}

function linearInterpolate(
  samples: RawSample[],
  targetTimestamps: number[]
): Map<number, RawSample> {
  const interpolated = new Map<number, RawSample>();
  
  for (const targetTs of targetTimestamps) {
    let leftIdx = 0;
    let rightIdx = samples.length - 1;
    
    while (leftIdx <= rightIdx) {
      const midIdx = Math.floor((leftIdx + rightIdx) / 2);
      if (samples[midIdx].timestamp < targetTs) {
        leftIdx = midIdx + 1;
      } else {
        rightIdx = midIdx - 1;
      }
    }
    
    if (rightIdx < 0) {
      interpolated.set(targetTs, { ...samples[0], timestamp: targetTs });
    } else if (leftIdx >= samples.length) {
      interpolated.set(targetTs, { ...samples[samples.length - 1], timestamp: targetTs });
    } else {
      const left = samples[rightIdx];
      const right = samples[leftIdx];
      const ratio = (targetTs - left.timestamp) / (right.timestamp - left.timestamp);
      
      interpolated.set(targetTs, {
        ...left,
        timestamp: targetTs,
        speed: left.speed + (right.speed - left.speed) * ratio,
        torqueRaw: left.torqueRaw + (right.torqueRaw - left.torqueRaw) * ratio,
        temperature: left.temperature + (right.temperature - left.temperature) * ratio,
        loadLevel: left.loadLevel ?? right.loadLevel
      });
    }
  }
  
  return interpolated;
}

export interface AlignmentResult {
  alignedSamples: AlignedSample[];
  shiftOffset: number;
  shiftConfidence: number;
  alignmentStatus: 'ok' | 'shifted';
}

export function alignCurves(
  rawSamples: RawSample[],
  calibration: Calibration,
  thresholdMs: number = ALIGNMENT_THRESHOLD_MS
): AlignmentResult {
  if (rawSamples.length < 10) {
    return {
      alignedSamples: rawSamples.map(s => ({
        rawSampleId: s.id!,
        timestamp: s.timestamp,
        deviceId: s.deviceId,
        speed: s.speed,
        torque: calculateTorque(s.torqueRaw, calibration),
        torqueRaw: s.torqueRaw,
        temperature: s.temperature,
        loadLevel: s.loadLevel ?? 0,
        alignmentStatus: 'ok',
        anomalyIds: [],
        calculatedAt: Date.now()
      })),
      shiftOffset: 0,
      shiftConfidence: 1,
      alignmentStatus: 'ok'
    };
  }
  
  const sortedSamples = [...rawSamples].sort((a, b) => a.timestamp - b.timestamp);
  
  const speedSeries = sortedSamples.map(s => s.speed);
  const torqueSeries = sortedSamples.map(s => s.torqueRaw);
  
  const maxLag = Math.min(50, Math.floor(sortedSamples.length / 4));
  const correlations = calculateCrossCorrelation(speedSeries, torqueSeries, maxLag);
  const bestLag = findBestLag(correlations);
  const bestCorrelation = correlations.find(c => c.lag === bestLag)?.correlation ?? 0;
  
  const shiftOffset = bestLag * SAMPLE_RATE_MS;
  const needsAlignment = Math.abs(shiftOffset) > thresholdMs;
  
  const baseTimestamps = sortedSamples.map(s => s.timestamp);
  
  let alignedData: RawSample[];
  if (needsAlignment) {
    const shiftedTimestamps = baseTimestamps.map(ts => ts - shiftOffset);
    const interpolated = linearInterpolate(sortedSamples, shiftedTimestamps);
    alignedData = shiftedTimestamps.map(ts => interpolated.get(ts)!);
  } else {
    alignedData = sortedSamples;
  }
  
  const alignedSamples: AlignedSample[] = alignedData.map((s, idx) => ({
    rawSampleId: sortedSamples[idx].id!,
    timestamp: baseTimestamps[idx],
    deviceId: s.deviceId,
    speed: s.speed,
    torque: calculateTorque(s.torqueRaw, calibration),
    torqueRaw: s.torqueRaw,
    temperature: s.temperature,
    loadLevel: s.loadLevel ?? 0,
    alignmentStatus: needsAlignment ? 'shifted' : 'ok',
    shiftOffset: needsAlignment ? shiftOffset : undefined,
    anomalyIds: [],
    calculatedAt: Date.now()
  }));
  
  return {
    alignedSamples,
    shiftOffset,
    shiftConfidence: Math.abs(bestCorrelation),
    alignmentStatus: needsAlignment ? 'shifted' : 'ok'
  };
}

export function detectSamplingAnomalies(
  samples: RawSample[],
  expectedRateMs: number = SAMPLE_RATE_MS
): {
  hasGaps: boolean;
  hasDuplicates: boolean;
  hasJitter: boolean;
  gapPositions: number[];
  duplicatePositions: number[];
  jitterAmount: number;
} {
  const sorted = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  const gapPositions: number[] = [];
  const duplicatePositions: number[] = [];
  let hasGaps = false;
  let hasDuplicates = false;
  let hasJitter = false;
  let totalJitter = 0;
  
  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i].timestamp - sorted[i - 1].timestamp;
    const jitter = Math.abs(diff - expectedRateMs);
    totalJitter += jitter;
    
    if (diff > expectedRateMs * 2) {
      gapPositions.push(i);
      hasGaps = true;
    }
    
    if (diff === 0 || Math.abs(sorted[i].timestamp - sorted[i - 1].timestamp) < 10) {
      duplicatePositions.push(i);
      hasDuplicates = true;
    }
    
    if (jitter > expectedRateMs * 0.5) {
      hasJitter = true;
    }
  }
  
  return {
    hasGaps,
    hasDuplicates,
    hasJitter,
    gapPositions,
    duplicatePositions,
    jitterAmount: totalJitter / Math.max(1, sorted.length - 1)
  };
}
