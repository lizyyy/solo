import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { createHash } from 'crypto';

export interface RequestRecord {
  id: string;
  requestKey: string;
  requestHash: string;
  requestType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: string;
  processingAt?: string;
  completedAt?: string;
  expiresAt: string;
  retries: number;
}

export interface IdempotencyConfig {
  defaultTTL: number;
  maxRetries: number;
  cleanupInterval: number;
}

const defaultConfig: IdempotencyConfig = {
  defaultTTL: 24 * 60 * 60 * 1000,
  maxRetries: 3,
  cleanupInterval: 60 * 60 * 1000,
};

export type RequestType = 
  | 'import_announcement'
  | 'import_shares'
  | 'import_choices'
  | 'import_settlements'
  | 'calculate_dividend'
  | 'reconcile_settlement'
  | 'generate_report'
  | 'batch_process';

export class IdempotencyManager {
  private config: IdempotencyConfig;
  private requests: Map<string, RequestRecord> = new Map();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config?: Partial<IdempotencyConfig>) {
    this.config = { ...defaultConfig, ...config };
    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupInterval);
  }

  private cleanupExpired(): void {
    const now = dayjs();
    for (const [key, record] of this.requests.entries()) {
      if (dayjs(record.expiresAt).isBefore(now)) {
        this.requests.delete(key);
      }
    }
  }

  public generateKey(
    requestType: RequestType,
    identifiers: Record<string, string | number>
  ): string {
    const sortedKeys = Object.keys(identifiers).sort();
    const parts = sortedKeys.map(k => `${k}:${identifiers[k]}`).join('|');
    return `${requestType}:${parts}`;
  }

  private generateHash(data: any): string {
    const normalized = JSON.stringify(data, Object.keys(data).sort());
    return createHash('sha256').update(normalized).digest('hex');
  }

  public checkRequest(
    key: string,
    requestData?: any
  ): {
    isDuplicate: boolean;
    record?: RequestRecord;
    shouldProcess: boolean;
  } {
    const existing = this.requests.get(key);
    
    if (!existing) {
      return { isDuplicate: false, shouldProcess: true };
    }

    if (requestData) {
      const newHash = this.generateHash(requestData);
      if (existing.requestHash !== newHash) {
        return {
          isDuplicate: true,
          record: existing,
          shouldProcess: false,
        };
      }
    }

    switch (existing.status) {
      case 'completed':
        return {
          isDuplicate: true,
          record: existing,
          shouldProcess: false,
        };
      case 'processing':
        return {
          isDuplicate: true,
          record: existing,
          shouldProcess: false,
        };
      case 'failed':
        if (existing.retries < this.config.maxRetries) {
          return {
            isDuplicate: true,
            record: existing,
            shouldProcess: true,
          };
        }
        return {
          isDuplicate: true,
          record: existing,
          shouldProcess: false,
        };
      default:
        return {
          isDuplicate: true,
          record: existing,
          shouldProcess: true,
        };
    }
  }

  public startRequest(
    key: string,
    requestType: RequestType,
    requestData?: any,
    ttl?: number
  ): RequestRecord {
    const existing = this.requests.get(key);
    
    if (existing) {
      existing.status = 'processing';
      existing.processingAt = dayjs().toISOString();
      existing.retries += 1;
      this.requests.set(key, existing);
      return existing;
    }

    const record: RequestRecord = {
      id: uuidv4(),
      requestKey: key,
      requestHash: requestData ? this.generateHash(requestData) : '',
      requestType,
      status: 'processing',
      createdAt: dayjs().toISOString(),
      processingAt: dayjs().toISOString(),
      expiresAt: dayjs().add(ttl || this.config.defaultTTL, 'millisecond').toISOString(),
      retries: 0,
    };

    this.requests.set(key, record);
    return record;
  }

  public completeRequest(key: string, result: any): RequestRecord | null {
    const record = this.requests.get(key);
    if (!record) return null;

    record.status = 'completed';
    record.completedAt = dayjs().toISOString();
    record.result = this.sanitizeResult(result);
    
    this.requests.set(key, record);
    return record;
  }

  public failRequest(key: string, error: string): RequestRecord | null {
    const record = this.requests.get(key);
    if (!record) return null;

    record.status = 'failed';
    record.completedAt = dayjs().toISOString();
    record.error = error;
    
    this.requests.set(key, record);
    return record;
  }

  private sanitizeResult(result: any): any {
    try {
      return JSON.parse(JSON.stringify(result));
    } catch {
      return String(result);
    }
  }

  public getRequest(key: string): RequestRecord | null {
    return this.requests.get(key) || null;
  }

  public getResult<T = any>(key: string): T | null {
    const record = this.requests.get(key);
    if (record && record.status === 'completed') {
      return record.result as T;
    }
    return null;
  }

  public getRequestsByType(type: RequestType): RequestRecord[] {
    return Array.from(this.requests.values())
      .filter(r => r.requestType === type)
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
  }

  public getRecentRequests(limit: number = 100): RequestRecord[] {
    return Array.from(this.requests.values())
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
      .slice(0, limit);
  }

  public getStatistics(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const stats = {
      total: this.requests.size,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const record of this.requests.values()) {
      stats[record.status]++;
    }

    return stats;
  }

  public clearExpired(): number {
    const now = dayjs();
    let cleared = 0;
    
    for (const [key, record] of this.requests.entries()) {
      if (dayjs(record.expiresAt).isBefore(now)) {
        this.requests.delete(key);
        cleared++;
      }
    }
    
    return cleared;
  }

  public clearAll(): void {
    this.requests.clear();
  }

  public dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  public wrapAsync<T>(
    key: string,
    requestType: RequestType,
    fn: () => Promise<T>,
    requestData?: any,
    ttl?: number
  ): Promise<T> {
    const check = this.checkRequest(key, requestData);
    
    if (check.isDuplicate && !check.shouldProcess) {
      if (check.record?.status === 'completed') {
        return Promise.resolve(check.record.result as T);
      }
      throw new Error(`请求正在处理中或已失败，请稍后重试。Key: ${key}`);
    }

    this.startRequest(key, requestType, requestData, ttl);

    return fn()
      .then(result => {
        this.completeRequest(key, result);
        return result;
      })
      .catch(error => {
        this.failRequest(key, error.message || String(error));
        throw error;
      });
  }

  public generateImportKey(
    importType: 'announcement' | 'shares' | 'choices' | 'settlements',
    fileName: string,
    fileHash: string
  ): string {
    return this.generateKey(`import_${importType}` as RequestType, {
      fileName,
      fileHash,
    });
  }

  public generateCalculationKey(
    fundId: string,
    announcementId: string,
    batchId?: string
  ): string {
    const identifiers: Record<string, string> = {
      fundId,
      announcementId,
    };
    if (batchId) {
      identifiers.batchId = batchId;
    }
    return this.generateKey('calculate_dividend', identifiers);
  }

  public generateReportKey(
    taskId: string,
    reportType: string,
    format: string
  ): string {
    return this.generateKey('generate_report', {
      taskId,
      reportType,
      format,
    });
  }
}
