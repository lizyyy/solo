import type { AlignedSample, OperationSegment } from '../types';
import { calculateTorqueStatistics } from './torque';

export const MIN_SEGMENT_DURATION_MS = 5000;
export const LOAD_LEVEL_TOLERANCE = 0.5;

export interface LoadLevelChange {
  index: number;
  timestamp: number;
  oldLevel: number;
  newLevel: number;
}

export function detectLoadLevelChanges(
  samples: AlignedSample[],
  tolerance: number = LOAD_LEVEL_TOLERANCE
): LoadLevelChange[] {
  const changes: LoadLevelChange[] = [];
  
  if (samples.length < 2) return changes;
  
  let currentLevel = samples[0].loadLevel;
  
  for (let i = 1; i < samples.length; i++) {
    const newLevel = samples[i].loadLevel;
    
    if (Math.abs(newLevel - currentLevel) > tolerance) {
      changes.push({
        index: i,
        timestamp: samples[i].timestamp,
        oldLevel: currentLevel,
        newLevel
      });
      currentLevel = newLevel;
    }
  }
  
  return changes;
}

export function inferLoadLevel(
  speed: number,
  torque: number,
  knownPatterns: Array<{ loadLevel: number; speedRange: [number, number]; torqueRange: [number, number] }>
): { inferredLevel: number; confidence: number } {
  let bestMatch = { inferredLevel: 0, confidence: 0 };
  
  for (const pattern of knownPatterns) {
    const speedInRange = speed >= pattern.speedRange[0] && speed <= pattern.speedRange[1];
    const torqueInRange = torque >= pattern.torqueRange[0] && torque <= pattern.torqueRange[1];
    
    if (speedInRange && torqueInRange) {
      const speedCenter = (pattern.speedRange[0] + pattern.speedRange[1]) / 2;
      const torqueCenter = (pattern.torqueRange[0] + pattern.torqueRange[1]) / 2;
      
      const speedDeviation = Math.abs(speed - speedCenter) / (pattern.speedRange[1] - pattern.speedRange[0]);
      const torqueDeviation = Math.abs(torque - torqueCenter) / (pattern.torqueRange[1] - pattern.torqueRange[0]);
      
      const confidence = 1 - (speedDeviation + torqueDeviation) / 2;
      
      if (confidence > bestMatch.confidence) {
        bestMatch = { inferredLevel: pattern.loadLevel, confidence: Math.max(0, Math.min(1, confidence)) };
      }
    }
  }
  
  return bestMatch;
}

export function mergeShortSegments(
  segments: OperationSegment[],
  minDurationMs: number = MIN_SEGMENT_DURATION_MS
): OperationSegment[] {
  if (segments.length <= 1) return segments;
  
  const merged: OperationSegment[] = [];
  let current = { ...segments[0] };
  
  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];
    const currentDuration = current.endTime - current.startTime;
    const nextDuration = next.endTime - next.startTime;
    
    if (currentDuration < minDurationMs || nextDuration < minDurationMs) {
      const combinedSampleIds = [...current.sampleIds, ...next.sampleIds];
      const combinedAnomalyIds = [...new Set([...current.anomalyIds, ...next.anomalyIds])];
      
      current = {
        ...current,
        endTime: next.endTime,
        sampleCount: current.sampleCount + next.sampleCount,
        sampleIds: combinedSampleIds,
        anomalyIds: combinedAnomalyIds,
        hasAnomaly: current.hasAnomaly || next.hasAnomaly,
        avgSpeed: Math.round((current.avgSpeed * current.sampleCount + next.avgSpeed * next.sampleCount) / (current.sampleCount + next.sampleCount) * 1000) / 1000,
        avgTorque: Math.round((current.avgTorque * current.sampleCount + next.avgTorque * next.sampleCount) / (current.sampleCount + next.sampleCount) * 1000) / 1000,
        maxTorque: Math.max(current.maxTorque, next.maxTorque),
        minTorque: Math.min(current.minTorque, next.minTorque),
        avgTemperature: Math.round((current.avgTemperature * current.sampleCount + next.avgTemperature * next.sampleCount) / (current.sampleCount + next.sampleCount) * 1000) / 1000,
        maxTemperature: Math.max(current.maxTemperature, next.maxTemperature)
      };
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  
  merged.push(current);
  return merged;
}

export function createSegments(
  samples: AlignedSample[],
  minDurationMs: number = MIN_SEGMENT_DURATION_MS
): OperationSegment[] {
  if (samples.length === 0) return [];
  
  const sortedSamples = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  const changes = detectLoadLevelChanges(sortedSamples);
  
  const segmentBoundaries: Array<{ startIdx: number; endIdx: number; loadLevel: number }> = [];
  
  let startIdx = 0;
  let currentLoadLevel = sortedSamples[0].loadLevel;
  
  for (const change of changes) {
    segmentBoundaries.push({
      startIdx,
      endIdx: change.index,
      loadLevel: currentLoadLevel
    });
    startIdx = change.index;
    currentLoadLevel = change.newLevel;
  }
  
  segmentBoundaries.push({
    startIdx,
    endIdx: sortedSamples.length,
    loadLevel: currentLoadLevel
  });
  
  let segments: OperationSegment[] = segmentBoundaries.map((boundary, segIdx) => {
    const segmentSamples = sortedSamples.slice(boundary.startIdx, boundary.endIdx);
    
    if (segmentSamples.length === 0) return null;
    
    const torques = segmentSamples.map(s => s.torque);
    const speeds = segmentSamples.map(s => s.speed);
    const temperatures = segmentSamples.map(s => s.temperature);
    const torqueStats = calculateTorqueStatistics(torques);
    
    const anomalyIds = [...new Set(segmentSamples.flatMap(s => s.anomalyIds))];
    
    return {
      id: `seg_${Date.now()}_${segIdx}`,
      deviceId: segmentSamples[0].deviceId,
      startTime: segmentSamples[0].timestamp,
      endTime: segmentSamples[segmentSamples.length - 1].timestamp,
      loadLevel: boundary.loadLevel,
      sampleCount: segmentSamples.length,
      avgSpeed: Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length * 1000) / 1000,
      avgTorque: torqueStats.avg,
      maxTorque: torqueStats.max,
      minTorque: torqueStats.min,
      avgTemperature: Math.round(temperatures.reduce((a, b) => a + b, 0) / temperatures.length * 1000) / 1000,
      maxTemperature: Math.max(...temperatures),
      hasAnomaly: anomalyIds.length > 0,
      anomalyIds,
      sampleIds: segmentSamples.map(s => s.id!),
      createdAt: Date.now()
    };
  }).filter(Boolean) as OperationSegment[];
  
  segments = mergeShortSegments(segments, minDurationMs);
  
  return segments.map((seg, idx) => ({
    ...seg,
    id: `seg_${Date.now()}_${idx}`
  }));
}
