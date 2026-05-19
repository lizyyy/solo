import { storage } from '../storage/StorageManager';
import { AuditLogCreateInput, AuditLog } from '../models/AuditLog';
import { AuditAction, OperationResult, Role } from '../models/types';
import { getCurrentTime } from '../utils/dateUtils';

export class AuditService {
  static log(input: AuditLogCreateInput): AuditLog {
    const now = getCurrentTime();
    const logEntry = storage.auditLogs.create({
      action: input.action,
      entityId: input.entityId,
      entityType: input.entityType,
      operator: input.operator,
      role: input.role as Role,
      operationResult: input.operationResult,
      reason: input.reason,
      details: input.details,
      idempotentKey: input.idempotentKey,
      createdAt: now,
      updatedAt: now,
      createdBy: input.operator,
      updatedBy: input.operator
    });
    return logEntry;
  }

  static logLockAcquire(
    entityId: string,
    operator: string,
    role: Role,
    operationResult: OperationResult,
    reason: string,
    details?: Record<string, any>,
    idempotentKey?: string
  ): AuditLog {
    return this.log({
      action: 'lock_acquire',
      entityId,
      entityType: 'LockRecord',
      operator,
      role,
      operationResult,
      reason,
      details,
      idempotentKey
    });
  }

  static logLockRelease(
    entityId: string,
    operator: string,
    role: Role,
    operationResult: OperationResult,
    reason: string,
    details?: Record<string, any>
  ): AuditLog {
    return this.log({
      action: 'lock_release',
      entityId,
      entityType: 'LockRecord',
      operator,
      role,
      operationResult,
      reason,
      details
    });
  }

  static logLockException(
    entityId: string,
    operator: string,
    role: Role,
    operationResult: OperationResult,
    reason: string,
    details?: Record<string, any>
  ): AuditLog {
    return this.log({
      action: 'lock_exception',
      entityId,
      entityType: 'LockRecord',
      operator,
      role,
      operationResult,
      reason,
      details
    });
  }

  static logScheduleCreate(
    entityId: string,
    operator: string,
    role: Role,
    operationResult: OperationResult,
    reason: string,
    details?: Record<string, any>,
    idempotentKey?: string
  ): AuditLog {
    return this.log({
      action: 'schedule_create',
      entityId,
      entityType: 'Schedule',
      operator,
      role,
      operationResult,
      reason,
      details,
      idempotentKey
    });
  }

  static logScheduleUpdate(
    entityId: string,
    operator: string,
    role: Role,
    operationResult: OperationResult,
    reason: string,
    details?: Record<string, any>
  ): AuditLog {
    return this.log({
      action: 'schedule_update',
      entityId,
      entityType: 'Schedule',
      operator,
      role,
      operationResult,
      reason,
      details
    });
  }

  static logScheduleDelete(
    entityId: string,
    operator: string,
    role: Role,
    operationResult: OperationResult,
    reason: string,
    details?: Record<string, any>
  ): AuditLog {
    return this.log({
      action: 'schedule_delete',
      entityId,
      entityType: 'Schedule',
      operator,
      role,
      operationResult,
      reason,
      details
    });
  }

  static logDailyReport(
    operator: string,
    role: Role,
    operationResult: OperationResult,
    reason: string,
    details?: Record<string, any>
  ): AuditLog {
    return this.log({
      action: 'daily_report',
      entityType: 'Report',
      operator,
      role,
      operationResult,
      reason,
      details
    });
  }

  static getLogsByEntity(entityId: string): AuditLog[] {
    return storage.auditLogs.find(log => log.entityId === entityId);
  }

  static getLogsByOperator(operator: string): AuditLog[] {
    return storage.auditLogs.find(log => log.operator === operator);
  }

  static getLogsByAction(action: AuditAction): AuditLog[] {
    return storage.auditLogs.find(log => log.action === action);
  }

  static getLogsByDateRange(startDate: string, endDate: string): AuditLog[] {
    return storage.auditLogs.find(log => {
      const logDate = log.createdAt;
      return logDate >= startDate && logDate <= endDate;
    });
  }

  static getLogsByResult(operationResult: OperationResult): AuditLog[] {
    return storage.auditLogs.find(log => log.operationResult === operationResult);
  }

  static getAllLogs(): AuditLog[] {
    return storage.auditLogs.getAll();
  }

  static getHistory(entityType: string, entityId: string): {
    logs: AuditLog[];
    summary: {
      total: number;
      allowed: number;
      blocked: number;
      actions: Record<string, number>;
    };
  } {
    const logs = storage.auditLogs.find(
      log => log.entityType === entityType && log.entityId === entityId
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const summary = {
      total: logs.length,
      allowed: logs.filter(l => l.operationResult === 'allowed').length,
      blocked: logs.filter(l => l.operationResult === 'blocked').length,
      actions: logs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    return { logs, summary };
  }
}
