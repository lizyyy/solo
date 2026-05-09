import { v4 as uuidv4 } from 'uuid';
import {
  LogEntry,
  ReplayRecord,
  SystemInfo,
  DatabaseStateSnapshot,
  ErrorContext,
} from '../types';
import { Logger } from '../logging/Logger';
import { DatabaseService } from '../core/DatabaseService';

export type ReplayMode = 'SEQUENTIAL' | 'PARALLEL' | 'TIMELINE';
export type ReplayResultStatus = 'SUCCESS' | 'FAILED' | 'PARTIAL';

export interface ReplayResult {
  id: string;
  timestamp: number;
  mode: ReplayMode;
  originalRecordId: string;
  status: ReplayResultStatus;
  operationsExecuted: number;
  operationsFailed: number;
  totalDurationMs: number;
  errors: Array<{
    index: number;
    message: string;
    isLockError: boolean;
    sql?: string;
  }>;
  matchedOriginalError: boolean;
  timingMetrics: Array<{
    index: number;
    originalDuration: number;
    replayDuration: number;
  }>;
}

export interface ReplayConfig {
  mode: ReplayMode;
  stopOnError: boolean;
  applyDatabaseChanges: boolean;
  timingAccuracy: 'EXACT' | 'APPROXIMATE' | 'IGNORE';
  maxParallelOperations: number;
  replayLogger: Logger;
}

export class ErrorReplayer {
  private readonly records: Map<string, ReplayRecord> = new Map();
  private readonly originalDbPath: string;
  private readonly config: Partial<ReplayConfig>;

  constructor(originalDbPath: string, config?: Partial<ReplayConfig>) {
    this.originalDbPath = originalDbPath;
    this.config = config || {};
  }

  createRecord(
    logEntries: LogEntry[],
    databaseState: DatabaseStateSnapshot,
    errorContext?: ErrorContext
  ): ReplayRecord {
    const record: ReplayRecord = {
      id: uuidv4(),
      timestamp: Date.now(),
      logEntries: [...logEntries].sort((a, b) => a.timestamp - b.timestamp),
      databaseState,
      systemInfo: this.getSystemInfo(),
      errorContext,
    };

    this.records.set(record.id, record);
    return record;
  }

  getRecord(id: string): ReplayRecord | undefined {
    return this.records.get(id);
  }

  getAllRecords(): ReplayRecord[] {
    return Array.from(this.records.values());
  }

  getRecordsWithErrors(): ReplayRecord[] {
    return Array.from(this.records.values()).filter((r) => r.errorContext !== undefined);
  }

