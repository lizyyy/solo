import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

export const generateId = (): string => uuidv4();

export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toISOString();
};

export const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(2);
  return `${hours}h ${minutes}m ${seconds}s`;
};

export const parseTimestamp = (value: string | number): number => {
  if (typeof value === 'number') {
    return value;
  }
  
  const parsed = Date.parse(value);
  if (!isNaN(parsed)) {
    return parsed;
  }
  
  const now = Date.now();
  const relativeMatch = value.match(/^(\d+)\s*(s|sec|seconds?|m|min|minutes?|h|hr|hours?)\s*(ago)?$/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    let multiplier = 1000;
    
    if (unit.startsWith('m')) {
      multiplier = 60 * 1000;
    } else if (unit.startsWith('h')) {
      multiplier = 3600 * 1000;
    }
    
    return now - amount * multiplier;
  }
  
  const timeOnlyMatch = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnlyMatch) {
    const today = new Date();
    today.setHours(
      parseInt(timeOnlyMatch[1], 10),
      parseInt(timeOnlyMatch[2], 10),
      timeOnlyMatch[3] ? parseInt(timeOnlyMatch[3], 10) : 0,
      0
    );
    return today.getTime();
  }
  
  throw new Error(`无法解析时间戳: ${value}`);
};

export const ensureDirectoryExists = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

export const getFileExtension = (filePath: string): string => {
  return path.extname(filePath).toLowerCase().slice(1);
};

export const getFileName = (filePath: string): string => {
  return path.basename(filePath, path.extname(filePath));
};

export const calculatePercentage = (part: number, total: number): number => {
  if (total === 0) return 0;
  return (part / total) * 100;
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const mean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

export const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(mean(squareDiffs));
};

export const groupBy = <T, K extends string | number | symbol>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> => {
  const result = {} as Record<K, T[]>;
  for (const item of array) {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
};

export const sortByKey = <T>(array: T[], keyFn: (item: T) => number | string): T[] => {
  return [...array].sort((a, b) => {
    const keyA = keyFn(a);
    const keyB = keyFn(b);
    if (typeof keyA === 'number' && typeof keyB === 'number') {
      return keyA - keyB;
    }
    return String(keyA).localeCompare(String(keyB));
  });
};

export const chunk = <T>(array: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const safeJsonParse = (str: string, fallback?: unknown): unknown => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

export const getNowTimestamp = (): number => Date.now();
