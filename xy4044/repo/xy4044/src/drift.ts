import { Event, CalibrationEvidence, Problem } from './types';
import { createProblem } from './models';

const DRIFT_WINDOW_SIZE = 5;
const DRIFT_THRESHOLD_PPM = 100;

export interface DriftAnalysis {
  driftRate: number;
  driftRatePpm: number;
  isSignificant: boolean;
  confidence: number;
  startTime: number;
  endTime: number;
}

export function linearRegression(
  x: number[],
  y: number[]
): { slope: number; intercept: number; r2: number } {
  if (x.length !== y.length || x.length < 2) {
    return { slope: 0, intercept: 0, r2: 0 };
  }

  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumXX += x[i] * x[i];
    sumYY += y[i] * y[i];
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const yMean = sumY / n;
  const totalSS = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const residualSS = y.reduce((sum, yi, i) => {
    const predicted = slope * x[i] + intercept;
    return sum + Math.pow(yi - predicted, 2);
  }, 0);

  const r2 = totalSS === 0 ? 0 : 1 - residualSS / totalSS;

  return { slope, intercept, r2: Math.max(0, Math.min(1, r2)) };
}

export function calculateDrift(
  evidence: CalibrationEvidence[],
  timeSpanMs: number
): DriftAnalysis | null {
  if (evidence.length < DRIFT_WINDOW_SIZE) {
    return null;
  }

  const sortedEvidence = [...evidence].sort((a, b) => a.referenceTimestamp - b.referenceTimestamp);
  
  const referenceTimes = sortedEvidence.map(e => e.referenceTimestamp);
  const deltas = sortedEvidence.map(e => e.delta);

  const { slope, r2 } = linearRegression(referenceTimes, deltas);

  const startTime = referenceTimes[0];
  const endTime = referenceTimes[referenceTimes.length - 1];
  const actualTimeSpan = endTime - startTime;

  if (actualTimeSpan === 0) {
    return null;
  }

  const driftRatePpm = (slope * 1000) * 1000;

  const isSignificant = Math.abs(driftRatePpm) > DRIFT_THRESHOLD_PPM && r2 > 0.5;

  return {
    driftRate: slope,
    driftRatePpm: Math.round(driftRatePpm * 100) / 100,
    isSignificant,
    confidence: r2,
    startTime,
    endTime
  };
}

export function detectFrameDrops(
  events: Event[],
  expectedFrameRate: number
): { frameDrops: number; dropIntervals: [number, number][]; confidence: number } {
  const frameEvents = events.filter(e => e.type === 'flash_frame' || e.type === 'rtp_timestamp');
  
  if (frameEvents.length < 2 || expectedFrameRate <= 0) {
    return { frameDrops: 0, dropIntervals: [], confidence: 0 };
  }

  const sortedEvents = [...frameEvents].sort((a, b) => a.timestamp - b.timestamp);
  const expectedIntervalMs = 1000 / expectedFrameRate;
  const dropThreshold = expectedIntervalMs * 1.5;

  const dropIntervals: [number, number][] = [];
  let totalDrops = 0;

  for (let i = 1; i < sortedEvents.length; i++) {
    const interval = sortedEvents[i].timestamp - sortedEvents[i - 1].timestamp;
    
    if (interval > dropThreshold) {
      const estimatedDrops = Math.floor(interval / expectedIntervalMs) - 1;
      if (estimatedDrops > 0) {
        totalDrops += estimatedDrops;
        dropIntervals.push([
          sortedEvents[i - 1].timestamp,
          sortedEvents[i].timestamp
        ]);
      }
    }
  }

  const confidence = frameEvents.length >= 10 ? 0.8 : 0.5;

  return {
    frameDrops: totalDrops,
    dropIntervals,
    confidence
  };
}

export function detectClockDriftProblems(
  sources: { sourceId: string; evidence: CalibrationEvidence[] }[],
  timeSpanMs: number
): Problem[] {
  const problems: Problem[] = [];

  for (const { sourceId, evidence } of sources) {
    const drift = calculateDrift(evidence, timeSpanMs);
    
    if (drift && drift.isSignificant) {
      const direction = drift.driftRate > 0 ? '快' : '慢';
      problems.push(createProblem({
        type: 'clock_drift',
        severity: 'warning',
        sourceId,
        message: `检测到时钟漂移: ${Math.abs(drift.driftRatePpm).toFixed(1)} PPM (时钟${direction}于参考)`,
        suggestion: drift.driftRate > 0 
          ? '该源的时钟比参考快，建议检查设备采样率配置'
          : '该源的时钟比参考慢，建议检查设备采样率配置',
        detectedAt: Date.now(),
        resolved: false
      }));
    }
  }

  return problems;
}

export function calculateJitter(events: Event[]): { 
  avgJitter: number; 
  maxJitter: number; 
  minJitter: number;
  jitterValues: number[];
} {
  if (events.length < 2) {
    return { avgJitter: 0, maxJitter: 0, minJitter: 0, jitterValues: [] };
  }

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const intervals: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    intervals.push(sorted[i].timestamp - sorted[i - 1].timestamp);
  }

  if (intervals.length < 2) {
    return { avgJitter: 0, maxJitter: 0, minJitter: 0, jitterValues: [] };
  }

  const meanInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
  const jitterValues = intervals.map(i => Math.abs(i - meanInterval));

  const avgJitter = jitterValues.reduce((sum, j) => sum + j, 0) / jitterValues.length;
  const maxJitter = Math.max(...jitterValues);
  const minJitter = Math.min(...jitterValues);

  return { avgJitter, maxJitter, minJitter, jitterValues };
}
