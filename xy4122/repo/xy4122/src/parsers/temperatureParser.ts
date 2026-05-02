import { parse } from 'csv-parse/sync';
import * as fs from 'fs-extra';
import { parseISO, isValid } from 'date-fns';
import { TemperatureRecord } from '../types';

export interface TemperatureParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
  dateFormat?: string;
  fridgeIdExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  probeIdExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  temperatureExtractor?: (row: Record<string, string>, rowIndex: number) => string;
  timestampExtractor?: (row: Record<string, string>, rowIndex: number) => string;
}

export const DEFAULT_TEMPERATURE_OPTIONS: TemperatureParseOptions = {
  delimiter: ',',
  hasHeader: true,
  fridgeIdExtractor: (row) => row['冰箱ID'] || row['fridgeId'] || row['FridgeID'] || row['fridge_id'] || '',
  probeIdExtractor: (row) => row['探头ID'] || row['probeId'] || row['ProbeID'] || row['probe_id'] || row['SensorID'] || '',
  temperatureExtractor: (row) => row['温度'] || row['temperature'] || row['Temperature'] || row['temp'] || row['Temp'] || '',
  timestampExtractor: (row) => row['时间'] || row['timestamp'] || row['Timestamp'] || row['时间戳'] || row['DateTime'] || '',
};

export class TemperatureParser {
  private options: TemperatureParseOptions;

  constructor(options: Partial<TemperatureParseOptions> = {}) {
    this.options = { ...DEFAULT_TEMPERATURE_OPTIONS, ...options };
  }

  async parseFile(filePath: string): Promise<TemperatureRecord[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parseString(content);
  }

  parseString(content: string): TemperatureRecord[] {
    const { delimiter, hasHeader } = this.options;
    
    const records = parse(content, {
      delimiter: delimiter || ',',
      columns: hasHeader,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    return records.map((row, index) => this.parseRow(row, index)).filter(Boolean) as TemperatureRecord[];
  }

  private parseRow(row: Record<string, string>, rowIndex: number): TemperatureRecord | null {
    const { fridgeIdExtractor, probeIdExtractor, temperatureExtractor, timestampExtractor } = this.options;

    const fridgeId = fridgeIdExtractor ? fridgeIdExtractor(row, rowIndex) : '';
    const probeId = probeIdExtractor ? probeIdExtractor(row, rowIndex) : '';
    const rawTemp = temperatureExtractor ? temperatureExtractor(row, rowIndex) : '';
    const rawTimestamp = timestampExtractor ? timestampExtractor(row, rowIndex) : '';

    if (!rawTimestamp) {
      return null;
    }

    const timestamp = this.parseTimestamp(rawTimestamp);
    if (!timestamp || !isValid(timestamp)) {
      return null;
    }

    const { temperature, isValid } = this.parseTemperature(rawTemp);

    return {
      timestamp,
      fridgeId: fridgeId || 'unknown',
      probeId: probeId || 'default',
      temperature,
      isValid,
      rawValue: rawTemp,
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

    const slashPattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/;
    const slashMatch = trimmed.match(slashPattern);
    if (slashMatch) {
      const [, month, day, year, hour, minute, second] = slashMatch;
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

  private parseTemperature(value: string): { temperature: number; isValid: boolean } {
    const trimmed = value.trim();
    
    if (!trimmed || trimmed === '-' || trimmed === 'N/A' || trimmed === 'NA' || trimmed === 'null') {
      return { temperature: -999, isValid: false };
    }

    const numMatch = trimmed.match(/-?\d+(\.\d+)?/);
    if (!numMatch) {
      return { temperature: -999, isValid: false };
    }

    const temp = parseFloat(numMatch[0]);
    
    if (temp < -100 || temp > 100) {
      return { temperature: temp, isValid: false };
    }

    return { temperature: temp, isValid: true };
  }

  parseFiles(filePaths: string[]): Promise<TemperatureRecord[]> {
    return Promise.all(filePaths.map(path => this.parseFile(path)))
      .then(results => results.flat());
  }
}
