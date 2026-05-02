import { parse } from 'csv-parse/sync';
import * as fs from 'fs-extra';
import { parseISO, isValid, differenceInMinutes } from 'date-fns';
import { DoorRecord } from '../types';

export interface DoorParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
  fridgeIdExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  eventTypeExtractor?: (row: Record<string, string>, rowIndex: number) => 'open' | 'close' | null;
  timestampExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  durationExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  operatorExtractor?: (row: Record<string, string>, rowIndex: number) => string;
}

export const DEFAULT_DOOR_OPTIONS: DoorParseOptions = {
  delimiter: ',',
  hasHeader: true,
  fridgeIdExtractor: (row) => row['冰箱ID'] || row['fridgeId'] || row['FridgeID'] || row['fridge_id'] || '',
  eventTypeExtractor: (row) => {
    const event = (row['事件'] || row['event'] || row['Event'] || row['类型'] || '').toLowerCase();
    if (event.includes('开') || event.includes('open')) return 'open';
    if (event.includes('关') || event.includes('close')) return 'close';
    return null;
  },
  timestampExtractor: (row) => row['时间'] || row['timestamp'] || row['Timestamp'] || row['时间戳'] || row['DateTime'] || '',
  durationExtractor: (row) => row['持续时间'] || row['duration'] || row['Duration'] || row['时长'] || '',
  operatorExtractor: (row) => row['操作员'] || row['operator'] || row['Operator'] || row['操作人'] || '',
};

export class DoorParser {
  private options: DoorParseOptions;

  constructor(options: Partial<DoorParseOptions> = {}) {
    this.options = { ...DEFAULT_DOOR_OPTIONS, ...options };
  }

  async parseFile(filePath: string): Promise<DoorRecord[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parseString(content);
  }

  parseString(content: string): DoorRecord[] {
    const { delimiter, hasHeader } = this.options;
    
    const records = parse(content, {
      delimiter: delimiter || ',',
      columns: hasHeader,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    const parsedRecords = records
      .map((row, index) => this.parseRow(row, index))
      .filter(Boolean) as DoorRecord[];

    return this.enhanceWithDurations(parsedRecords);
  }

  private parseRow(row: Record<string, string>, rowIndex: number): DoorRecord | null {
    const { fridgeIdExtractor, eventTypeExtractor, timestampExtractor, durationExtractor, operatorExtractor } = this.options;

    const fridgeId = fridgeIdExtractor ? fridgeIdExtractor(row, rowIndex) : '';
    const eventType = eventTypeExtractor ? eventTypeExtractor(row, rowIndex) : null;
    const rawTimestamp = timestampExtractor ? timestampExtractor(row, rowIndex) : '';
    const rawDuration = durationExtractor ? durationExtractor(row, rowIndex) : '';
    const operator = operatorExtractor ? operatorExtractor(row, rowIndex) : '';

    if (!eventType || !rawTimestamp) {
      return null;
    }

    const timestamp = this.parseTimestamp(rawTimestamp);
    if (!timestamp || !isValid(timestamp)) {
      return null;
    }

    const duration = this.parseDuration(rawDuration);

    return {
      timestamp,
      fridgeId: fridgeId || 'unknown',
      eventType,
      duration,
      operator: operator || undefined,
    };
  }

  private parseTimestamp(value: string): Date | null {
    const trimmed = value.trim();
    
    const parsed = parseISO(trimmed);
    if (isValid(parsed)) {
      return parsed;
    }

    const chinesePattern = /(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/;
    const chineseMatch = trimmed.match(chinesePattern);
    if (chineseMatch) {
      const [, year, month, day, hour, minute, second] = chineseMatch;
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        second ? parseInt(second) : 0
      );
    }

    const dashPattern = /(\d{4})-(\d{1,2})-(\d{1,2})\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/;
    const dashMatch = trimmed.match(dashPattern);
    if (dashMatch) {
      const [, year, month, day, hour, minute, second] = dashMatch;
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        second ? parseInt(second) : 0
      );
    }

    return null;
  }

  private parseDuration(value: string): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const minutesMatch = trimmed.match(/(\d+(\.\d+)?)\s*(分钟|分|m|min)/i);
    if (minutesMatch) {
      return parseFloat(minutesMatch[1]);
    }

    const secondsMatch = trimmed.match(/(\d+(\.\d+)?)\s*(秒|s|sec)/i);
    if (secondsMatch) {
      return parseFloat(secondsMatch[1]) / 60;
    }

    const hoursMatch = trimmed.match(/(\d+(\.\d+)?)\s*(小时|时|h|hr)/i);
    if (hoursMatch) {
      return parseFloat(hoursMatch[1]) * 60;
    }

    const colonMatch = trimmed.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (colonMatch) {
      const hours = parseInt(colonMatch[1]);
      const minutes = parseInt(colonMatch[2]);
      const seconds = colonMatch[3] ? parseInt(colonMatch[3]) : 0;
      return hours * 60 + minutes + seconds / 60;
    }

    const numMatch = trimmed.match(/^\d+(\.\d+)?$/);
    if (numMatch) {
      return parseFloat(numMatch[0]);
    }

    return undefined;
  }

  private enhanceWithDurations(records: DoorRecord[]): DoorRecord[] {
    const sorted = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const byFridge = new Map<string, DoorRecord[]>();
    for (const record of sorted) {
      if (!byFridge.has(record.fridgeId)) {
        byFridge.set(record.fridgeId, []);
      }
      byFridge.get(record.fridgeId)!.push(record);
    }

    const enhanced: DoorRecord[] = [];
    
    for (const [, fridgeRecords] of byFridge) {
      let openEvent: DoorRecord | null = null;
      
      for (const record of fridgeRecords) {
        if (record.eventType === 'open') {
          openEvent = record;
          enhanced.push(record);
        } else if (record.eventType === 'close' && openEvent) {
          const calculatedDuration = differenceInMinutes(record.timestamp, openEvent.timestamp);
          
          if (record.duration === undefined) {
            enhanced.push({ ...record, duration: calculatedDuration });
          } else {
            enhanced.push(record);
          }
          
          if (openEvent.duration === undefined) {
            openEvent.duration = calculatedDuration;
          }
          
          openEvent = null;
        } else {
          enhanced.push(record);
        }
      }
    }

    return enhanced.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  parseFiles(filePaths: string[]): Promise<DoorRecord[]> {
    return Promise.all(filePaths.map(path => this.parseFile(path)))
      .then(results => results.flat());
  }
}
