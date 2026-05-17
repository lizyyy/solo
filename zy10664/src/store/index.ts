import { v4 as uuidv4 } from 'uuid';
import {
  Task,
  TaskStatus,
  RecoveryCondition,
  FailureRecord,
  AuditHistory,
  AuditAction
} from '../types';

class DataStore {
  private tasks: Map<string, Task> = new Map();
  private recoveryConditions: Map<string, RecoveryCondition[]> = new Map();
  private failureRecords: Map<string, FailureRecord[]> = new Map();
  private auditHistories: Map<string, AuditHistory[]> = new Map();

  createTask(data: Omit<Task, 'id' | 'status' | 'failureCount' | 'hasQueuedRetry' | 'createdAt' | 'updatedAt'>): Task {
    const now = new Date();
    const task: Task = {
      id: uuidv4(),
      ...data,
      status: TaskStatus.RUNNING,
      failureCount: 0,
      hasQueuedRetry: false,
      createdAt: now,
      updatedAt: now
    };
    this.tasks.set(task.id, task);
    this.recoveryConditions.set(task.id, []);
    this.failureRecords.set(task.id, []);
    this.auditHistories.set(task.id, []);
    return task;
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getTaskByCode(taskCode: string): Task | undefined {
    for (const task of this.tasks.values()) {
      if (task.taskCode === taskCode) {
        return task;
      }
    }
    return undefined;
  }

  updateTask(id: string, data: Partial<Task>): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    const updated = { ...task, ...data, updatedAt: new Date() };
    this.tasks.set(id, updated);
    return updated;
  }

  listTasks(query?: {
    status?: TaskStatus;
    taskCode?: string;
    schedulerName?: string;
    page?: number;
    pageSize?: number;
  }): { total: number; data: Task[] } {
    let result = Array.from(this.tasks.values());
    
    if (query?.status) {
      result = result.filter(t => t.status === query.status);
    }
    if (query?.taskCode) {
      result = result.filter(t => t.taskCode.includes(query.taskCode!));
    }
    if (query?.schedulerName) {
      result = result.filter(t => t.schedulerName.includes(query.schedulerName!));
    }

    const total = result.length;
    
    if (query?.page && query?.pageSize) {
      const start = (query.page - 1) * query.pageSize;
      result = result.slice(start, start + query.pageSize);
    }

    return { total, data: result };
  }

  addRecoveryCondition(taskId: string, data: Omit<RecoveryCondition, 'id' | 'taskId' | 'isMet' | 'createdAt'>): RecoveryCondition {
    const condition: RecoveryCondition = {
      id: uuidv4(),
      taskId,
      ...data,
      isMet: false,
      createdAt: new Date()
    };
    const conditions = this.recoveryConditions.get(taskId) || [];
    conditions.push(condition);
    this.recoveryConditions.set(taskId, conditions);
    return condition;
  }

  getRecoveryConditions(taskId: string): RecoveryCondition[] {
    return this.recoveryConditions.get(taskId) || [];
  }

  updateRecoveryCondition(conditionId: string, data: Partial<RecoveryCondition>): RecoveryCondition | undefined {
    for (const [taskId, conditions] of this.recoveryConditions.entries()) {
      const index = conditions.findIndex(c => c.id === conditionId);
      if (index !== -1) {
        conditions[index] = { ...conditions[index], ...data };
        this.recoveryConditions.set(taskId, conditions);
        return conditions[index];
      }
    }
    return undefined;
  }

  addFailureRecord(taskId: string, data: Omit<FailureRecord, 'id' | 'taskId'>): FailureRecord {
    const record: FailureRecord = {
      id: uuidv4(),
      taskId,
      ...data
    };
    const records = this.failureRecords.get(taskId) || [];
    records.push(record);
    this.failureRecords.set(taskId, records);
    return record;
  }

  getFailureRecords(taskId: string): FailureRecord[] {
    return this.failureRecords.get(taskId) || [];
  }

  updateFailureRecord(recordId: string, data: Partial<FailureRecord>): FailureRecord | undefined {
    for (const [taskId, records] of this.failureRecords.entries()) {
      const index = records.findIndex(r => r.id === recordId);
      if (index !== -1) {
        records[index] = { ...records[index], ...data };
        this.failureRecords.set(taskId, records);
        return records[index];
      }
    }
    return undefined;
  }

  addAuditHistory(taskId: string, data: Omit<AuditHistory, 'id' | 'taskId' | 'createdAt'>): AuditHistory {
    const history: AuditHistory = {
      id: uuidv4(),
      taskId,
      ...data,
      createdAt: new Date()
    };
    const histories = this.auditHistories.get(taskId) || [];
    histories.push(history);
    this.auditHistories.set(taskId, histories);
    return history;
  }

  getAuditHistories(taskId: string): AuditHistory[] {
    return this.auditHistories.get(taskId) || [];
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  clearAll(): void {
    this.tasks.clear();
    this.recoveryConditions.clear();
    this.failureRecords.clear();
    this.auditHistories.clear();
  }
}

export const store = new DataStore();
