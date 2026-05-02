import { Event, Source, CalibrationResult, SyncIssue } from './types';
import { createSyncIssue } from './models';

const SYNC_TOLERANCE_MS = 30;

export interface TimelineBounds {
  startTime: number;
  endTime: number;
  duration: number;
}

export interface EventWithOffset extends Event {
  offsetTimestamp: number;
}

export interface SyncCheckResult {
  isInSync: boolean;
  maxDeviation: number;
  sources: { sourceId: string; offset: number; eventCount: number }[];
}

export function calculateTimelineBounds(events: Event[]): TimelineBounds {
  if (events.length === 0) {
    return { startTime: 0, endTime: 0, duration: 0 };
  }

  const timestamps = events.map(e => e.timestamp);
  const startTime = Math.min(...timestamps);
  const endTime = Math.max(...timestamps);

  return {
    startTime,
    endTime,
    duration: endTime - startTime
  };
}

export function applyOffsetsToEvents(
  events: Event[],
  calibrationResults: CalibrationResult[]
): EventWithOffset[] {
  return events.map(event => {
    const result = calibrationResults.find(r => r.sourceId === event.sourceId);
    const offset = result?.delayOffset || 0;
    
    return {
      ...event,
      offsetTimestamp: event.timestamp - offset
    };
  });
}

export function groupEventsByTimeWithOffsets(
  events: EventWithOffset[],
  maxDeltaMs: number = 50
): { referenceTime: number; events: EventWithOffset[] }[] {
  if (events.length === 0) return [];

  const sortedByOffset = [...events].sort((a, b) => a.offsetTimestamp - b.offsetTimestamp);
  const groups: { referenceTime: number; events: EventWithOffset[] }[] = [];
  let currentGroup: { referenceTime: number; events: EventWithOffset[] } | null = null;

  for (const event of sortedByOffset) {
    if (!currentGroup) {
      currentGroup = {
        referenceTime: event.offsetTimestamp,
        events: [event]
      };
    } else {
      const delta = event.offsetTimestamp - currentGroup.referenceTime;
      if (delta <= maxDeltaMs) {
        currentGroup.events.push(event);
      } else {
        groups.push(currentGroup);
        currentGroup = {
          referenceTime: event.offsetTimestamp,
          events: [event]
        };
      }
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

export function checkSyncAtTime(
  time: number,
  events: EventWithOffset[],
  sources: Source[],
  toleranceMs: number = SYNC_TOLERANCE_MS
): SyncCheckResult {
  const nearbyEvents = events.filter(e => 
    Math.abs(e.offsetTimestamp - time) <= toleranceMs
  );

  const sourceIds = new Set(nearbyEvents.map(e => e.sourceId));
  const activeSources = sources.filter(s => s.isInMix);
  
  const sourceOffsets: { sourceId: string; offset: number; eventCount: number }[] = [];
  
  for (const source of activeSources) {
    const sourceEvents = nearbyEvents.filter(e => e.sourceId === source.id);
    if (sourceEvents.length > 0) {
      const avgOffset = sourceEvents.reduce((sum, e) => sum + (e.offsetTimestamp - time), 0) / sourceEvents.length;
      sourceOffsets.push({
        sourceId: source.id,
        offset: avgOffset,
        eventCount: sourceEvents.length
      });
    }
  }

  if (sourceOffsets.length < 2) {
    return {
      isInSync: true,
      maxDeviation: 0,
      sources: sourceOffsets
    };
  }

  const offsets = sourceOffsets.map(s => s.offset);
  const maxDeviation = Math.max(...offsets) - Math.min(...offsets);

  return {
    isInSync: maxDeviation <= toleranceMs,
    maxDeviation,
    sources: sourceOffsets
  };
}

export function detectSyncIssues(
  events: EventWithOffset[],
  sources: Source[],
  toleranceMs: number = SYNC_TOLERANCE_MS,
  windowSizeMs: number = 100
): SyncIssue[] {
  const issues: SyncIssue[] = [];
  const bounds = calculateTimelineBounds(events.map(e => ({ ...e, timestamp: e.offsetTimestamp })));

  if (bounds.duration === 0) return issues;

  const groups = groupEventsByTimeWithOffsets(events, windowSizeMs);

  for (const group of groups) {
    if (group.events.length < 2) continue;

    const sourceIds = new Set(group.events.map(e => e.sourceId));
    if (sourceIds.size < 2) continue;

    const offsets = group.events.map(e => e.offsetTimestamp);
    const maxOffset = Math.max(...offsets);
    const minOffset = Math.min(...offsets);
    const deviation = maxOffset - minOffset;

    if (deviation > toleranceMs) {
      const activeSourceIds = new Set(
        sources.filter(s => s.isInMix).map(s => s.id)
      );
      const affectedSourceIds = Array.from(sourceIds).filter(id => activeSourceIds.has(id));

      if (affectedSourceIds.length >= 2) {
        issues.push(createSyncIssue({
          timeRange: [minOffset, maxOffset],
          sources: affectedSourceIds,
          maxDeviation: deviation,
          description: `在 ${minOffset.toFixed(0)}ms - ${maxOffset.toFixed(0)}ms 检测到不同步，最大偏差 ${deviation.toFixed(1)}ms`
        }));
      }
    }
  }

  return issues;
}

export function getEventsInRange(
  events: Event[],
  startTime: number,
  endTime: number
): Event[] {
  return events.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
}

export function getSourceDelayInfo(
  sourceId: string,
  calibrationResults: CalibrationResult[]
): { delayOffset: number; direction: 'lead' | 'lag' | 'none' | null; readable: string } {
  const result = calibrationResults.find(r => r.sourceId === sourceId);
  
  if (!result || result.delayOffset === 0) {
    return {
      delayOffset: 0,
      direction: 'none',
      readable: '与主时钟同步'
    };
  }

  const direction = result.delayOffset > 0 ? 'lag' : 'lead';
  const absDelay = Math.abs(result.delayOffset);

  return {
    delayOffset: result.delayOffset,
    direction,
    readable: direction === 'lead' 
      ? `提前 ${absDelay.toFixed(1)}ms (需要延后)`
      : `延后 ${absDelay.toFixed(1)}ms (需要提前)`
  };
}
