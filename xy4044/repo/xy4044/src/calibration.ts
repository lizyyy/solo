import { 
  Event, 
  Source, 
  CalibrationResult, 
  CalibrationEvidence,
  Problem,
  EventType
} from './types';
import { createCalibrationResult, createProblem, getConfidenceLevel } from './models';

const JITTER_THRESHOLD_MS = 100;
const DRIFT_THRESHOLD_PPM = 100;
const MIN_ANCHOR_COUNT = 3;

export interface EventGroup {
  referenceTime: number;
  events: { sourceId: string; event: Event }[];
}

export function groupEventsByTime(
  events: Event[],
  maxDeltaMs: number = 50
): EventGroup[] {
  if (events.length === 0) return [];

  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const groups: EventGroup[] = [];
  let currentGroup: EventGroup | null = null;

  for (const event of sortedEvents) {
    if (!currentGroup) {
      currentGroup = {
        referenceTime: event.timestamp,
        events: [{ sourceId: event.sourceId, event }]
      };
    } else {
      const delta = event.timestamp - currentGroup.referenceTime;
      if (delta <= maxDeltaMs) {
        currentGroup.events.push({ sourceId: event.sourceId, event });
      } else {
        groups.push(currentGroup);
        currentGroup = {
          referenceTime: event.timestamp,
          events: [{ sourceId: event.sourceId, event }]
        };
      }
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

export function selectMasterClockSource(
  sources: Source[],
  events: Event[]
): Source | null {
  const sourceEventCounts = new Map<string, number>();
  
  for (const event of events) {
    const count = sourceEventCounts.get(event.sourceId) || 0;
    sourceEventCounts.set(event.sourceId, count + 1);
  }

  let bestSource: Source | null = null;
  let bestScore = -1;

  for (const source of sources) {
    const eventCount = sourceEventCounts.get(source.id) || 0;
    if (eventCount === 0) continue;

    let score = eventCount * 10;
    if (source.type === 'microphone') score += 5;
    if (source.type === 'local_file') score += 3;
    if (source.sampleRate && source.sampleRate >= 48000) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestSource = source;
    }
  }

  return bestSource;
}

export function calculateDelayForSource(
  sourceId: string,
  events: Event[],
  masterSourceId: string,
  eventGroups: EventGroup[]
): { delay: number; confidence: number; evidence: CalibrationEvidence[] } {
  const evidence: CalibrationEvidence[] = [];

  for (const group of eventGroups) {
    const masterEvent = group.events.find(e => e.sourceId === masterSourceId);
    const sourceEvent = group.events.find(e => e.sourceId === sourceId);

    if (masterEvent && sourceEvent) {
      const delta = sourceEvent.event.timestamp - masterEvent.event.timestamp;
      evidence.push({
        type: sourceEvent.event.type,
        sourceTimestamp: sourceEvent.event.timestamp,
        referenceTimestamp: masterEvent.event.timestamp,
        delta,
        confidence: Math.min(masterEvent.event.confidence, sourceEvent.event.confidence)
      });
    }
  }

  if (evidence.length === 0) {
    return { delay: 0, confidence: 0, evidence: [] };
  }

  const deltas = evidence.map(e => e.delta);
  const weights = evidence.map(e => e.confidence);
  
  const weightedSum = deltas.reduce((sum, d, i) => sum + d * weights[i], 0);
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const weightedMean = weightedSum / weightSum;

  const variance = deltas.reduce((sum, d, i) => {
    return sum + weights[i] * Math.pow(d - weightedMean, 2);
  }, 0) / weightSum;

  const stdDev = Math.sqrt(variance);
  
  const outlierThreshold = 2 * stdDev;
  const filteredEvidence = evidence.filter(e => 
    Math.abs(e.delta - weightedMean) <= outlierThreshold
  );

  if (filteredEvidence.length === 0) {
    return { delay: weightedMean, confidence: 0, evidence };
  }

  const filteredDeltas = filteredEvidence.map(e => e.delta);
  const filteredWeights = filteredEvidence.map(e => e.confidence);
  
  const filteredWeightedSum = filteredDeltas.reduce((sum, d, i) => sum + d * filteredWeights[i], 0);
  const filteredWeightSum = filteredWeights.reduce((sum, w) => sum + w, 0);
  const finalDelay = filteredWeightedSum / filteredWeightSum;

  const confidenceFromCount = Math.min(1, filteredEvidence.length / MIN_ANCHOR_COUNT);
  const confidenceFromConsistency = Math.max(0, 1 - (stdDev / 50));
  const confidenceFromWeights = filteredWeightSum / filteredEvidence.length;
  
  const finalConfidence = (confidenceFromCount * 0.4 + confidenceFromConsistency * 0.4 + confidenceFromWeights * 0.2);

  return {
    delay: finalDelay,
    confidence: finalConfidence,
    evidence: filteredEvidence
  };
}

export function detectProblems(
  sources: Source[],
  events: Event[],
  eventGroups: EventGroup[],
  calibrationResults: CalibrationResult[]
): Problem[] {
  const problems: Problem[] = [];

  const sourceEventCounts = new Map<string, number>();
  for (const event of events) {
    const count = sourceEventCounts.get(event.sourceId) || 0;
    sourceEventCounts.set(event.sourceId, count + 1);
  }

  for (const source of sources) {
    const count = sourceEventCounts.get(source.id) || 0;
    if (count === 0) {
      problems.push(createProblem({
        type: 'insufficient_anchors',
        severity: 'warning',
        sourceId: source.id,
        message: `源 "${source.name}" 没有锚点事件，无法自动校准`,
        suggestion: '导入该源的事件日志或手动添加锚点'
      }));
    } else if (count < MIN_ANCHOR_COUNT) {
      problems.push(createProblem({
        type: 'insufficient_anchors',
        severity: 'warning',
        sourceId: source.id,
        message: `源 "${source.name}" 只有 ${count} 个锚点，建议至少 ${MIN_ANCHOR_COUNT} 个`,
        suggestion: '添加更多锚点以提高校准精度'
      }));
    }
  }

  for (const group of eventGroups) {
    if (group.events.length < 2) continue;

    const deltas = group.events.map(e => e.event.timestamp - group.referenceTime);
    const maxDelta = Math.max(...deltas);
    const minDelta = Math.min(...deltas);
    const range = maxDelta - minDelta;

    if (range > JITTER_THRESHOLD_MS) {
      const sourceNames = group.events.map(e => {
        const source = sources.find(s => s.id === e.sourceId);
        return source?.name || e.sourceId;
      }).join(', ');

      problems.push(createProblem({
        type: 'jitter_too_high',
        severity: 'warning',
        message: `时间 ${group.referenceTime}ms 附近的事件抖动过大 (${range.toFixed(0)}ms)`,
        suggestion: `涉及源: ${sourceNames}。检查网络状况或设备同步`,
        affectedEvents: group.events.map(e => e.event.id)
      }));
    }
  }

  const sourceNames = sources.map(s => s.name.toLowerCase());
  const nameCounts = new Map<string, number>();
  for (const name of sourceNames) {
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  }

  for (const [name, count] of nameCounts.entries()) {
    if (count > 1) {
      const duplicates = sources.filter(s => s.name.toLowerCase() === name);
      problems.push(createProblem({
        type: 'duplicate_source',
        severity: 'info',
        message: `发现 ${count} 个名称相似的源: "${name}"`,
        suggestion: `检查源ID: ${duplicates.map(d => d.id).join(', ')}。确认是否为重复导入`
      }));
    }
  }

  const sampleRates = new Set<number>();
  for (const source of sources) {
    if (source.sampleRate) {
      sampleRates.add(source.sampleRate);
    }
  }

  if (sampleRates.size > 1) {
    problems.push(createProblem({
      type: 'sample_rate_mismatch',
      severity: 'warning',
      message: `检测到不同的采样率: ${Array.from(sampleRates).join(', ')} Hz`,
      suggestion: '建议所有音频源使用相同的采样率以避免重采样问题'
    }));
  }

  return problems;
}

export function runCalibration(
  sources: Source[],
  events: Event[],
  masterClockSourceId?: string
): {
  results: CalibrationResult[];
  problems: Problem[];
  masterSourceId: string | null;
} {
  const eventGroups = groupEventsByTime(events, 50);

  let masterSource: Source | null = null;
  
  if (masterClockSourceId) {
    masterSource = sources.find(s => s.id === masterClockSourceId) || null;
  }

  if (!masterSource) {
    masterSource = selectMasterClockSource(sources, events);
  }

  if (!masterSource) {
    return {
      results: [],
      problems: [
        createProblem({
          type: 'insufficient_anchors',
          severity: 'critical',
          message: '没有足够的锚点事件来选择主时钟源',
          suggestion: '请先导入事件日志或手动添加锚点'
        })
      ],
      masterSourceId: null
    };
  }

  const results: CalibrationResult[] = [];

  for (const source of sources) {
    if (source.id === masterSource.id) {
      results.push(createCalibrationResult({
        sourceId: source.id,
        delayOffset: 0,
        confidence: 1.0,
        confidenceLevel: 'very_high',
        evidence: [],
        isManualOverride: false
      }));
      continue;
    }

    const { delay, confidence, evidence } = calculateDelayForSource(
      source.id,
      events,
      masterSource.id,
      eventGroups
    );

    results.push(createCalibrationResult({
      sourceId: source.id,
      delayOffset: Math.round(delay * 100) / 100,
      confidence: Math.round(confidence * 1000) / 1000,
      confidenceLevel: getConfidenceLevel(confidence),
      evidence,
      isManualOverride: false
    }));
  }

  const problems = detectProblems(sources, events, eventGroups, results);

  return {
    results,
    problems,
    masterSourceId: masterSource.id
  };
}
