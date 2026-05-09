export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 500,
  backoffMultiplier: 2,
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      const shouldRetry = attempt < opts.maxAttempts && 
        (!opts.shouldRetry || opts.shouldRetry(error, attempt));
      
      if (!shouldRetry) {
        throw error;
      }

      const delayMs = opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1);
      await delay(delayMs);
    }
  }

  throw lastError;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface RetryTracker {
  attempt: number;
  maxAttempts: number;
  delays: number[];
}

export function createRetryTracker(options: Partial<RetryOptions> = {}): RetryTracker {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  return {
    attempt: 0,
    maxAttempts: opts.maxAttempts,
    delays: [],
  };
}
