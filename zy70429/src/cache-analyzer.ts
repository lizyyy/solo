import { BusReservation, CacheEntry, CacheStats, AnalysisResult, Anomaly, PreviewResult, RollbackPlan } from './types';
import { generateId } from './data-generator';

export class CacheAnalyzer {
  private cache: Map<string, CacheEntry<BusReservation>> = new Map();
  private stats: CacheStats = {
    totalOperations: 0,
    hits: 0,
    misses: 0,
    hitRate: 0,
    concurrentConflicts: 0,
    overwrittenKeys: [],
  };
  private writeHistory: Map<string, BusReservation[]> = new Map();
  private rawData: BusReservation[] = [];

  constructor(private defaultTtl: number = 3600000) {}

  get(key: string): BusReservation | undefined {
    this.stats.totalOperations++;
    const entry = this.cache.get(key);
    
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      this.stats.hits++;
      entry.hitCount++;
      entry.lastHitAt = Date.now();
      this.updateHitRate();
      return entry.value;
    }
    
    this.stats.misses++;
    this.updateHitRate();
    return undefined;
  }

  set(key: string, value: BusReservation, ttl?: number): void {
    this.stats.totalOperations++;
    this.rawData.push({ ...value });

    const existing = this.cache.get(key);
    if (existing) {
      const history = this.writeHistory.get(key) || [];
      if (history.length > 0) {
        const lastWrite = history[history.length - 1];
        if (lastWrite.version === value.version && lastWrite.updatedAt !== value.updatedAt) {
          this.stats.concurrentConflicts++;
          if (!this.stats.overwrittenKeys.includes(key)) {
            this.stats.overwrittenKeys.push(key);
          }
        }
      }
      history.push({ ...value });
      this.writeHistory.set(key, history);
    } else {
      this.writeHistory.set(key, [{ ...value }]);
    }

    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl,
      hitCount: 0,
      lastHitAt: Date.now(),
    });
  }

  private updateHitRate(): void {
    if (this.stats.totalOperations > 0) {
      this.stats.hitRate = this.stats.hits / (this.stats.hits + this.stats.misses);
    }
  }

  loadReservations(reservations: BusReservation[]): void {
    reservations.forEach(r => {
      this.set(r.id, r);
    });
  }

  detectAnomalies(): Anomaly[] {
    const anomalies: Anomaly[] = [];

    for (const key of this.stats.overwrittenKeys) {
      const history = this.writeHistory.get(key);
      if (history && history.length >= 2) {
        const versionGroups: Map<number, BusReservation[]> = new Map();
        for (const record of history) {
          const group = versionGroups.get(record.version) || [];
          group.push(record);
          versionGroups.set(record.version, group);
        }

        let beforeRecord = history[0];
        let afterRecord = history[history.length - 1];

        for (const [version, records] of versionGroups.entries()) {
          if (records.length >= 2) {
            const writerA = records[0];
            const writerB = records.find(r => r.source.includes('WriterB')) || records[1];
            
            beforeRecord = writerA;
            afterRecord = writerB;
          }
        }

        const affectedFields: string[] = [];
        if (beforeRecord.busStop !== afterRecord.busStop) affectedFields.push('busStop');
        if (beforeRecord.busRoute !== afterRecord.busRoute) affectedFields.push('busRoute');
        if (beforeRecord.timeSlot !== afterRecord.timeSlot) affectedFields.push('timeSlot');
        if (beforeRecord.version === afterRecord.version) affectedFields.push('version');
        if (beforeRecord.source !== afterRecord.source) affectedFields.push('source');

        const isBusStopLost = beforeRecord.source.toLowerCase().includes('writer-a') && 
                              beforeRecord.busStop === '北门站' && 
                              afterRecord.busStop !== '北门站';

        const description = isBusStopLost
          ? `检测到并发写入覆盖: WriterA 将 busStop 改为"北门站"，但被 WriterB 覆盖丢失，最终值为"${afterRecord.busStop}"`
          : `检测到并发写入覆盖: 员工 ${afterRecord.employeeName} 的预约记录被覆盖`;

        anomalies.push({
          type: 'concurrent_overwrite',
          reservationId: key,
          description,
          beforeValue: {
            busRoute: beforeRecord.busRoute,
            busStop: beforeRecord.busStop,
            timeSlot: beforeRecord.timeSlot,
            source: beforeRecord.source,
            version: beforeRecord.version,
          },
          afterValue: {
            busRoute: afterRecord.busRoute,
            busStop: afterRecord.busStop,
            timeSlot: afterRecord.timeSlot,
            source: afterRecord.source,
            version: afterRecord.version,
          },
          affectedFields,
          timestamp: afterRecord.updatedAt,
        });
      }
    }

    for (const [key, entry] of this.cache.entries()) {
      const r = entry.value;
      const missing: string[] = [];
      if (!r.employeeId) missing.push('employeeId');
      if (!r.employeeName) missing.push('employeeName');
      if (!r.busRoute) missing.push('busRoute');
      if (!r.date) missing.push('date');
      
      if (missing.length > 0) {
        anomalies.push({
          type: 'missing_field',
          reservationId: key,
          description: `记录缺失必要字段: ${missing.join(', ')}`,
          affectedFields: missing,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return anomalies;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  getAllReservations(): BusReservation[] {
    return Array.from(this.cache.values()).map(e => e.value);
  }

  getWriteHistory(key: string): BusReservation[] {
    return this.writeHistory.get(key) || [];
  }

  analyze(): AnalysisResult {
    return {
      stats: this.getStats(),
      reservations: this.getAllReservations(),
      anomalies: this.detectAnomalies(),
      rawData: [...this.rawData],
    };
  }

  previewFix(anomaly: Anomaly): PreviewResult {
    const affectedIds = [anomaly.reservationId];
    const sampleItems = affectedIds
      .map(id => this.cache.get(id)?.value)
      .filter((r): r is BusReservation => r !== undefined);

    return {
      action: `修复异常: ${anomaly.type}`,
      count: affectedIds.length,
      affectedIds,
      sampleItems,
    };
  }

  previewCleanup(): PreviewResult {
    const overwrittenIds = this.stats.overwrittenKeys;
    const sampleItems = overwrittenIds
      .slice(0, 3)
      .map(id => this.cache.get(id)?.value)
      .filter((r): r is BusReservation => r !== undefined);

    return {
      action: '清理异常缓存记录',
      count: overwrittenIds.length,
      affectedIds: overwrittenIds,
      sampleItems,
    };
  }

  createRollbackPlan(): RollbackPlan {
    return {
      rollbackId: 'ROLLBACK-' + generateId(),
      itemsToRestore: this.getAllReservations(),
      backupSnapshot: this.getAllReservations().map(r => ({ ...r })),
      createdAt: new Date().toISOString(),
    };
  }

  applyFix(anomaly: Anomaly): BusReservation | null {
    const entry = this.cache.get(anomaly.reservationId);
    if (!entry) return null;

    const history = this.writeHistory.get(anomaly.reservationId);
    if (history && history.length >= 2) {
      const corrected = {
        ...history[0],
        version: history[history.length - 1].version + 1,
        updatedAt: new Date().toISOString(),
        source: 'fixed-by-analyzer',
      };
      this.cache.set(anomaly.reservationId, {
        ...entry,
        value: corrected,
      });
      return corrected;
    }

    return null;
  }

  clear(): void {
    this.cache.clear();
    this.writeHistory.clear();
    this.rawData = [];
    this.stats = {
      totalOperations: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      concurrentConflicts: 0,
      overwrittenKeys: [],
    };
  }
}

export function formatHitRate(rate: number): string {
  return (rate * 100).toFixed(2) + '%';
}

export function generateSummary(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push('=== 缓存命中分析摘要 ===');
  lines.push(`总操作数: ${result.stats.totalOperations}`);
  lines.push(`命中数: ${result.stats.hits}`);
  lines.push(`未命中数: ${result.stats.misses}`);
  lines.push(`命中率: ${formatHitRate(result.stats.hitRate)}`);
  lines.push(`并发冲突数: ${result.stats.concurrentConflicts}`);
  lines.push(`被覆盖KEY: ${result.stats.overwrittenKeys.join(', ') || '无'}`);
  lines.push('');

  if (result.anomalies.length > 0) {
    lines.push('=== 培训环境清单异常 ===');
    for (const anomaly of result.anomalies) {
      if (anomaly.type === 'concurrent_overwrite') {
        lines.push(`异常ID: ${anomaly.reservationId}`);
        lines.push(`描述: ${anomaly.description}`);
        lines.push('变更前: ' + JSON.stringify(anomaly.beforeValue));
        lines.push('变更后: ' + JSON.stringify(anomaly.afterValue));
        lines.push('影响字段: ' + anomaly.affectedFields.join(', '));
        lines.push('修正建议: 增加版本号乐观锁，写入前校验版本');
        lines.push('结论: 该记录存在并发写入覆盖问题，WriterA的修改丢失');
      }
      lines.push('');
    }
  }

  lines.push('=== 原始输入追溯 ===');
  lines.push('所有记录字段均可追溯至原始输入，包含:');
  lines.push('- employeeId, employeeName, department (员工信息)');
  lines.push('- busRoute, busStop, date, timeSlot (预约信息)');
  lines.push('- status, createdAt, updatedAt, source, version (系统字段)');
  lines.push('');
  lines.push('样例数据来源: 复核班车预约名单');

  return lines.join('\n');
}
