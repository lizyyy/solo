import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export const generateId = (): string => uuidv4();

export const now = (): number => Date.now();

export const deepDiff = (obj1: Record<string, any>, obj2: Record<string, any>): Record<string, any> => {
  const diff: Record<string, any> = {};
  const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
  
  for (const key of allKeys) {
    if (JSON.stringify(obj1?.[key]) !== JSON.stringify(obj2?.[key])) {
      diff[key] = {
        before: obj1?.[key],
        after: obj2?.[key],
      };
    }
  }
  return diff;
};

export const calculateNextRetry = (retryCount: number, baseDelay: number = 1000): number => {
  const delay = baseDelay * Math.pow(2, retryCount);
  return now() + Math.min(delay, 3600000);
};

export const hashContent = (content: string): string => {
  return crypto.createHash('sha256').update(content).digest('hex');
};

export const classifyError = (error: Error): string => {
  const message = error.message.toLowerCase();
  if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
    return 'network_error';
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return 'validation_error';
  }
  if (message.includes('permission') || message.includes('auth') || message.includes('forbidden')) {
    return 'permission_error';
  }
  if (message.includes('duplicate') || message.includes('unique') || message.includes('already')) {
    return 'duplicate_error';
  }
  if (message.includes('not found') || message.includes('missing')) {
    return 'not_found_error';
  }
  return 'unknown_error';
};

export const retryBackoff = (attempt: number): number => {
  const delays = [1000, 5000, 15000, 30000, 60000];
  return delays[Math.min(attempt, delays.length - 1)];
};

export const safeJsonParse = <T = any>(str: string | null | undefined, defaultValue: T): T => {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
};

export const safeJsonStringify = (obj: any): string => {
  try {
    return JSON.stringify(obj);
  } catch {
    return JSON.stringify({ error: 'serialization_failed' });
  }
};
