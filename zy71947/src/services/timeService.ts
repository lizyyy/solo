import type { TimePoint, TimeFormat } from '../types';

export class TimeService {
  private missionStartTime: Date;

  constructor(missionStartTime: Date) {
    this.missionStartTime = missionStartTime;
  }

  static createTimePoint(relativeSeconds: number, missionStartTime: Date): TimePoint {
    const utc = new Date(missionStartTime.getTime() + relativeSeconds * 1000);
    const beijing = new Date(utc.getTime() + 8 * 3600 * 1000);
    return {
      utc,
      beijing,
      relativeSeconds,
    };
  }

  static fromUtc(utcTime: Date, missionStartTime: Date): TimePoint {
    const relativeSeconds = (utcTime.getTime() - missionStartTime.getTime()) / 1000;
    const beijing = new Date(utcTime.getTime() + 8 * 3600 * 1000);
    return {
      utc: utcTime,
      beijing,
      relativeSeconds,
    };
  }

  static fromBeijing(beijingTime: Date, missionStartTime: Date): TimePoint {
    const utc = new Date(beijingTime.getTime() - 8 * 3600 * 1000);
    const relativeSeconds = (utc.getTime() - missionStartTime.getTime()) / 1000;
    return {
      utc,
      beijing: beijingTime,
      relativeSeconds,
    };
  }

  static formatTime(date: Date, format: TimeFormat): string {
    switch (format) {
      case 'UTC':
        return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      case 'BEIJING':
        return date.toISOString().replace('T', ' ').substring(0, 19) + ' BT';
      case 'RELATIVE':
        return '';
    }
  }

  static formatRelative(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const sign = seconds < 0 ? '-' : '+';
    return `${sign}${String(Math.abs(hours)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  static formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}秒`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${minutes}分${secs}秒` : `${minutes}分钟`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
    }
  }

  getTimePoint(relativeSeconds: number): TimePoint {
    return TimeService.createTimePoint(relativeSeconds, this.missionStartTime);
  }

  addSeconds(timePoint: TimePoint, seconds: number): TimePoint {
    return TimeService.createTimePoint(timePoint.relativeSeconds + seconds, this.missionStartTime);
  }

  isOverlap(start1: TimePoint, end1: TimePoint, start2: TimePoint, end2: TimePoint): boolean {
    return start1.relativeSeconds < end2.relativeSeconds && 
           end1.relativeSeconds > start2.relativeSeconds;
  }

  getOverlapDuration(start1: TimePoint, end1: TimePoint, start2: TimePoint, end2: TimePoint): number {
    const overlapStart = Math.max(start1.relativeSeconds, start2.relativeSeconds);
    const overlapEnd = Math.min(end1.relativeSeconds, end2.relativeSeconds);
    return Math.max(0, overlapEnd - overlapStart);
  }

  static formatByTimeFormat(timePoint: TimePoint, format: TimeFormat): string {
    switch (format) {
      case 'UTC':
        return timePoint.utc.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      case 'BEIJING':
        return timePoint.beijing.toISOString().replace('T', ' ').substring(0, 19) + ' BT';
      case 'RELATIVE':
        return TimeService.formatRelative(timePoint.relativeSeconds);
    }
  }

  static getTimeValue(timePoint: TimePoint, format: TimeFormat): number {
    switch (format) {
      case 'UTC':
        return timePoint.utc.getTime();
      case 'BEIJING':
        return timePoint.beijing.getTime();
      case 'RELATIVE':
        return timePoint.relativeSeconds;
    }
  }
}

export const formatTimeString = (date: Date): string => {
  return date.toISOString().replace('T', ' ').substring(0, 19);
};

export const parseTimeString = (str: string): Date => {
  return new Date(str.replace(' ', 'T') + 'Z');
};
