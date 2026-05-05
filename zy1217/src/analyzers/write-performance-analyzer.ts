import { BaseAnalyzer } from './base-analyzer';
import { SQLTraceEntry, WriteBatch, WritePerformanceMetrics } from '../types';

export class WritePerformanceAnalyzer extends BaseAnalyzer {
  private traceEntries: SQLTraceEntry[];
  private writeBatches: WriteBatch[];

  constructor(traceEntries: SQLTraceEntry[], writeBatches: WriteBatch[]) {
    super();
    this.traceEntries = traceEntries;
    this.writeBatches = writeBatches;
  }

  analyze(): WritePerformanceMetrics {
    const singleWrites = this.traceEntries.filter(e => !e.isRead);
    const batchWrites = this.writeBatches;

    const batchSizeDistribution: Record<number, number> = {};
    let totalRowsFromBatches = 0;

    for (const batch of batchWrites) {
      batchSizeDistribution[batch.rowCount] = (batchSizeDistribution[batch.rowCount] || 0) + 1;
      totalRowsFromBatches += batch.rowCount;
    }

    const avgSingleWriteMs = singleWrites.length > 0 ?
      singleWrites.reduce((sum, e) => sum + e.durationMs, 0) / singleWrites.length : 0;

    const avgBatchWriteMs = this.calculateAvgBatchWriteTime();

    const smallBatches = batchWrites.filter(b => b.rowCount <= 10);
    if (smallBatches.length > 0 && smallBatches.length / batchWrites.length > 0.5) {
      this.addIssue(
        'write-batch',
        'warning',
        '批量写入过小',
        `${smallBatches.length} 个批次的写入量 <= 10 行，建议合并小批次写入以提高性能`,
        smallBatches.slice(0, 5).map(b => `${b.table}:${b.rowCount}行`),
        `小批次占比: ${((smallBatches.length / batchWrites.length) * 100).toFixed(1)}%`
      );
      this.addSuggestion(
        '合并小批量写入',
        '建议将多次小批量写入合并为更大的批次，减少网络往返开销',
        'medium',
        '实现写入缓冲区，将多条记录积累到一定数量后再批量写入'
      );
    }

    const singleWriteInserts = singleWrites.filter(e => 
      e.sql.toUpperCase().includes('INSERT') && !e.sql.toUpperCase().includes('INSERT ... ON DUPLICATE')
    );

    if (singleWriteInserts.length > 100) {
      this.addIssue(
        'write-batch',
        'info',
        '存在大量单条 INSERT',
        `发现 ${singleWriteInserts.length} 条单条 INSERT 语句，考虑改用批量 INSERT`,
        [],
        '单条 INSERT 性能低于批量 INSERT 约 30-50%'
      );
      this.addSuggestion(
        '改用批量 INSERT',
        '将多条单条 INSERT 改为 VALUES 多值的批量 INSERT 语法',
        'low',
        '示例: INSERT INTO table (col1, col2) VALUES (v1, v2), (v3, v4), ...'
      );
    }

    const slowWrites = singleWrites.filter(e => e.durationMs > 100);
    if (slowWrites.length > 0) {
      this.addIssue(
        'write-batch',
        'warning',
        '存在慢写入操作',
        `发现 ${slowWrites.length} 个写入操作耗时超过 100ms`,
        slowWrites.slice(0, 5).map(w => w.sql.substring(0, 60) + '...'),
        `最慢写入: ${Math.max(...slowWrites.map(w => w.durationMs))}ms`
      );
    }

    return {
      singleWriteCount: singleWrites.length,
      batchWriteCount: batchWrites.length,
      avgSingleWriteMs,
      avgBatchWriteMs,
      totalRowsWritten: singleWrites.length + totalRowsFromBatches,
      batchSizeDistribution
    };
  }

  private calculateAvgBatchWriteTime(): number {
    const batchRelatedTraces = this.traceEntries.filter(e => {
      const sql = e.sql.toUpperCase();
      return (sql.includes('INSERT') && sql.includes('VALUES')) ||
             sql.includes('UPDATE') ||
             sql.includes('DELETE');
    });

    if (batchRelatedTraces.length === 0) return 0;

    return batchRelatedTraces.reduce((sum, e) => sum + e.durationMs, 0) / batchRelatedTraces.length;
  }
}
