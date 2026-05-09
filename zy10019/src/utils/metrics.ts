import { PoolMetrics } from '../types';

interface MetricsHistory {
  timestamps: number[];
  values: number[];
}

export class MetricsCollector {
  private metrics: PoolMetrics;
  private history: Map<string, MetricsHistory>;
  private maxHistorySize: number;
  private windowSize: number;

  constructor() {
    this.metrics = this.createEmptyMetrics();
    this.history = new Map();
    this.maxHistorySize = 1000;
    this.windowSize = 60000;

    this.initHistory();
  }

  private initHistory(): void {
    const metricTypes = [
      'totalConnections',
      'availableConnections',
      'borrowedConnections',
      'pendingRequests',
      'waitingCount'
    ];
    
    metricTypes.forEach(type => {
      this.history.set(type, { timestamps: [], values: [] });
    });
  }

  private createEmptyMetrics(): PoolMetrics {
    return {
      totalConnections: 0,
      availableConnections: 0,
      borrowedConnections: 0,
      pendingRequests: 0,
      waitingCount: 0,
      createdCount: 0,
      destroyedCount: 0,
      errorCount: 0,
      timeoutCount: 0,
      totalAcquireTime: 0,
      totalUseTime: 0,
      acquireCount: 0,
      releaseCount: 0
    };
  }

  incrementCreated(): void {
    this.metrics.createdCount++;
    this.metrics.totalConnections++;
    this.metrics.availableConnections++;
    this.recordToHistory();
  }

  incrementDestroyed(): void {
    this.metrics.destroyedCount++;
    this.metrics.totalConnections--;
  }

  incrementAcquired(acquireTime: number): void {
    this.metrics.acquireCount++;
    this.metrics.totalAcquireTime += acquireTime;
    this.metrics.availableConnections--;
    this.metrics.borrowedConnections++;
    this.recordToHistory();
  }

  incrementReleased(useTime: number): void {
    this.metrics.releaseCount++;
    this.metrics.totalUseTime += useTime;
    this.metrics.borrowedConnections--;
    this.metrics.availableConnections++;
    this.recordToHistory();
  }

  incrementError(): void {
    this.metrics.errorCount++;
  }

  incrementTimeout(): void {
    this.metrics.timeoutCount++;
  }

  incrementPending(): void {
    this.metrics.pendingRequests++;
    this.metrics.waitingCount++;
    this.recordToHistory();
  }

  decrementPending(): void {
    if (this.metrics.pendingRequests > 0) {
      this.metrics.pendingRequests--;
    }
    this.recordToHistory();
  }

  incrementWaiting(): void {
    this.metrics.waitingCount++;
  }

  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  private recordToHistory(): void {
    const now = Date.now();
    
    this.history.forEach((history, key) => {
      const value = this.metrics[key as keyof PoolMetrics] as number;
      if (typeof value === 'number') {
        history.timestamps.push(now);
        history.values.push(value);

        if (history.timestamps.length > this.maxHistorySize) {
          history.timestamps.shift();
          history.values.shift();
        }
      }
    });
  }

  getHistory(key: string, windowMs: number = this.windowSize): { timestamps: number[]; values: number[] } {
    const history = this.history.get(key);
    if (!history) {
      return { timestamps: [], values: [] };
    }

    const now = Date.now();
    const cutoff = now - windowMs;
    
    const result: { timestamps: number[]; values: number[] } = { timestamps: [], values: [] };
    
    for (let i = history.timestamps.length - 1; i >= 0; i--) {
      if (history.timestamps[i] >= cutoff) {
        result.timestamps.unshift(history.timestamps[i]);
        result.values.unshift(history.values[i]);
      } else {
        break;
      }
    }

    return result;
  }

  getStatistics(windowMs: number = 60000): Record<string, {
    min: number;
    max: number;
    avg: number;
    current: number;
  }> {
    const stats: Record<string, {
      min: number;
      max: number;
      avg: number;
      current: number;
    }> = {};

    this.history.forEach((history, key) => {
      const currentValue = this.metrics[key as keyof PoolMetrics] as number;
      if (typeof currentValue !== 'number') return;

      const window = this.getHistory(key, windowMs);
      
      if (window.values.length === 0) {
        stats[key] = {
          min: currentValue,
          max: currentValue,
          avg: currentValue,
          current: currentValue
        };
        return;
      }

      const min = Math.min(...window.values);
      const max = Math.max(...window.values);
      const avg = window.values.reduce((a, b) => a + b, 0) / window.values.length;

      stats[key] = { min, max, avg, current: currentValue };
    });

    return stats;
  }

  getAverageAcquireTime(): number {
    return this.metrics.acquireCount > 0 
      ? this.metrics.totalAcquireTime / this.metrics.acquireCount 
      : 0;
  }

  getAverageUseTime(): number {
    return this.metrics.releaseCount > 0 
      ? this.metrics.totalUseTime / this.metrics.releaseCount 
      : 0;
  }

  getErrorRate(): number {
    const total = this.metrics.acquireCount;
    return total > 0 ? this.metrics.errorCount / total : 0;
  }

  reset(): void {
    this.metrics = this.createEmptyMetrics();
    this.history.forEach(history => {
      history.timestamps = [];
      history.values = [];
    });
  }

  getSnapshot(): PoolMetrics {
    return { ...this.metrics };
  }

  getUtilization(): number {
    const total = this.metrics.totalConnections;
    const borrowed = this.metrics.borrowedConnections;
    return total > 0 ? borrowed / total : 0;
  }

  getQueueDepth(): number {
    return this.metrics.pendingRequests;
  }

  setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(100, size);
  }

  setWindowSize(size: number): void {
    this.windowSize = Math.max(1000, size);
  }
}

export const metricsCollector = new MetricsCollector();
