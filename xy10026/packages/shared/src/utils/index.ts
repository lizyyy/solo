import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

export function generateId(): string {
  return uuidv4();
}

export function generateTraceId(): string {
  return `trace-${uuidv4().replace(/-/g, '')}`;
}

export function generateIdempotencyKey(...args: string[]): string {
  const hash = createHash('sha256');
  hash.update(args.join('-'));
  return hash.digest('hex');
}

export function calculatePartitionKey(roomId: string, userId?: string): string {
  const base = roomId;
  if (userId) {
    return `${base}-${userId}`;
  }
  return base;
}

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    initialDelay: number;
    maxDelay?: number;
    shouldRetry?: (error: Error) => boolean;
  }
): Promise<T> {
  const { maxRetries, initialDelay, maxDelay, shouldRetry } = options;
  
  const doAttempt = async (attemptNum: number): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (attemptNum >= maxRetries) {
        throw error;
      }
      
      if (shouldRetry && !shouldRetry(error as Error)) {
        throw error;
      }
      
      const delayMs = Math.min(
        initialDelay * Math.pow(2, attemptNum),
        maxDelay || Infinity
      );
      
      await delay(delayMs);
      return doAttempt(attemptNum + 1);
    }
  };
  
  return doAttempt(0);
}

export function isRetryableError(error: Error): boolean {
  const retryableErrors = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ESOCKETTIMEDOUT',
    'ServiceUnavailable',
    'InternalServerError',
    'TemporaryFailure'
  ];
  
  return retryableErrors.some((code) => 
    error.message.includes(code) || 
    (error as Error & { code?: string }).code === code
  );
}

export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}