  async replay(
    recordId: string,
    service: DatabaseService,
    config?: Partial<ReplayConfig>
  ): Promise<ReplayResult> {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`Replay record not found: ${recordId}`);
    }

    const effectiveConfig = { ...this.config, ...config };
    const logger = config?.replayLogger || service.getLogger();

    const result: ReplayResult = {
      id: uuidv4(),
      timestamp: Date.now(),
      mode: effectiveConfig.mode || 'SEQUENTIAL',
      originalRecordId: recordId,
      status: 'SUCCESS',
      operationsExecuted: 0,
      operationsFailed: 0,
      totalDurationMs: 0,
      errors: [],
      matchedOriginalError: false,
      timingMetrics: [],
    };

    const startTime = Date.now();
    const writeOperations = this.extractWriteOperations(record.logEntries);

    try {
      switch (effectiveConfig.mode) {
        case 'PARALLEL':
          await this.replayParallel(record, writeOperations, logger, result, effectiveConfig, service);
          break;
        case 'TIMELINE':
          await this.replayTimeline(record, writeOperations, logger, result, effectiveConfig, service);
          break;
        case 'SEQUENTIAL':
        default:
          await this.replaySequential(record, writeOperations, logger, result, effectiveConfig, service);
      }
    } finally {
      result.totalDurationMs = Date.now() - startTime;
    }

    if (record.errorContext) {
      result.matchedOriginalError = this.checkErrorMatch(record.errorContext, result);
    }

    return result;
  }

  private async replaySequential(
    record: ReplayRecord,
    operations: ReplayOperation[],
    logger: Logger,
    result: ReplayResult,
    config: Partial<ReplayConfig>,
    service: DatabaseService
  ): Promise<void> {
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const originalDuration = record.logEntries.find(
        (l) => l.sql === op.sql && l.operationType === op.type
      )?.duration || 0;

      const opStartTime = Date.now();

      try {
        await this.executeOperation(service, op);
        result.operationsExecuted++;
        result.timingMetrics.push({
          index: i,
          originalDuration,
          replayDuration: Date.now() - opStartTime,
        });
        logger.logOperationStart({
          id: uuidv4(),
          timestamp: Date.now(),
          operationId: uuidv4(),
          transactionId: null,
          connectionId: 'replay',
          operationType: op.type,
          sql: op.sql,
          params: op.params,
          startTime: opStartTime,
          status: 'PENDING',
          lockState: {
            connectionId: 'replay',
            lockType: 'NONE',
            walFileSize: 0,
            checkpointProgress: 1,
            pendingWrites: 0,
            activeReaders: 0,
          },
          retryCount: 0,
          metadata: { replayIndex: i },
        });
      } catch (error) {
        const err = error as { message?: string; code?: string };
        result.operationsFailed++;
        result.status = result.operationsExecuted > 0 ? 'PARTIAL' : 'FAILED';
        result.errors.push({
          index: i,
          message: err.message || String(error),
          isLockError: this.isLockError(error),
          sql: op.sql,
        });

        if (config.stopOnError) {
          return;
        }
      }
    }
  }

  private async replayParallel(
    record: ReplayRecord,
    operations: ReplayOperation[],
    logger: Logger,
    result: ReplayResult,
    config: Partial<ReplayConfig>,
    service: DatabaseService
  ): Promise<void> {
    const maxParallel = config.maxParallelOperations || 5;
    let index = 0;

    while (index < operations.length) {
      const batch = operations.slice(index, index + maxParallel);
      const promises = batch.map((op, i) => this.executeOperationWithResult(service, op, index + i));

      const results = await Promise.allSettled(promises);

      results.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          result.operationsExecuted++;
        } else {
          const err = res.reason as { message?: string; code?: string };
          result.operationsFailed++;
          result.errors.push({
            index: index + i,
            message: err.message || String(res.reason),
            isLockError: this.isLockError(res.reason),
            sql: batch[i].sql,
          });
        }
      });

      if (result.operationsFailed > 0 && config.stopOnError) {
        result.status = result.operationsExecuted > 0 ? 'PARTIAL' : 'FAILED';
        return;
      }

      index += maxParallel;
    }

    result.status = result.operationsFailed === 0 ? 'SUCCESS' : 'PARTIAL';
  }

  private async replayTimeline(
    record: ReplayRecord,
    operations: ReplayOperation[],
    logger: Logger,
    result: ReplayResult,
    config: Partial<ReplayConfig>,
    service: DatabaseService
  ): Promise<void> {
    if (operations.length === 0) return;

    const firstTimestamp = record.logEntries[0]?.timestamp || Date.now();
    let executionIndex = 0;

    const executeTimeline = async (): Promise<void> => {
      while (executionIndex < operations.length) {
        const op = operations[executionIndex];
        const opTimestamp = record.logEntries.find(
          (l) => l.sql === op.sql && l.operationType === op.type
        )?.timestamp || firstTimestamp;

        const delay = Math.max(0, opTimestamp - firstTimestamp - (Date.now() - firstTimestamp));

        if (delay > 0 && config.timingAccuracy !== 'IGNORE') {
          await this.sleep(delay);
        }

        const originalDuration = record.logEntries.find(
          (l) => l.sql === op.sql && l.operationType === op.type
        )?.duration || 0;

        const opStartTime = Date.now();

        try {
          await this.executeOperation(service, op);
          result.operationsExecuted++;
          result.timingMetrics.push({
            index: executionIndex,
            originalDuration,
            replayDuration: Date.now() - opStartTime,
          });
        } catch (error) {
          const err = error as { message?: string; code?: string };
          result.operationsFailed++;
          result.status = result.operationsExecuted > 0 ? 'PARTIAL' : 'FAILED';
          result.errors.push({
            index: executionIndex,
            message: err.message || String(error),
            isLockError: this.isLockError(error),
            sql: op.sql,
          });

          if (config.stopOnError) {
            return;
          }
        }

        executionIndex++;
      }
    };

    await executeTimeline();
  }

  private async executeOperation(
    service: DatabaseService,
    op: ReplayOperation
  ): Promise<void> {
    if (op.type === 'WRITE' || op.type === 'BEGIN_TRANSACTION') {
      await service.run(op.sql, op.params);
    } else if (op.type === 'READ') {
      await service.all(op.sql, op.params);
    }
  }

  private async executeOperationWithResult(
    service: DatabaseService,
    op: ReplayOperation,
    index: number
  ): Promise<{ index: number; success: boolean }> {
    await this.executeOperation(service, op);
    return { index, success: true };
  }

  private extractWriteOperations(logEntries: LogEntry[]): ReplayOperation[] {
    const operations: ReplayOperation[] = [];

    for (const entry of logEntries) {
      if (entry.sql && entry.status !== 'PENDING') {
        operations.push({
          type: entry.operationType,
          sql: entry.sql,
          params: entry.params,
          timestamp: entry.timestamp,
        });
      }
    }

    return operations;
  }

  private checkErrorMatch(
    originalContext: ErrorContext,
    result: ReplayResult
  ): boolean {
    const replayLockErrors = result.errors.filter((e) => e.isLockError);

    if (originalContext.error.isLockError) {
      return replayLockErrors.length > 0;
    }

    if (result.errors.length > 0) {
      return result.errors.some((e) =>
        e.message === originalContext.error.message
      );
    }

    return false;
  }

  private isLockError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const err = error as { code?: string };
    const lockCodes = [
      'SQLITE_BUSY',
      'SQLITE_LOCKED',
      'SQLITE_BUSY_SNAPSHOT',
      'SQLITE_BUSY_RECOVERY',
      'SQLITE_IOERR_LOCK',
    ];
    return lockCodes.includes(err.code || '');
  }

  private getSystemInfo(): SystemInfo {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

interface ReplayOperation {
  type: 'READ' | 'WRITE' | 'BEGIN_TRANSACTION' | 'COMMIT' | 'ROLLBACK';
  sql: string;
  params?: unknown[];
  timestamp: number;
}
