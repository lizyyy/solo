import { 
  TimestampedEvent, 
  LogSource, 
  NormalizedTimeline 
} from '../types';
import { generateId, sortByKey } from '../utils';

export interface TimeAlignment {
  sourceId: string;
  originalTime: number;
  targetTime: number;
}

export interface TimelineNormalizerOptions {
  sessionId?: string;
  alignments?: TimeAlignment[];
  referenceTime?: number;
  autoAlign?: boolean;
}

interface SourceWithEvents {
  source: LogSource;
  events: TimestampedEvent[];
  offset: number;
}

export class TimelineNormalizer {
  private sessionId: string;
  private options: TimelineNormalizerOptions;

  constructor(options: TimelineNormalizerOptions = {}) {
    this.sessionId = options.sessionId || generateId();
    this.options = options;
  }

  normalize(
    sourcesWithEvents: Array<{ source: LogSource; events: TimestampedEvent[] }>,
    options: TimelineNormalizerOptions = {}
  ): NormalizedTimeline {
    const mergedOptions = { ...this.options, ...options };
    
    if (sourcesWithEvents.length === 0) {
      throw new Error('需要至少一个日志源进行时间轴归一化');
    }

    const processedSources = this.calculateOffsets(sourcesWithEvents, mergedOptions);
    
    const allEvents = this.applyOffsetsAndMerge(processedSources);
    const sortedEvents = sortByKey(allEvents, e => e.timestamp);

    const timeRange = this.calculateTimeRange(sortedEvents);
    const globalOffset = this.calculateGlobalOffset(timeRange, mergedOptions);

    const finalEvents = this.applyGlobalOffset(sortedEvents, globalOffset);
    const finalSources = this.updateSourceTimes(processedSources, globalOffset);

    const finalTimeRange = this.calculateTimeRange(finalEvents);

    return {
      id: generateId(),
      sessionId: this.sessionId,
      events: finalEvents,
      startTime: finalTimeRange.start,
      endTime: finalTimeRange.end,
      sources: finalSources,
      timeOffset: globalOffset
    };
  }

  private calculateOffsets(
    sourcesWithEvents: Array<{ source: LogSource; events: TimestampedEvent[] }>,
    options: TimelineNormalizerOptions
  ): SourceWithEvents[] {
    const result: SourceWithEvents[] = [];
    const alignments = options.alignments || [];
    
    const groupedAlignments = new Map<string, TimeAlignment[]>();
    for (const alignment of alignments) {
      if (!groupedAlignments.has(alignment.sourceId)) {
        groupedAlignments.set(alignment.sourceId, []);
      }
      groupedAlignments.get(alignment.sourceId)!.push(alignment);
    }

    let referenceSource: SourceWithEvents | null = null;

    for (const item of sourcesWithEvents) {
      const sourceAlignments = groupedAlignments.get(item.source.id) || [];
      let offset = 0;

      if (sourceAlignments.length > 0) {
        offset = this.calculateOffsetFromAlignments(sourceAlignments);
      } else if (options.autoAlign && referenceSource !== null) {
        offset = this.calculateAutoOffset(item, referenceSource);
      }

      const processedItem: SourceWithEvents = {
        source: item.source,
        events: item.events,
        offset
      };

      if (referenceSource === null && (options.autoAlign || sourceAlignments.length === 0)) {
        referenceSource = processedItem;
      }

      result.push(processedItem);
    }

    return result;
  }

  private calculateOffsetFromAlignments(alignments: TimeAlignment[]): number {
    if (alignments.length === 0) return 0;

    const offsets = alignments.map(a => a.targetTime - a.originalTime);
    
    if (offsets.length === 1) {
      return offsets[0];
    }

    const sortedOffsets = [...offsets].sort((a, b) => a - b);
    const mid = Math.floor(sortedOffsets.length / 2);
    return sortedOffsets.length % 2 !== 0 
      ? sortedOffsets[mid] 
      : (sortedOffsets[mid - 1] + sortedOffsets[mid]) / 2;
  }

  private calculateAutoOffset(
    source: { source: LogSource; events: TimestampedEvent[] },
    reference: SourceWithEvents
  ): number {
    if (source.events.length === 0 || reference.events.length === 0) {
      return 0;
    }

    const sourceStart = Math.min(...source.events.map(e => e.timestamp));
    const referenceStart = Math.min(...reference.events.map(e => e.timestamp));

    return referenceStart - sourceStart;
  }

