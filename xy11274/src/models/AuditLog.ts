import { BaseEntity, AuditAction, OperationResult, Role } from './types';

export interface AuditLog extends BaseEntity {
  action: AuditAction;
  entityId?: string;
  entityType?: string;
  operator: string;
  role: Role;
  operationResult: OperationResult;
  reason: string;
  details?: Record<string, any>;
  idempotentKey?: string;
}

export interface AuditLogCreateInput {
  action: AuditAction;
  entityId?: string;
  entityType?: string;
  operator: string;
  role: Role;
  operationResult: OperationResult;
  reason: string;
  details?: Record<string, any>;
  idempotentKey?: string;
}
