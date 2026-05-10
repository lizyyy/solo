import { IdempotencyError, ValidationError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

interface IdempotencyRecord {
  id: string;
  key: string;
  action: string;
  entityId?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

class InMemoryIdempotencyStore {
  private records: Map<string, IdempotencyRecord> = new Map();

  create(
    key: string,
    action: string,
    entityId?: string
  ): IdempotencyRecord {
    const record: IdempotencyRecord = {
      id: uuidv4(),
      key,
      action,
      entityId,
      status: 'PENDING',
      createdAt: new Date()
    };

    this.records.set(key, record);
    return record;
  }

  findByKey(key: string): IdempotencyRecord | undefined {
    return this.records.get(key);
  }

  update(
    key: string,
    updates: Partial<Omit<IdempotencyRecord, 'id' | 'key' | 'action' | 'entityId' | 'createdAt'>>
  ): IdempotencyRecord | undefined {
    const record = this.records.get(key);
    if (!record) return undefined;

    const updated = { ...record, ...updates };
    this.records.set(key, updated);
    return updated;
  }

  markCompleted(key: string, result: any): IdempotencyRecord | undefined {
    return this.update(key, {
      status: 'COMPLETED',
      result,
      completedAt: new Date()
    });
  }

  markFailed(key: string, error: string): IdempotencyRecord | undefined {
    return this.update(key, {
      status: 'FAILED',
      error,
      completedAt: new Date()
    });
  }
}

export class IdempotencyService {
  private store: InMemoryIdempotencyStore;
  private actionDescriptions: Record<string, string>;

  constructor() {
    this.store = new InMemoryIdempotencyStore();
    this.actionDescriptions = {
      'create_budget_version': '创建预算版本',
      'submit_budget_version': '提交预算版本',
      'approve_budget_version': '审批预算版本',
      'lock_budget_version': '锁定预算版本',
      'create_department_submission': '创建部门提交',
      'submit_department_submission': '提交部门提交',
      'approve_department_submission': '审批部门提交',
      'create_lock_window': '创建锁定窗口',
      'request_rollback': '申请回退',
      'approve_rollback': '批准回退',
      'create_difference_note': '创建差异说明',
      'generate_report': '生成报表'
    };
  }

  generateKey(entityType: string, entityId: string, action: string): string {
    return `${entityType}:${entityId}:${action}`;
  }

  getActionDescription(action: string): string {
    return this.actionDescriptions[action] || action;
  }

  startOperation(
    key: string,
    action: string,
    entityId?: string
  ): IdempotencyRecord {
    const existing = this.store.findByKey(key);

    if (existing) {
      if (existing.status === 'PENDING') {
        throw new IdempotencyError(
          `${this.getActionDescription(action)}正在处理中，请稍后再试。` +
          `该操作已在 ${existing.createdAt.toLocaleString()} 开始执行`
        );
      }

      if (existing.status === 'COMPLETED') {
        throw new IdempotencyError(
          `${this.getActionDescription(action)}已成功执行过，无需重复操作。` +
          `操作完成时间：${existing.completedAt?.toLocaleString()}`
        );
      }

      if (existing.status === 'FAILED') {
        throw new ValidationError(
          `${this.getActionDescription(action)}上次执行失败。` +
          `失败时间：${existing.completedAt?.toLocaleString()}，` +
          `失败原因：${existing.error}。请修复问题后重试。`
        );
      }
    }

    return this.store.create(key, action, entityId);
  }

  completeOperation(key: string, result: any): IdempotencyRecord | undefined {
    return this.store.markCompleted(key, result);
  }

  failOperation(key: string, error: string): IdempotencyRecord | undefined {
    return this.store.markFailed(key, error);
  }

  checkOperation(key: string): IdempotencyRecord | undefined {
    return this.store.findByKey(key);
  }

  canRetry(key: string): boolean {
    const record = this.store.findByKey(key);
    if (!record) return true;
    return record.status !== 'COMPLETED' && record.status !== 'PENDING';
  }

  clearOperation(key: string): boolean {
    const record = this.store.findByKey(key);
    if (record && record.status === 'FAILED') {
      // 对于失败的操作，允许清除后重试
      this.store['records'].delete(key);
      return true;
    }
    return false;
  }

  wrapOperation<T>(
    key: string,
    action: string,
    operation: () => Promise<T>,
    entityId?: string
  ): Promise<T> {
    return this.executeWithIdempotency(key, action, operation, entityId);
  }

  async executeWithIdempotency<T>(
    key: string,
    action: string,
    operation: () => Promise<T>,
    entityId?: string
  ): Promise<T> {
    try {
      this.startOperation(key, action, entityId);

      try {
        const result = await operation();
        this.completeOperation(key, result);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.failOperation(key, errorMessage);
        throw error;
      }
    } catch (error) {
      if (error instanceof IdempotencyError) {
        const record = this.checkOperation(key);
        if (record?.status === 'COMPLETED') {
          return record.result as T;
        }
      }
      throw error;
    }
  }
}

export const idempotencyService = new IdempotencyService();
