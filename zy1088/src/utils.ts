import * as path from 'path';
import { Config } from './types';

export function formatCurrency(amount: number, config: Config): string {
  const formatted = amount.toFixed(config.currency.decimalPlaces);
  return `${config.currency.symbol}${formatted}`;
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function getBusinessDate(timestamp: string, config: Config): string {
  const date = new Date(timestamp);
  const hour = date.getHours();
  
  const [cutoffHour, cutoffMinute] = config.businessHours.crossDayCutoff.split(':').map(Number);
  
  if (hour < cutoffHour || (hour === cutoffHour && date.getMinutes() < cutoffMinute)) {
    const previousDay = new Date(date);
    previousDay.setDate(previousDay.getDate() - 1);
    return formatDate(previousDay);
  }
  
  return formatDate(date);
}

export function isDateInRange(dateStr: string, startDate?: string, endDate?: string): boolean {
  const date = parseDate(dateStr);
  
  if (startDate) {
    const start = parseDate(startDate);
    start.setHours(0, 0, 0, 0);
    if (date < start) return false;
  }
  
  if (endDate) {
    const end = parseDate(endDate);
    end.setHours(23, 59, 59, 999);
    if (date > end) return false;
  }
  
  return true;
}

export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) {
    return newValue === 0 ? 0 : Infinity;
  }
  return (newValue - oldValue) / Math.abs(oldValue);
}

export function roundTo(value: number, decimalPlaces: number = 2): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(value * factor) / factor;
}

export function ensureDirectoryExists(dirPath: string): void {
  const fs = require('fs');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `${prefix}-${timestamp}-${random}`;
}

export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((result, item) => {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function sumBy<T>(array: T[], valueFn: (item: T) => number): number {
  return array.reduce((sum, item) => sum + valueFn(item), 0);
}

export function averageBy<T>(array: T[], valueFn: (item: T) => number): number {
  if (array.length === 0) return 0;
  return sumBy(array, valueFn) / array.length;
}

export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase().slice(1);
}

export function getFileNameWithoutExtension(filePath: string): string {
  const base = path.basename(filePath);
  const ext = path.extname(base);
  return base.slice(0, -ext.length);
}

export function padLeft(str: string, length: number, char: string = ' '): string {
  return str.padStart(length, char);
}

export function padRight(str: string, length: number, char: string = ' '): string {
  return str.padEnd(length, char);
}

export function truncate(str: string, maxLength: number, ellipsis: string = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - ellipsis.length) + ellipsis;
}
