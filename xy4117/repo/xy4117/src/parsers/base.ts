import { LogSource, ParseOptions, TimestampedEvent } from '../types';
import { generateId, getFileName } from '../utils';

export abstract class BaseParser {
  protected sourceId: string;
  protected sourceName: string;
  protected filePath?: string;
  protected startTimeOffset: number;

  constructor(options: ParseOptions = {}) {
    this.sourceId = generateId();
    this.sourceName = options.sourceName || 'Unknown Source';
    this.startTimeOffset = options.startTimeOffset || 0;
  }

  abstract parse(content: string): Promise<{
    events: TimestampedEvent[];
    source: LogSource;
  }>;

  protected setFilePath(filePath: string): void {
    this.filePath = filePath;
    if (this.sourceName === 'Unknown Source') {
      this.sourceName = getFileName(filePath);
    }
  }

  protected adjustTimestamp(timestamp: number): number {
    return timestamp + this.startTimeOffset;
  }

  protected getTimeRange(events: TimestampedEvent[]): { start: number; end: number } {
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

  protected createLogSource(startTime: number, endTime: number): LogSource {
    return {
      id: this.sourceId,
      name: this.sourceName,
      type: this.getSourceType(),
      filePath: this.filePath,
      startTime,
      endTime
    };
  }

  protected abstract getSourceType(): 'getstats' | 'signaling' | 'usernote';
}
