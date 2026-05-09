import { RetryConfig } from '../types';
import { isLockError } from '../config/default';

export class RetryExecutor {
  private readonly config: RetryConfig;

  constructor(config: RetryConfig) {
    this.config = config;
  }

  async execute<T>(
    operation: () => Promise<T> | T,
    onRetry?: (retryCount: number, error: unknown) => void
  ): Promise<T> {
    let lastError: unknown;
    let currentDelay = this.config.initialDelayMs;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!isLockError(error)) {
          throw error;
        }

        if (attempt >= this.config.maxRetries) {
          break;
        }

        const waitTime = this.calculateWaitTime(currentDelay);
        if (onRetry) {
          onRetry(attempt + 1, error);
        }

        await this.sleep(waitTime);
        currentDelay = Math.min(currentDelay * this.config.backoffMultiplier, this.config.maxDelayMs);
      }
    }

    throw lastError;
  }

  private calculateWaitTime(currentDelay: number): number {
    const [minJitter, maxJitter] = this.config.jitterRange;
    const jitterFactor = minJitter + Math.random() * (maxJitter - minJitter);
    return Math.round(currentDelay * jitterFactor);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
