import Papa from 'papaparse';
import * as yaml from 'yaml';
import dayjs from 'dayjs';
import type {
  SensorReading,
  FeedingEvent,
  AeratorLog,
  MortalityRecord,
  ParsedData,
} from '../../types';

export class DataParser {
  static parseSensorCSV(csvContent: string): SensorReading[] {
    const result = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
    return result.data.map((row: any) => ({
      pondId: String(row.pondId || row.pond_id || row.PondID || ''),
      timestamp: this.parseTimestamp(row.timestamp || row.time || row.Time || ''),
      dissolvedOxygen: parseFloat(row.dissolvedOxygen || row.do || row.DO || row['DO (mg/L)'] || '0'),
      temperature: parseFloat(row.temperature || row.temp || row.Temp || row['Temp (°C)'] || '0'),
      pH: row.pH ? parseFloat(row.pH) : undefined,
    })).filter((r: SensorReading) => r.pondId !== '' && r.timestamp.isValid());
  }

  static parseFeedingJSONL(jsonlContent: string): FeedingEvent[] {
    const lines = jsonlContent.trim().split('\n').filter(line => line.trim());
    return lines.map(line => {
      try {
        const obj = JSON.parse(line);
        return {
          pondId: String(obj.pondId || obj.pond_id || obj.PondID || ''),
          timestamp: this.parseTimestamp(obj.timestamp || obj.time || ''),
          feedType: String(obj.feedType || obj.feed_type || obj.FeedType || ''),
          feedAmount: parseFloat(obj.feedAmount || obj.feed_amount || obj.amount || '0'),
          feedingDuration: parseFloat(obj.feedingDuration || obj.duration || obj.feeding_duration || '0'),
        };
      } catch {
        return null;
      }
    }).filter((e): e is FeedingEvent => e !== null && e.pondId !== '' && e.timestamp.isValid());
  }

  static parseAeratorYAML(yamlContent: string): AeratorLog[] {
    try {
      const parsed = yaml.parse(yamlContent);
      if (!parsed) return [];
      
      const logs: AeratorLog[] = [];
      
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          const entries = item.logs || item.records || [item];
          entries.forEach((entry: any) => {
            const action = (entry.action || entry.status || '').toLowerCase();
            if (action === 'start' || action === 'stop') {
              logs.push({
                pondId: String(item.pondId || item.pond_id || entry.pondId || entry.pond_id || ''),
                aeratorId: String(item.aeratorId || item.aerator_id || entry.aeratorId || entry.aerator_id || ''),
                timestamp: this.parseTimestamp(entry.timestamp || entry.time || ''),
                action,
                power: parseFloat(entry.power || item.power || '0'),
              });
            }
          });
        });
      } else if (typeof parsed === 'object') {
        const entries = parsed.logs || parsed.records || [parsed];
        entries.forEach((entry: any) => {
          const action = (entry.action || entry.status || '').toLowerCase();
          if (action === 'start' || action === 'stop') {
            logs.push({
              pondId: String(parsed.pondId || parsed.pond_id || entry.pondId || entry.pond_id || ''),
              aeratorId: String(parsed.aeratorId || parsed.aerator_id || entry.aeratorId || entry.aerator_id || ''),
              timestamp: this.parseTimestamp(entry.timestamp || entry.time || ''),
              action,
              power: parseFloat(entry.power || parsed.power || '0'),
            });
          }
        });
      }
      
      return logs.filter(l => l.pondId !== '' && l.timestamp.isValid());
    } catch {
      return [];
    }
  }

  static parseMortalityCSV(csvContent: string): MortalityRecord[] {
    const result = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
    return result.data.map((row: any) => ({
      pondId: String(row.pondId || row.pond_id || row.PondID || ''),
      timestamp: this.parseTimestamp(row.timestamp || row.time || row.Time || row.date || row.Date || ''),
      count: parseInt(row.count || row.Count || row.deadCount || row.dead_count || '0', 10),
      cause: row.cause || row.Cause || row.reason || undefined,
      notes: row.notes || row.Notes || row.remark || undefined,
    })).filter((r: MortalityRecord) => r.pondId !== '' && r.timestamp.isValid());
  }

  static parseAll(
    sensorCSV: string,
    feedingJSONL: string,
    aeratorYAML: string,
    mortalityCSV: string
  ): ParsedData {
    return {
      sensorReadings: this.parseSensorCSV(sensorCSV),
      feedingEvents: this.parseFeedingJSONL(feedingJSONL),
      aeratorLogs: this.parseAeratorYAML(aeratorYAML),
      mortalityRecords: this.parseMortalityCSV(mortalityCSV),
    };
  }

  private static parseTimestamp(value: string): dayjs.Dayjs {
    if (!value) return dayjs('');
    
    const formats = [
      'YYYY-MM-DD HH:mm:ss',
      'YYYY-MM-DD HH:mm',
      'YYYY-MM-DD',
      'YYYY/MM/DD HH:mm:ss',
      'YYYY/MM/DD HH:mm',
      'YYYY/MM/DD',
      'DD/MM/YYYY HH:mm:ss',
      'DD/MM/YYYY HH:mm',
      'DD/MM/YYYY',
    ];
    
    for (const format of formats) {
      const parsed = dayjs(value, format);
      if (parsed.isValid()) return parsed;
    }
    
    return dayjs(value);
  }
}

export default DataParser;
