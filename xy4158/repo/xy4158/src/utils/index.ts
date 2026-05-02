import * as crypto from 'crypto';
import * as path from 'path';
import { FileType, DeviceType } from '../types';

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateFileHash(filePath: string, content: Buffer): string {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}

export function getFileTypeFromExtension(extension: string): FileType {
  const ext = extension.toLowerCase().replace('.', '');
  switch (ext) {
    case 'csv':
      return 'csv';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'tiff':
      return 'image';
    case 'log':
    case 'txt':
      return 'log';
    default:
      return 'unknown';
  }
}

export function getDeviceTypeFromString(type: string): DeviceType {
  const t = type.toLowerCase();
  if (t.includes('camera') || t === 'cam') return 'camera';
  if (t.includes('sensor') || t === 'sens') return 'sensor';
  return 'logger';
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}

export function parseTimestamp(timestamp: string): Date | null {
  const formats: Array<(s: string) => Date | null> = [
    (s) => {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    },
    (s) => {
      const match = s.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})[T_\s]?(\d{2})[:_]?(\d{2})[:_]?(\d{2})?/);
      if (match) {
        const [, year, month, day, hour, minute, second] = match;
        const d = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour || '0'),
          parseInt(minute || '0'),
          parseInt(second || '0')
        );
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    },
    (s) => {
      const match = s.match(/(\d{8})[_-]?(\d{6})?/);
      if (match) {
        const [, dateStr, timeStr] = match;
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        const hour = timeStr ? parseInt(timeStr.substring(0, 2)) : 0;
        const minute = timeStr ? parseInt(timeStr.substring(2, 4)) : 0;
        const second = timeStr ? parseInt(timeStr.substring(4, 6)) : 0;
        const d = new Date(year, month, day, hour, minute, second);
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    }
  ];

  for (const parser of formats) {
    const result = parser(timestamp);
    if (result) return result;
  }
  return null;
}

export function extractDeviceIdFromFilename(filename: string, knownDeviceIds: string[] = []): string | undefined {
  const base = path.basename(filename, path.extname(filename));
  
  for (const deviceId of knownDeviceIds) {
    if (base.toLowerCase().includes(deviceId.toLowerCase())) {
      return deviceId;
    }
  }
  
  const patterns = [
    /(?:DEVICE|DEV|SENSOR|LOGGER)[_-]?(\d+)/i,
    /^([A-Z]{2,}\d+)/i,
    /(\d{4,})/
  ];
  
  for (const pattern of patterns) {
    const match = base.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  
  return undefined;
}

export function extractTimeFromFilename(filename: string): string | undefined {
  const patterns = [
    /(\d{4})[-_]?(\d{2})[-_]?(\d{2})[T_\s]?(\d{2})[:_]?(\d{2})[:_]?(\d{2})?/,
    /(\d{8})[_-]?(\d{6})?/,
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{2})-(\d{2})-(\d{4})/
  ];
  
  const base = path.basename(filename, path.extname(filename));
  
  for (const pattern of patterns) {
    const match = base.match(pattern);
    if (match) {
      const date = parseTimestamp(match[0]);
      if (date) {
        return formatDate(date);
      }
    }
  }
  
  return undefined;
}

export function calculateTimeDrift(deviceTime: Date, actualTime: Date): number {
  return (deviceTime.getTime() - actualTime.getTime()) / (1000 * 60);
}

export function formatDuration(minutes: number): string {
  const absMinutes = Math.abs(minutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function groupBy<T>(array: T[], key: keyof T | ((item: T) => string): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const groupKey = typeof key === 'function' ? key(item) : String(item[key]);
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function sortBy<T>(array: T[], key: keyof T | ((item: T) => any): T[] {
  return [...array].sort((a, b) => {
    const aValue = typeof key === 'function' ? key(a) : a[key];
    const bValue = typeof key === 'function' ? key(b) : b[key];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return aValue.localeCompare(bValue);
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return aValue - bValue;
    }
    if (aValue instanceof Date && bValue instanceof Date) {
      return aValue.getTime() - bValue.getTime();
    }
    return 0;
  });
}
