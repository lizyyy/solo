import { BaseAnalyzer } from './base-analyzer';
import { DBProfile, SQLTraceEntry, ConnectionPoolMetrics } from '../types';

export class ConnectionPoolAnalyzer extends BaseAnalyzer {
  private dbProfile: DBProfile;
  private traceEntries: SQLTraceEntry[];

  constructor(dbProfile: DBProfile, traceEntries: SQLTraceEntry[]) {
    super();
    this.dbProfile = dbProfile;
    this.traceEntries = traceEntries;
  }

  analyze(): ConnectionPoolMetrics {
    const queueMetrics = this.analyzeQueueStats();
    this.analyzeConnectionUtilization();
    this.analyzeTimeoutRisk();
    this.analyzeConnectionTimeoutConfig();

    return queueMetrics;
  }

  private analyzeQueueStats(): ConnectionPoolMetrics {
    const { maxConnections, maxWaitQueueSize } = this.dbProfile.connectionPool;
    
    const connectionsUsed = new Set<string>();
    const timestamps: number[] = [];

    for (const entry of this.traceEntries) {
      connectionsUsed.add(entry.connectionId);
      timestamps.push(entry.timestamp);
    }

    const uniqueConnections = connectionsUsed.size;
    const utilization = uniqueConnections / maxConnections;
    const queueRate = uniqueConnections > maxConnections ? 
      (uniqueConnections - maxConnections) / uniqueConnections : 0;

    const durationStats = this.traceEntries.reduce((acc, e) => {
      acc.total += e.durationMs;
      acc.max = Math.max(acc.max, e.durationMs);
      return acc;
    }, { total: 0, max: 0 });

    const avgDuration = this.traceEntries.length > 0 ? 
      durationStats.total / this.traceEntries.length : 0;

    if (utilization > 0.9) {
      this.addIssue(
        'connection-pool',
        'blocker',
        '连接池利用率过高',
        `当前连接利用率为 ${(utilization * 100).toFixed(1)}%，已接近或超过最大连接数 ${maxConnections}`,
        ['connectionPool'],
        `唯一连接数: ${uniqueConnections}, 最大连接数: ${maxConnections}`
      );
      this.addSuggestion(
        '增加最大连接数',
        `当前最大连接数 ${maxConnections} 不足以支撑峰值流量。建议增加至少 50% 的连接数`,
        'high',
        `修改 db-profile.yaml 中的 connectionPool.maxConnections 为 ${Math.ceil(maxConnections * 1.5)}`
      );
    }

    if (queueRate > 0.1) {
      this.addIssue(
        'connection-pool',
        'warning',
        '连接排队率过高',
        `排队请求比例达到 ${(queueRate * 100).toFixed(1)}%，可能导致请求延迟增加`,
        ['connectionPool'],
        `排队率阈值建议控制在 10% 以下`
      );
    }

    const p95Duration = this.calculateP95Duration();
    const timeoutRate = this.traceEntries.filter(
      e => e.durationMs > this.dbProfile.connectionPool.connectionTimeoutMs
    ).length / this.traceEntries.length;

    return {
      avgQueueSize: Math.max(0, uniqueConnections - maxConnections),
      maxQueueSize: Math.max(0, uniqueConnections - maxConnections),
      queueRate,
      avgConnectionWaitMs: avgDuration,
      connectionUtilization: utilization,
      timeoutRate
    };
  }

  private analyzeConnectionUtilization(): void {
    const { maxConnections, minConnections, idleTimeoutMs } = this.dbProfile.connectionPool;
    
    if (minConnections < maxConnections * 0.2) {
      this.addIssue(
        'connection-pool',
        'warning',
        '最小连接数设置过低',
        `最小连接数 ${minConnections} 远低于最大连接数的 20%，可能导致连接创建开销`,
        ['connectionPool'],
        `建议最小连接数设置为最大连接数的 20-30%`
      );
      this.addSuggestion(
        '调整最小连接数',
        `建议将 minConnections 设置为 ${Math.ceil(maxConnections * 0.25)}`,
        'medium',
        `修改 db-profile.yaml 中的 connectionPool.minConnections 为 ${Math.ceil(maxConnections * 0.25)}`
      );
    }

    if (idleTimeoutMs < 30000) {
      this.addIssue(
        'connection-pool',
        'info',
        '空闲超时时间较短',
        `空闲超时时间 ${idleTimeoutMs}ms 可能导致连接频繁创建和销毁`,
        ['connectionPool'],
        ''
      );
    }
  }

  private analyzeTimeoutRisk(): void {
    const { connectionTimeoutMs } = this.dbProfile.connectionPool;
    const slowQueries = this.traceEntries.filter(e => e.durationMs > connectionTimeoutMs);

    if (slowQueries.length > 0) {
      this.addIssue(
        'connection-pool',
        'blocker',
        '存在超时 SQL 查询',
        `发现 ${slowQueries.length} 个 SQL 执行时间超过连接超时时间 ${connectionTimeoutMs}ms`,
        slowQueries.slice(0, 5).map(q => q.sql.substring(0, 50) + '...'),
        `最慢查询: ${slowQueries.reduce((a, b) => a.durationMs > b.durationMs ? a : b).durationMs}ms`
      );
      this.addSuggestion(
        '优化慢查询',
        `针对超时 SQL 进行索引优化或查询重构`,
        'high',
        '分析慢查询的执行计划，添加合适的索引'
      );
    }
  }

  private analyzeConnectionTimeoutConfig(): void {
    const { connectionTimeoutMs, idleTimeoutMs } = this.dbProfile.connectionPool;

    if (connectionTimeoutMs < idleTimeoutMs) {
      this.addIssue(
        'connection-pool',
        'warning',
        '连接超时配置不合理',
        `连接超时时间(${connectionTimeoutMs}ms)小于空闲超时时间(${idleTimeoutMs}ms)，可能导致连接在使用中超时`,
        ['connectionPool'],
        '建议 connectionTimeoutMs > idleTimeoutMs'
      );
      this.addSuggestion(
        '调整超时配置',
        `建议将 connectionTimeoutMs 设置为大于 idleTimeoutMs`,
        'medium',
        `修改 connectionTimeoutMs 为 ${idleTimeoutMs + 10000}ms 或更大`
      );
    }
  }

  private calculateP95Duration(): number {
    if (this.traceEntries.length === 0) return 0;
    
    const durations = [...this.traceEntries]
      .map(e => e.durationMs)
      .sort((a, b) => a - b);
    
    const index = Math.ceil(durations.length * 0.95) - 1;
    return durations[Math.max(0, index)];
  }
}
