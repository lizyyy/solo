import { DateTime, Settings } from 'luxon';
import { Route, ManifestEntry, ImageExif, Waypoint, Issue, PrecheckOptions } from '../types';
import { randomUUID } from 'crypto';

Settings.defaultZone = 'UTC';

export class AnomalyChecker {
  private options: PrecheckOptions;

  constructor(options: PrecheckOptions) {
    this.options = options;
  }

  checkTimeAnomalies(
    manifest: ManifestEntry[],
    exifMap: Map<string, ImageExif>
  ): Issue[] {
    const issues: Issue[] = [];
    const toleranceMinutes = this.options.timeToleranceMinutes || 30;
    
    const sortedEntries = [...manifest].sort((a, b) => {
      const timeA = this.parseTimestamp(a.timestamp);
      const timeB = this.parseTimestamp(b.timestamp);
      return timeA.toMillis() - timeB.toMillis();
    });
    
    for (let i = 1; i < sortedEntries.length; i++) {
      const prev = sortedEntries[i - 1];
      const curr = sortedEntries[i];
      
      const prevTime = this.parseTimestamp(prev.timestamp);
      const currTime = this.parseTimestamp(curr.timestamp);
      
      const diffMinutes = currTime.diff(prevTime, 'minutes').minutes;
      
      if (diffMinutes < -toleranceMinutes) {
        issues.push({
          id: randomUUID(),
          category: 'time_anomaly',
          severity: 'major',
          message: `时间倒流: ${prev.filename} (${prev.timestamp}) -> ${curr.filename} (${curr.timestamp})`,
          details: {
            prevFile: prev.filename,
            currFile: curr.filename,
            prevTime: prev.timestamp,
            currTime: curr.timestamp,
            diffMinutes,
          },
          relatedFiles: [prev.filename, curr.filename],
          timestamp: new Date().toISOString(),
        });
      }
      
      if (diffMinutes > toleranceMinutes * 2) {
        issues.push({
          id: randomUUID(),
          category: 'time_anomaly',
          severity: 'minor',
          message: `时间间隔异常: 两张照片间隔 ${Math.round(diffMinutes)} 分钟`,
          details: {
            prevFile: prev.filename,
            currFile: curr.filename,
            diffMinutes: Math.round(diffMinutes),
            threshold: toleranceMinutes * 2,
          },
          relatedFiles: [prev.filename, curr.filename],
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    for (const entry of manifest) {
      const exif = exifMap.get(entry.filename);
      if (exif?.timestamp) {
        const manifestTime = this.parseTimestamp(entry.timestamp);
        const exifTime = this.parseTimestamp(exif.timestamp);
        
        const diffSeconds = Math.abs(manifestTime.diff(exifTime, 'seconds').seconds);
        
        if (diffSeconds > 60) {
          issues.push({
            id: randomUUID(),
            category: 'time_anomaly',
            severity: 'minor',
            message: `${entry.filename} 清单时间与 EXIF 时间不一致`,
            details: {
              filename: entry.filename,
              manifestTime: entry.timestamp,
              exifTime: exif.timestamp,
              diffSeconds: Math.round(diffSeconds),
            },
            relatedFiles: [entry.filename],
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    
    return issues;
  }

  checkCoordinateAnomalies(
    manifest: ManifestEntry[],
    route: Route,
    exifMap: Map<string, ImageExif>
  ): Issue[] {
    const issues: Issue[] = [];
    const tolerance = this.options.coordinateTolerance || 0.001;
    
    const waypointMap = new Map<string, Waypoint>();
    for (const wp of route.waypoints) {
      waypointMap.set(wp.id, wp);
    }
    
    for (const entry of manifest) {
      const waypoint = waypointMap.get(entry.waypointId);
      
      if (waypoint) {
        const distance = this.calculateDistance(
          entry.latitude,
          entry.longitude,
          waypoint.latitude,
          waypoint.longitude
        );
        
        if (distance > tolerance) {
          issues.push({
            id: randomUUID(),
            category: 'coordinate_anomaly',
            severity: 'major',
            message: `${entry.filename} 坐标与航点计划偏差过大`,
            details: {
              filename: entry.filename,
              waypointId: entry.waypointId,
              actualLat: entry.latitude,
              actualLon: entry.longitude,
              expectedLat: waypoint.latitude,
              expectedLon: waypoint.longitude,
              distanceDegrees: distance,
              tolerance,
            },
            relatedFiles: [entry.filename],
            relatedWaypoints: [entry.waypointId],
            timestamp: new Date().toISOString(),
          });
        }
      }
      
      const exif = exifMap.get(entry.filename);
      if (exif?.latitude !== undefined && exif?.longitude !== undefined) {
        const distance = this.calculateDistance(
          entry.latitude,
          entry.longitude,
          exif.latitude,
          exif.longitude
        );
        
        if (distance > tolerance) {
          issues.push({
            id: randomUUID(),
            category: 'coordinate_anomaly',
            severity: 'minor',
            message: `${entry.filename} 清单坐标与 EXIF 坐标不一致`,
            details: {
              filename: entry.filename,
              manifestLat: entry.latitude,
              manifestLon: entry.longitude,
              exifLat: exif.latitude,
              exifLon: exif.longitude,
              distanceDegrees: distance,
            },
            relatedFiles: [entry.filename],
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    
    return issues;
  }

  checkTimezoneConsistency(
    manifest: ManifestEntry[],
    exifMap: Map<string, ImageExif>
  ): Issue[] {
    const issues: Issue[] = [];
    const timezones = new Set<string>();
    const timezoneMap = new Map<string, string[]>();
    
    for (const entry of manifest) {
      const tz = this.detectTimezone(entry.timestamp);
      timezones.add(tz);
      
      const files = timezoneMap.get(tz) || [];
      files.push(entry.filename);
      timezoneMap.set(tz, files);
    }
    
    for (const [filename, exif] of exifMap.entries()) {
      if (exif.timezone) {
        timezones.add(exif.timezone);
      }
    }
    
    if (timezones.size > 1) {
      issues.push({
        id: randomUUID(),
        category: 'time_anomaly',
        severity: 'warning' as never,
        message: `检测到多个时区: ${Array.from(timezones).join(', ')}`,
        details: {
          timezones: Array.from(timezones),
          breakdown: Object.fromEntries(timezoneMap.entries()),
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    return issues;
  }

  private parseTimestamp(timestamp: string): DateTime {
    const formats = [
      'yyyy-MM-dd HH:mm:ss',
      'yyyy-MM-ddTHH:mm:ss',
      'yyyy-MM-ddTHH:mm:ssZ',
      'yyyy:MM:dd HH:mm:ss',
      'yyyy/MM/dd HH:mm:ss',
    ];
    
    for (const format of formats) {
      const dt = DateTime.fromFormat(timestamp, format, {
        zone: this.options.timezone || 'local',
      });
      if (dt.isValid) {
        return dt;
      }
    }
    
    const dt = DateTime.fromISO(timestamp);
    if (dt.isValid) {
      return dt;
    }
    
    const jsDate = new Date(timestamp);
    if (!isNaN(jsDate.getTime())) {
      return DateTime.fromJSDate(jsDate);
    }
    
    return DateTime.now();
  }

  private detectTimezone(timestamp: string): string {
    if (timestamp.includes('Z')) {
      return 'UTC';
    }
    if (timestamp.includes('+') || timestamp.includes('-')) {
      const match = timestamp.match(/[+-]\d{2}:?\d{2}$/);
      if (match) {
        return `UTC${match[0].replace(':', '')}`;
      }
    }
    return this.options.timezone || 'local';
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    return Math.sqrt(
      Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2)
    );
  }
}
