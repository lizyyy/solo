import { TimelineEntry, ScannedFile, DeviceConfig, CalibrationPoint } from '../types';
import { parseTimestamp, formatDate, calculateTimeDrift, sortBy, generateId } from '../utils';
import * as csvParser from 'csv-parser';
import * as fs from 'fs';
import { Readable } from 'stream';

export interface TimelineCalibratorOptions {
  devices: DeviceConfig[];
}

export interface CsvRecord {
  timestamp: string;
  [key: string]: any;
}

export class TimelineCalibrator {
  private options: TimelineCalibratorOptions;
  private deviceCalibration: Map<string, number> = new Map();

  constructor(options: TimelineCalibratorOptions) {
    this.options = options;
    this.initializeCalibration();
  }

  private initializeCalibration(): void {
    for (const device of this.options.devices) {
      if (device.calibrationPoints && device.calibrationPoints.length > 0) {
        const offset = this.calculateOffsetFromPoints(device.calibrationPoints);
        this.deviceCalibration.set(device.id, offset);
      } else if (device.timeOffset !== undefined) {
        this.deviceCalibration.set(device.id, device.timeOffset);
      } else {
        this.deviceCalibration.set(device.id, 0);
      }
    }
  }

  private calculateOffsetFromPoints(points: CalibrationPoint[]): number {
    if (points.length === 0) return 0;
    
    const offsets = points.map(point => {
      const deviceTime = parseTimestamp(point.deviceTime);
      const actualTime = parseTimestamp(point.actualTime);
      
      if (!deviceTime || !actualTime) return 0;
      return calculateTimeDrift(deviceTime, actualTime);
    });
    
    const sum = offsets.reduce((a, b) => a + b, 0);
    return sum / offsets.length;
  }

  async buildTimeline(files: ScannedFile[]): Promise<TimelineEntry[]> {
    const timeline: TimelineEntry[] = [];

    for (const file of files) {
      if (!file.isValid) continue;
      
      const entry = await this.processFile(file);
      if (entry) {
        timeline.push(entry);
      }
    }

    return sortBy(timeline, e => parseTimestamp(e.startTime)?.getTime() || 0);
  }

  private async processFile(file: ScannedFile): Promise<TimelineEntry | null> {
    const deviceId = file.deviceId;
    if (!deviceId) return null;

    let startTime: Date | null = null;
    let endTime: Date | null = null;
    let recordCount = 0;

    if (file.fileType === 'csv') {
      const csvInfo = await this.analyzeCsvFile(file.path);
      if (csvInfo) {
        startTime = csvInfo.startTime;
        endTime = csvInfo.endTime;
        recordCount = csvInfo.recordCount;
      }
    }

    if (!startTime && file.detectedTime) {
      startTime = parseTimestamp(file.detectedTime);
      if (startTime) {
        endTime = startTime;
        recordCount = 1;
      }
    }

    if (!startTime) {
      const lastModified = parseTimestamp(file.lastModified);
      if (lastModified) {
        startTime = lastModified;
        endTime = lastModified;
        recordCount = 1;
      }
    }

    if (!startTime || !endTime) return null;

    const offset = this.deviceCalibration.get(deviceId) || 0;
    const normalizedStartTime = new Date(startTime.getTime() + offset * 60 * 1000);
    const timeDrift = this.calculateDriftForFile(deviceId, startTime);

    return {
      deviceId,
      fileId: file.id,
      fileName: file.name,
      startTime: formatDate(startTime),
      endTime: formatDate(endTime),
      recordCount,
      normalizedTime: formatDate(normalizedStartTime),
      timeDriftMinutes: timeDrift
    };
  }

  private async analyzeCsvFile(filePath: string): Promise<{ startTime: Date; endTime: Date; recordCount: number } | null> {
    return new Promise((resolve, reject) => {
      const records: CsvRecord[] = [];
      
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data: any) => {
          records.push(data);
        })
        .on('end', () => {
          if (records.length === 0) {
            resolve(null);
            return;
          }

          const timestamps: Date[] = [];
          const timestampFields = ['timestamp', 'time', 'datetime', 'date', 'logtime', 'record_time'];
          
          for (const record of records) {
            let ts: Date | null = null;
            
            for (const field of timestampFields) {
              if (record[field]) {
                ts = parseTimestamp(String(record[field]));
                if (ts) break;
              }
            }
            
            if (ts) {
              timestamps.push(ts);
            }
          }

          if (timestamps.length === 0) {
            resolve(null);
            return;
          }

          const sortedTimes = timestamps.sort((a, b) => a.getTime() - b.getTime());
          
          resolve({
            startTime: sortedTimes[0],
            endTime: sortedTimes[sortedTimes.length - 1],
            recordCount: records.length
          });
        })
        .on('error', reject);
    });
  }

  private calculateDriftForFile(deviceId: string, deviceTime: Date): number {
    const offset = this.deviceCalibration.get(deviceId) || 0;
    return -offset;
  }

  setCalibrationPoint(deviceId: string, deviceTime: string, actualTime: string): void {
    const deviceDate = parseTimestamp(deviceTime);
    const actualDate = parseTimestamp(actualTime);
    
    if (!deviceDate || !actualDate) return;
    
    const drift = calculateTimeDrift(deviceDate, actualDate);
    this.deviceCalibration.set(deviceId, -drift);
  }

  getCalibrationOffset(deviceId: string): number {
    return this.deviceCalibration.get(deviceId) || 0;
  }

  detectTimeGaps(timeline: TimelineEntry[], expectedIntervalMinutes: number): Array<{ from: string; to: string; durationMinutes: number }> {
    const gaps: Array<{ from: string; to: string; durationMinutes: number }> = [];
    
    for (let i = 1; i < timeline.length; i++) {
      const prev = timeline[i - 1];
      const curr = timeline[i];
      
      const prevEnd = parseTimestamp(prev.endTime);
      const currStart = parseTimestamp(curr.startTime);
      
      if (!prevEnd || !currStart) continue;
      
      const gapMinutes = (currStart.getTime() - prevEnd.getTime()) / (1000 * 60);
      
      if (gapMinutes > expectedIntervalMinutes * 2) {
        gaps.push({
          from: prev.endTime,
          to: curr.startTime,
          durationMinutes: Math.round(gapMinutes)
        });
      }
    }
    
    return gaps;
  }

  getTimelineByDevice(timeline: TimelineEntry[]): Record<string, TimelineEntry[]> {
    const result: Record<string, TimelineEntry[]> = {};
    
    for (const entry of timeline) {
      if (!result[entry.deviceId]) {
        result[entry.deviceId] = [];
      }
      result[entry.deviceId].push(entry);
    }
    
    return result;
  }

  detectCrossDeviceConflicts(timeline: TimelineEntry[]): Array<{ devices: string[]; time: string; description: string }> {
    const conflicts: Array<{ devices: string[]; time: string; description: string }> = [];
    
    const byTime = new Map<string, string[]>();
    
    for (const entry of timeline) {
      const timeKey = entry.normalizedTime.substring(0, 16);
      if (!byTime.has(timeKey)) {
        byTime.set(timeKey, []);
      }
      const devices = byTime.get(timeKey)!;
      if (!devices.includes(entry.deviceId)) {
        devices.push(entry.deviceId);
      }
    }
    
    for (const [time, devices] of byTime) {
      if (devices.length > 1) {
        conflicts.push({
          devices,
          time,
          description: `多个设备在同一时间点有记录: ${devices.join(', ')}`
        });
      }
    }
    
    return conflicts;
  }
}
