import { RetryConfig } from '../types';
import { DEFAULT_RETRY_CONFIG } from '../config';
import { logger } from '../utils/logger';

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error | null;
  attempts: number;
  totalDelay: number;
}

export interface RetryContext {
  operation: string;
  attempt: number;
  maxRetries: number;
  delay: number;
  lastError?: Error;
}

export type OnRetryCallback = (context: RetryContext) => void;
export type ShouldRetryCallback = (error: Error, attempt: number) => boolean;
export type BackoffStrategy = (attempt: number, baseDelay: number) => number;

export const backoffStrategies = {
  exponential: (attempt: number, baseDelay: number): number => {
    return Math.min(baseDelay * Math.pow(2, attempt), 30000);
  },
  
  linear: (attempt: number, baseDelay: number): number => {
    return baseDelay * (attempt + 1);
  },
  
  constant: (attempt: number, baseDelay: number): number => {
    return baseDelay;
  },
  
  fibonacci: (attempt: number, baseDelay: number): number => {
    const fib = (n: number): number => {
      if (n <= 1) return n;
      return fib(n - 1) + fib(n - 2);
    };
    return baseDelay * fib(attempt + 1);
  }
};

export class RetryStrategy {
  private config: RetryConfig;
  private backoffStrategy: BackoffStrategy;
  private onRetry?: OnRetryCallback;
  private shouldRetry?: ShouldRetryCallback;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    this.backoffStrategy = backoffStrategies.exponential;
  }

  setBackoffStrategy(strategy: BackoffStrategy): void {
    this.backoffStrategy = strategy;
  }

  setOnRetry(callback: OnRetryCallback): void {
    this.onRetry = callback;
  }

  setShouldRetry(callback: ShouldRetryCallback): void {
    this.shouldRetry = callback;
  }

  private calculateDelay(attempt: number): number {
    const delay = this.backoffStrategy(attempt, this.config.initialDelay);
    return Math.min(delay, this.config.maxDelay);
  }

  private isRetryableError(error: Error): boolean {
    const code = (error as NodeJS.ErrnoException).code;
    if (code && this.config.retryableErrors.has(code)) {
      return true;
    }
    return false;
  }

  async execute<T>(
    operation: () => Promise<T>,
    options?: {
      maxRetries?: number;
      operationName?: string;
      context?: Record<string, unknown>;
    }
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? this.config.maxRetries;
    const operationName = options?.operationName ?? 'unknown';
    let lastError: Error | null = null;
    let totalDelay = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 0) {
          logger.info(`Operation ${operationName} succeeded after ${attempt + 1} attempts`, {
            operation: operationName,
            attempts: attempt + 1,
            totalDelay,
            ...options?.context
          });
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        const isLastAttempt = attempt === maxRetries;

        const canRetry = !isLastAttempt && (
          (this.shouldRetry && this.shouldRetry(lastError, attempt)) ||
          this.isRetryableError(lastError)
        );

        if (!canRetry) {
          logger.error(`Operation ${operationName} failed after ${attempt + 1} attempts`, lastError, {
            operation: operationName,
            attempts: attempt + 1,
            isLastAttempt,
            ...options?.context
          });
          throw lastError;
        }

        const delay = this.calculateDelay(attempt);
        totalDelay += delay;

        const context: RetryContext = {
          operation: operationName,
          attempt: attempt + 1,
          maxRetries,
          delay,
          lastError
        };

        if (this.onRetry) {
          this.onRetry(context);
        }

        logger.warn(`Retrying operation ${operationName}`, {
          operation: operationName,
          attempt: attempt + 1,
          maxRetries,
          delay,
          errorMessage: lastError.message,
          ...options?.context
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Operation failed after all retries');
  }

  async executeWithResult<T>(
    operation: () => Promise<T>,
    options?: {
      maxRetries?: number;
      operationName?: string;
      context?: Record<string, unknown>;
    }
  ): Promise<RetryResult<T>> {
    const maxRetries = options?.maxRetries ?? this.config.maxRetries;
    const operationName = options?.operationName ?? 'unknown';
    let lastError: Error | null = null;
    let totalDelay = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        return {
          success: true,
          result,
          attempts: attempt + 1,
          totalDelay
        };
      } catch (error) {
        lastError = error as Error;
        const isLastAttempt = attempt === maxRetries;

        const canRetry = !isLastAttempt && (
          (this.shouldRetry && this.shouldRetry(lastError, attempt)) ||
          this.isRetryableError(lastError)
        );

        if (!canRetry) {
          return {
            success: false,
            error: lastError,
            attempts: attempt + 1,
            totalDelay
          };
        }

        const delay = this.calculateDelay(attempt);
        totalDelay += delay;

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: maxRetries + 1,
      totalDelay
    };
  }

  getConfig(): RetryConfig {
    return { ...this.config };
  }
}