  private applyOffsetsAndMerge(sources: SourceWithEvents[]): TimestampedEvent[] {
    const allEvents: TimestampedEvent[] = [];

    for (const source of sources) {
      for (const event of source.events) {
        allEvents.push({
          ...event,
          timestamp: event.timestamp + source.offset
        });
      }
    }

    return allEvents;
  }

  private calculateTimeRange(events: TimestampedEvent[]): { start: number; end: number } {
    if (events.length === 0) {
      const now = Date.now();
      return { start: now, end: now };
    }

    const timestamps = events.map(e => e.timestamp);
    return {
      start: Math.min(...timestamps),
      end: Math.max(...timestamps)
    };
  }

  private calculateGlobalOffset(
    timeRange: { start: number; end: number },
    options: TimelineNormalizerOptions
  ): number {
    if (options.referenceTime !== undefined) {
      return options.referenceTime - timeRange.start;
    }

    return 0;
  }

  private applyGlobalOffset(events: TimestampedEvent[], offset: number): TimestampedEvent[] {
    if (offset === 0) {
      return events;
    }

    return events.map(event => ({
      ...event,
      timestamp: event.timestamp + offset
    }));
  }

  private updateSourceTimes(
    sources: SourceWithEvents[],
    globalOffset: number
  ): LogSource[] {
    return sources.map(item => {
      const adjustedEvents = item.events.map(e => e.timestamp + item.offset + globalOffset);
      
      if (adjustedEvents.length === 0) {
        return {
          ...item.source,
          startTime: item.source.startTime + item.offset + globalOffset,
          endTime: item.source.endTime + item.offset + globalOffset
        };
      }

      return {
        ...item.source,
        startTime: Math.min(...adjustedEvents),
        endTime: Math.max(...adjustedEvents)
      };
    });
  }

  createAlignment(
    sourceId: string,
    originalTime: number,
    targetTime: number
  ): TimeAlignment {
    return {
      sourceId,
      originalTime,
      targetTime
    };
  }

  alignByEventTypes(
    sourcesWithEvents: Array<{ source: LogSource; events: TimestampedEvent[] }>,
    eventTypes: string[]
  ): TimeAlignment[] {
    const alignments: TimeAlignment[] = [];
    
    if (sourcesWithEvents.length < 2) {
      return alignments;
    }

    const referenceSource = sourcesWithEvents[0];
    
    for (const eventType of eventTypes) {
      const referenceEvents = referenceSource.events.filter(e => e.type === eventType);
      
      if (referenceEvents.length === 0) continue;

      for (let i = 1; i < sourcesWithEvents.length; i++) {
        const source = sourcesWithEvents[i];
        const sourceEvents = source.events.filter(e => e.type === eventType);

        if (sourceEvents.length > 0 && referenceEvents.length > 0) {
          const refEvent = referenceEvents[0];
          const srcEvent = sourceEvents[0];
          
          alignments.push({
            sourceId: source.source.id,
            originalTime: srcEvent.timestamp,
            targetTime: refEvent.timestamp
          });
        }
      }
    }

    return alignments;
  }

  sliceTimeline(
    timeline: NormalizedTimeline,
    startTime: number,
    endTime: number
  ): NormalizedTimeline {
    const filteredEvents = timeline.events.filter(
      e => e.timestamp >= startTime && e.timestamp <= endTime
    );

    const filteredSources = timeline.sources.map(source => ({
      ...source,
      startTime: Math.max(source.startTime, startTime),
      endTime: Math.min(source.endTime, endTime)
    }));

    return {
      ...timeline,
      id: generateId(),
      events: filteredEvents,
      startTime,
      endTime,
      sources: filteredSources
    };
  }

  getEventsInRange(
    timeline: NormalizedTimeline,
    startTime: number,
    endTime: number
  ): TimestampedEvent[] {
    return timeline.events.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
  }

  getEventsByType(
    timeline: NormalizedTimeline,
    type: string
  ): TimestampedEvent[] {
    return timeline.events.filter(e => e.type === type);
  }

  getEventsBySource(
    timeline: NormalizedTimeline,
    sourceId: string
  ): TimestampedEvent[] {
    const source = timeline.sources.find(s => s.id === sourceId);
    if (!source) return [];

    return timeline.events.filter(e => {
      if (e.source === 'getstats' && source.type === 'getstats') return true;
      if (e.source === 'signaling' && source.type === 'signaling') return true;
      if (e.source === 'usernote' && source.type === 'usernote') return true;
      return false;
    });
  }
}

export { TimelineNormalizer as default };
