export type Role = '班长' | '操作员' | '管理员';

export type ShiftType = '白班' | '中班' | '夜班';

export type LockStatus = 'pending' | 'active' | 'released' | 'expired' | 'exception';

export type OperationResult = 'allowed' | 'blocked';

export type AuditAction = 
  | 'schedule_create'
  | 'schedule_update'
  | 'schedule_delete'
  | 'lock_acquire'
  | 'lock_release'
  | 'lock_exception'
  | 'forklift_update'
  | 'charging_pile_update'
  | 'daily_report';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface OperatorInfo {
  operator: string;
  role: Role;
  operationTime: string;
}

export interface ResultWithReason<T = any> {
  success: boolean;
  result?: T;
  reason: string;
  operationResult: OperationResult;
  idempotentKey?: string;
}
