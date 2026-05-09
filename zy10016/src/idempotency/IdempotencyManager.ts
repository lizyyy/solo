import { v4 as uuidv4 } from 'uuid';
import { IdempotencyRecord, OperationMetadata } from '../types';

export interface IdempotencyConfig {
  recordTTL: number;
  maxRecords: number;
  cleanupInterval: number;
}

type RecordStatus = 'PENDING' | 'EXECUTING' | 'EXECUTED' | 'ROLLING_BACK' | 'ROLLED_BACK' | 'FAILED';

export class IdempotencyManager {
  private readonly config: IdempotencyConfig;
  private readonly records = new Map<string, IdempotencyRecord>();
  private readonly operations = new Map<string, OperationMetadata>();
  private readonly inProgressOperations = new Map<string, Promise<unknown>>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<IdempotencyConfig>) {
    this.config = {
      recordTTL: config?.recordTTL || 24 * 60 * 60 * 1000,
      maxRecords: config?.maxRecords || 10000,
      cleanupInterval: config?.cleanupInterval || 60 * 1000,
    };

    this.startCleanup();
  }

  registerOperation(metadata: OperationMetadata): void {
    this.operations.set(metadata.id, metadata);
  }

  getOperation(id: string): OperationMetadata | undefined {
    return this.operations.get(id);
  }

  async execute<T>(
    operationId: string,
    operationName: string,
    execute: () => Promise<T>,
    options?: {
      isIdempotent?: boolean;
      transactionId?: string;
    }
  ): Promise<T> {
    const key = this.generateKey(operationId, options?.transactionId);

    const existingRecord = this.records.get(key);

    if (existingRecord) {
      return this.handleExistingRecord<T>(key, existingRecord);
    }

    const inProgress = this.inProgressOperations.get(key);
    if (inProgress) {
      return inProgress as Promise<T>;
    }

    const record: IdempotencyRecord = {
      id: uuidv4(),
      operationId,
      operationName,
      executedAt: Date.now(),
      executionResult: null,
      transactionId: options?.transactionId,
      status: 'EXECUTING',
    };

    this.records.set(key, record);

    const promise = (async (): Promise<T> => {
      try {
        const result = await execute();
        record.executionResult = result;
        record.status = 'EXECUTED';
        return result;
      } catch (error) {
        record.status = 'FAILED';
        throw error;
      } finally {
        this.inProgressOperations.delete(key);
      }
    })();

    this.inProgressOperations.set(key, promise);

    return promise as Promise<T>;
  }

  async rollback(operationId: string, transactionId?: string): Promise<void> {
    const key = this.generateKey(operationId, transactionId);
    const record = this.records.get(key);

    if (!record) {
      throw new Error(`Operation record not found: ${operationId}`);
    }

    record.status = 'ROLLING_BACK';
    this.records.set(key, record);

    await new Promise((resolve) => setTimeout(resolve, 100));

    record.status = 'ROLLED_BACK';
    this.records.set(key, record);
  }

  getRecord(operationId: string, transactionId?: string): IdempotencyRecord | undefined {
    const key = this.generateKey(operationId, transactionId);
    return this.records.get(key);
  }

  hasExecuted(operationId: string, transactionId?: string): boolean {
    const key = this.generateKey(operationId, transactionId);
    const record = this.records.get(key);
    return record?.status === 'EXECUTED';
  }

  getStatus(operationId: string, transactionId?: string): RecordStatus | undefined {
    const key = this.generateKey(operationId, transactionId);
    const record = this.records.get(key);
    if (!record) return undefined;
    return record.status as RecordStatus;
  }

  getAllRecords(): IdempotencyRecord[] {
    return Array.from(this.records.values());
  }

  clearRecords(): void {
    this.records.clear();
    this.inProgressOperations.clear();
  }

  private async handleExistingRecord<T>(
    key: string,
    record: IdempotencyRecord
  ): Promise<T> {
    switch (record.status) {
      case 'EXECUTED':
        return record.executionResult as T;

      case 'EXECUTING':
        const inProgress = this.inProgressOperations.get(key);
        if (inProgress) {
          return inProgress as Promise<T>;
        }
        throw new Error('Operation is executing but not in progress map');

      case 'FAILED':
        throw new Error('Previous operation failed');

      case 'ROLLED_BACK':
        throw new Error('Operation has been rolled back');

      default:
        throw new Error(`Invalid operation status: ${record.status}`);
    }
  }

  private generateKey(operationId: string, transactionId?: string): string {
    if (transactionId) {
      return `${transactionId}:${operationId}`;
    }
    return operationId;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    const ttl = this.config.recordTTL;

    for (const [key, record] of this.records.entries()) {
      const age = now - record.executedAt;
      if (age > ttl) {
        this.records.delete(key);
      }
    }

    if (this.records.size > this.config.maxRecords) {
      const sorted = Array.from(this.records.entries()).sort(
        (a, b) => a[1].executedAt - b[1].executedAt
      );

      const toRemove = sorted.slice(0, this.records.size - this.config.maxRecords);
      for (const [key] of toRemove) {
        this.records.delete(key);
      }
    }
  }

  close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
