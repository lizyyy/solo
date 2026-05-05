import { BaseAnalyzer } from './base-analyzer';
import { SQLTraceEntry, SlowSQLMetrics, SlowQuery } from '../types';

export class SlowSQLAnalyzer extends BaseAnalyzer {
  private traceEntries: SQLTraceEntry[];
  private slowThresholdMs: number;

  constructor(traceEntries: SQLTraceEntry[], slowThresholdMs: number = 500) {
    super();
    this.traceEntries = traceEntries;
    this.slowThresholdMs = slowThresholdMs;
  }

  analyze(): SlowSQLMetrics {
    const slowQueries = this.traceEntries.filter(e => e.durationMs > this.slowThresholdMs);
    const readSlowQueries = slowQueries.filter(e => e.isRead);
    const writeSlowQueries = slowQueries.filter(e => !e.isRead);

    const queryGroups = this.groupSimilarQueries(slowQueries);
    const slowQueryDetails: SlowQuery[] = [];

    for (const [sqlPattern, entries] of queryGroups) {
      const avgDuration = entries.reduce((sum, e) => sum + e.durationMs, 0) / entries.length;
      const maxDuration = Math.max(...entries.map(e => e.durationMs));
      
      slowQueryDetails.push({
        sql: sqlPattern.substring(0, 200),
        avgDurationMs: avgDuration,
        count: entries.length,
        maxDurationMs: maxDuration,
        isRead: entries[0].isRead
      });
    }

    slowQueryDetails.sort((a, b) => b.avgDurationMs - a.avgDurationMs);

    const totalSlowCount = slowQueries.length;
    const avgDuration = totalSlowCount > 0 ?
      slowQueries.reduce((sum, e) => sum + e.durationMs, 0) / totalSlowCount : 0;
    const p95Duration = this.calculateP95(slowQueries);

    if (totalSlowCount > 0) {
      const slowRatio = totalSlowCount / this.traceEntries.length;
      
      if (slowRatio > 0.1) {
        this.addIssue(
          'slow-sql',
          'blocker',
          '慢查询比例过高',
          `慢查询比例达到 ${(slowRatio * 100).toFixed(1)}%，严重影响系统性能`,
          [`慢查询总数: ${totalSlowCount}`],
          `建议将慢查询比例控制在 5% 以下`
        );
      } else if (slowRatio > 0.05) {
        this.addIssue(
          'slow-sql',
          'warning',
          '慢查询比例偏高',
          `慢查询比例为 ${(slowRatio * 100).toFixed(1)}%，建议优化`,
          [],
          ''
        );
      }

      if (readSlowQueries.length > 0) {
        this.addIssue(
          'slow-sql',
          'warning',
          '存在慢读查询',
          `发现 ${readSlowQueries.length} 个慢读查询`,
          readSlowQueries.slice(0, 5).map(q => q.sql.substring(0, 50) + '...'),
          `平均耗时: ${(readSlowQueries.reduce((s, q) => s + q.durationMs, 0) / readSlowQueries.length).toFixed(0)}ms`
        );
      }

      if (writeSlowQueries.length > 0) {
        this.addIssue(
          'slow-sql',
          'warning',
          '存在慢写操作',
          `发现 ${writeSlowQueries.length} 个慢写操作`,
          writeSlowQueries.slice(0, 5).map(q => q.sql.substring(0, 50) + '...'),
          `平均耗时: ${(writeSlowQueries.reduce((s, q) => s + q.durationMs, 0) / writeSlowQueries.length).toFixed(0)}ms`
        );
      }

      if (slowQueryDetails.length > 0) {
        this.addSuggestion(
          '优化 Top N 慢查询',
          `建议优先优化以下慢查询: ${slowQueryDetails.slice(0, 3).map(q => q.sql.substring(0, 30)).join(', ')} 等`,
          'high',
          '1. 检查索引是否正确使用\n2. 分析 EXPLAIN 执行计划\n3. 考虑添加合适的索引\n4. 优化 SQL 语句结构'
        );
      }
    }

    const verySlowQueries = slowQueries.filter(e => e.durationMs > 5000);
    if (verySlowQueries.length > 0) {
      this.addIssue(
        'slow-sql',
        'blocker',
        '存在超慢查询',
        `发现 ${verySlowQueries.length} 个查询耗时超过 5 秒`,
        verySlowQueries.slice(0, 3).map(q => q.sql.substring(0, 60) + '...'),
        `最慢查询: ${Math.max(...verySlowQueries.map(q => q.durationMs))}ms`
      );
    }

    return {
      totalCount: totalSlowCount,
      avgDurationMs: avgDuration,
      p95DurationMs: p95Duration,
      slowQueries: slowQueryDetails.slice(0, 20)
    };
  }

  private groupSimilarQueries(entries: SQLTraceEntry[]): Map<string, SQLTraceEntry[]> {
    const groups = new Map<string, SQLTraceEntry[]>();
    
    for (const entry of entries) {
      const pattern = this.normalizeSQL(entry.sql);
      if (!groups.has(pattern)) {
        groups.set(pattern, []);
      }
      groups.get(pattern)!.push(entry);
    }

    return groups;
  }

  private normalizeSQL(sql: string): string {
    return sql
      .replace(/\?/g, '?')
      .replace(/'[^']*'/g, "'?'")
      .replace(/"[^"]*"/g, '"?"')
      .replace(/\b\d+\b/g, '?')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateP95(entries: SQLTraceEntry[]): number {
    if (entries.length === 0) return 0;
    
    const durations = [...entries]
      .map(e => e.durationMs)
      .sort((a, b) => a - b);
    
    const index = Math.ceil(durations.length * 0.95) - 1;
    return durations[Math.max(0, index)];
  }
}
