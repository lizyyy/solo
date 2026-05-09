import { CircuitBreakerState, CircuitBreakerConfig } from '../types';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from '../config';
import { logger } from '../utils/logger';
import { CircuitBreakerOpenException } from '../utils/errors';

export interface CircuitBreakerStats {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  rejectionCount: number;
  circuitOpens: number;
  circuitResets: number;
  lastStateChange: number;
  currentFailureRate: number;
}

export interface CircuitBreakerSnapshot {
  state: CircuitBreakerState;
  config: CircuitBreakerConfig;
  stats: CircuitBreakerStats;
  recoveryTimeRemaining: number;
  canExecute: boolean;
}

interface SlidingWindow {
  timestamps: number[];
  results: ('success' | 'failure' | 'timeout')[];
  windowSize: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState;
  private config: CircuitBreakerConfig;
  private window: SlidingWindow;
  private stats: CircuitBreakerStats;
  private recoveryStartTime: number = 0;
  private halfOpenSuccessCount: number = 0;
  private name: string;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.state = CircuitBreakerState.CLOSED;
    this.window = {
      timestamps: [],
      results: [],
      windowSize: 100
    };
    this.stats = this.createEmptyStats();
  }

  private createEmptyStats(): CircuitBreakerStats {
    return {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      timeoutCount: 0,
      rejectionCount: 0,
      circuitOpens: 0,
      circuitResets: 0,
      lastStateChange: Date.now(),
      currentFailureRate: 0
    };
  }

  canExecute(): boolean {
    if (this.state === CircuitBreakerState.CLOSED) {
      return true;
    }

    if (this.state === CircuitBreakerState.OPEN) {
      const elapsed = Date.now() - this.recoveryStartTime;
      if (elapsed >= this.config.recoveryTimeout) {
        this.transitionToHalfOpen();
        return true;
      }
      return false;
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      return true;
    }

    return false;
  }

  private transitionToHalfOpen(): void {
    const oldState = this.state;
    this.state = CircuitBreakerState.HALF_OPEN;
    this.halfOpenSuccessCount = 0;
    
    this.stats.lastStateChange = Date.now();
    logger.info(`Circuit breaker ${this.name}: ${oldState} -> HALF_OPEN`, {
      name: this.name,
      oldState,
      newState: CircuitBreakerState.HALF_OPEN
    });
  }

  private transitionToOpen(reason: string): void {
    const oldState = this.state;
    this.state = CircuitBreakerState.OPEN;
    this.recoveryStartTime = Date.now();
    this.stats.circuitOpens++;
    this.stats.lastStateChange = Date.now();
    
    logger.warn(`Circuit breaker ${this.name} tripped: ${oldState} -> OPEN`, {
      name: this.name,
      reason,
      failureRate: this.calculateFailureRate(),
      windowSize: this.getWindowCount()
    });
  }

  private transitionToClosed(): void {
    const oldState = this.state;
    this.state = CircuitBreakerState.CLOSED;
    this.clearWindow();
    this.stats.circuitResets++;
    this.stats.lastStateChange = Date.now();
    
    logger.info(`Circuit breaker ${this.name} reset: ${oldState} -> CLOSED`, {
      name: this.name,
      oldState,
      newState: CircuitBreakerState.CLOSED
    });
  }

  private recordToWindow(result: 'success' | 'failure' | 'timeout'): void {
    const now = Date.now();
    this.window.timestamps.push(now);
    this.window.results.push(result);

    while (this.window.timestamps.length > this.window.windowSize) {
      this.window.timestamps.shift();
      this.window.results.shift();
    }
  }

  private getWindowCount(): number {
    return this.window.results.length;
  }

  private calculateFailureRate(): number {
    const total = this.getWindowCount();
    if (total === 0) return 0;

    const failures = this.window.results.filter(
      r => r === 'failure' || r === 'timeout'
    ).length;

    return failures / total;
  }

  private clearWindow(): void {
    this.window.timestamps = [];
    this.window.results = [];
  }

  private shouldTrip(): boolean {
    const failureRate = this.calculateFailureRate();
    const windowCount = this.getWindowCount();
    
    return windowCount >= 10 && failureRate >= this.config.failureThreshold;
  }

  private shouldReset(): boolean {
    return this.halfOpenSuccessCount >= this.config.successThreshold;
  }

  recordSuccess(): void {
    this.stats.totalRequests++;
    this.stats.successCount++;
    this.recordToWindow('success');

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenSuccessCount++;
      if (this.shouldReset()) {
        this.transitionToClosed();
      }
    }
  }

  recordFailure(error?: Error): void {
    this.stats.totalRequests++;
    this.stats.failureCount++;
    this.recordToWindow('failure');

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionToOpen('failure_in_half_open');
    } else if (this.state === CircuitBreakerState.CLOSED && this.shouldTrip()) {
      this.transitionToOpen('failure_rate_exceeded');
    }
  }

  recordTimeout(): void {
    this.stats.totalRequests++;
    this.stats.timeoutCount++;
    this.recordToWindow('timeout');

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionToOpen('timeout_in_half_open');
    } else if (this.state === CircuitBreakerState.CLOSED && this.shouldTrip()) {
      this.transitionToOpen('timeout_rate_exceeded');
    }
  }

  recordRejection(): void {
    this.stats.rejectionCount++;
  }

  async execute<T>(
    operation: () => Promise<T>,
    options?: {
      timeout?: number;
      fallback?: () => Promise<T>;
    }
  ): Promise<T> {
    if (!this.canExecute()) {
      this.recordRejection();
      
      const recoveryRemaining = this.config.recoveryTimeout - (Date.now() - this.recoveryStartTime);
      
      if (options?.fallback) {
        logger.warn(`Circuit breaker ${this.name} is open, using fallback`, {
          name: this.name,
          state: this.state,
          recoveryTimeRemaining: recoveryRemaining
        });
        return options.fallback();
      }

      throw new CircuitBreakerOpenException(
        Math.max(0, recoveryRemaining)
      );
    }

    const timeout = options?.timeout ?? this.config.timeout;
    
    try {
      const result = await this.withTimeout(operation, timeout);
      this.recordSuccess();
      return result;
    } catch (error) {
      const err = error as Error;
      const code = (err as NodeJS.ErrnoException).code;
      
      if (code === 'TIMEOUT' || err.message.includes('timeout')) {
        this.recordTimeout();
      } else {
        this.recordFailure(err);
      }
      
      if (options?.fallback) {
        logger.warn(`Operation failed, using fallback`, {
          name: this.name,
          error: err.message
        });
        return options.fallback();
      }
      
      throw error;
    }
  }

  private async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    if (timeoutMs <= 0) {
      return operation();
    }

    let timeoutHandle: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const error = new Error(`Operation timed out after ${timeoutMs}ms`);
        (error as NodeJS.ErrnoException).code = 'TIMEOUT';
        reject(error);
      }, timeoutMs);
    });

    try {
      return await Promise.race([operation(), timeoutPromise]);
    } finally {
      if (timeoutHandle!) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  forceOpen(reason: string = 'manual'): void {
    if (this.state !== CircuitBreakerState.OPEN) {
      this.transitionToOpen(reason);
    }
  }

  forceClose(): void {
    if (this.state !== CircuitBreakerState.CLOSED) {
      this.transitionToClosed();
    }
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.clearWindow();
    this.stats = this.createEmptyStats();
    this.recoveryStartTime = 0;
    this.halfOpenSuccessCount = 0;
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    return {
      ...this.stats,
      currentFailureRate: this.calculateFailureRate()
    };
  }

  getSnapshot(): CircuitBreakerSnapshot {
    const recoveryTimeRemaining = this.state === CircuitBreakerState.OPEN
      ? Math.max(0, this.config.recoveryTimeout - (Date.now() - this.recoveryStartTime))
      : 0;

    return {
      state: this.state,
      config: { ...this.config },
      stats: this.getStats(),
      recoveryTimeRemaining,
      canExecute: this.canExecute()
    };
  }

  getName(): string {
    return this.name;
  }
}
