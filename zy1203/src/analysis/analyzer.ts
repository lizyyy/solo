import {
  SimulationResult,
  AnalysisResult,
  TimeSeriesData,
  ConsumptionLatency,
} from '../types';

export class Analyzer {
  private result: SimulationResult;

  constructor(result: SimulationResult) {
    this.result = result;
  }

  analyze(): AnalysisResult {
    return {
      runId: this.result.runId,
      summary: this.result.summary,
      backlogAnalysis: this.analyzeBacklog(),
      orderAnalysis: this.analyzeOrdering(),
      duplicationAnalysis: this.analyzeDuplication(),
      latencyAnalysis: this.analyzeLatency(),
      failureAnalysis: this.analyzeFailures(),
    };
  }

  private analyzeBacklog(): AnalysisResult['backlogAnalysis'] {
    const timeSeries = this.result.timeSeries;
    
    if (timeSeries.length === 0) {
      return {
        peakBacklog: 0,
        peakTime: 0,
        backlogDuration: 0,
        recoveryTime: 0,
      };
    }

    let peakBacklog = 0;
    let peakTime = 0;
    let backlogStart = -1;
    let backlogEnd = -1;
    let recoveryTime = 0;

    for (let i = 0; i < timeSeries.length; i++) {
      const ts = timeSeries[i];
      
      if (ts.totalLag > peakBacklog) {
        peakBacklog = ts.totalLag;
        peakTime = ts.time;
      }
      
      if (ts.totalLag > 0 && backlogStart === -1) {
        backlogStart = ts.time;
      }
      
      if (ts.totalLag === 0 && backlogStart !== -1 && backlogEnd === -1) {
        backlogEnd = ts.time;
        recoveryTime = ts.time - peakTime;
      }
    }

    if (backlogStart === -1) {
      backlogStart = 0;
    }
    
    if (backlogEnd === -1) {
      backlogEnd = timeSeries[timeSeries.length - 1].time;
    }

    const backlogDuration = backlogEnd - backlogStart;

    return {
      peakBacklog,
      peakTime,
      backlogDuration: Math.max(0, backlogDuration),
      recoveryTime: Math.max(0, recoveryTime),
    };
  }

  private analyzeOrdering(): AnalysisResult['orderAnalysis'] {
    const outOfOrderEvents = this.result.outOfOrderEvents;
    const totalProduced = this.result.summary.totalMessagesProduced;
    
    const affectedKeys = new Set<string>();
    for (const event of outOfOrderEvents) {
      affectedKeys.add(event.key);
    }

    const outOfOrderRate = totalProduced > 0 
      ? outOfOrderEvents.length / totalProduced 
      : 0;

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (outOfOrderRate > 0.1) {
      riskLevel = 'high';
    } else if (outOfOrderRate > 0.01) {
      riskLevel = 'medium';
    }

    return {
      outOfOrderCount: outOfOrderEvents.length,
      outOfOrderRate,
      affectedKeys: Array.from(affectedKeys),
      riskLevel,
    };
  }

  private analyzeDuplication(): AnalysisResult['duplicationAnalysis'] {
    const duplicateEvents = this.result.duplicateEvents;
    const totalProduced = this.result.summary.totalMessagesProduced;
    
    const affectedIdempotentKeys = new Set<string>();
    for (const event of duplicateEvents) {
      affectedIdempotentKeys.add(event.idempotentKey);
    }

    const duplicateRate = totalProduced > 0 
      ? duplicateEvents.length / totalProduced 
      : 0;

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (duplicateRate > 0.1) {
      riskLevel = 'high';
    } else if (duplicateRate > 0.01) {
      riskLevel = 'medium';
    }

    return {
      duplicateCount: duplicateEvents.length,
      duplicateRate,
      affectedIdempotentKeys: Array.from(affectedIdempotentKeys),
      riskLevel,
    };
  }

  private analyzeLatency(): AnalysisResult['latencyAnalysis'] {
    const latencies = this.result.consumptionLatencies.map(l => l.latency);
    
    if (latencies.length === 0) {
      return {
        avgLatency: 0,
        maxLatency: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const avgLatency = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const maxLatency = sorted[sorted.length - 1];

    const p50 = this.percentile(sorted, 50);
    const p95 = this.percentile(sorted, 95);
    const p99 = this.percentile(sorted, 99);

    return {
      avgLatency,
      maxLatency,
      p50,
      p95,
      p99,
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  private analyzeFailures(): AnalysisResult['failureAnalysis'] {
    const timeSeries = this.result.timeSeries;
    
    if (timeSeries.length === 0) {
      return {
        consumerCrashes: 0,
        avgRecoveryTime: 0,
        maxRecoveryTime: 0,
      };
    }

    let crashCount = 0;
    const recoveryTimes: number[] = [];
    let lastAliveCount = timeSeries[0].aliveConsumerCount;
    let crashStartTime: Map<number, number> = new Map();

    for (let i = 1; i < timeSeries.length; i++) {
      const current = timeSeries[i];
      const prev = timeSeries[i - 1];
      
      if (current.aliveConsumerCount < prev.aliveConsumerCount) {
        crashCount += prev.aliveConsumerCount - current.aliveConsumerCount;
        crashStartTime.set(i, current.time);
      }
      
      if (current.aliveConsumerCount > prev.aliveConsumerCount && crashStartTime.size > 0) {
        const earliestCrash = Math.min(...crashStartTime.values());
        recoveryTimes.push(current.time - earliestCrash);
        crashStartTime.clear();
      }
    }

    let avgRecoveryTime = 0;
    let maxRecoveryTime = 0;
    
    if (recoveryTimes.length > 0) {
      avgRecoveryTime = recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length;
      maxRecoveryTime = Math.max(...recoveryTimes);
    }

    return {
      consumerCrashes: crashCount,
      avgRecoveryTime,
      maxRecoveryTime,
    };
  }
}
