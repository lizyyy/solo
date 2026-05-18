export enum WhitelistStatus {
  ACTIVE = 'ACTIVE',
  PENDING_EXPIRE = 'PENDING_EXPIRE',
  EXPIRED = 'EXPIRED',
  RESTORE_REQUESTED = 'RESTORE_REQUESTED'
}

export enum OperationType {
  CREATE = 'CREATE',
  IMPORT = 'IMPORT',
  UPDATE = 'UPDATE',
  SUBMIT_EXPIRE = 'SUBMIT_EXPIRE',
  APPROVE_EXPIRE = 'APPROVE_EXPIRE',
  REJECT_EXPIRE = 'REJECT_EXPIRE',
  WITHDRAW = 'WITHDRAW',
  RESTORE_REQUEST = 'RESTORE_REQUEST',
  APPROVE_RESTORE = 'APPROVE_RESTORE',
  REJECT_RESTORE = 'REJECT_RESTORE',
  REMARK = 'REMARK'
}

export interface WhitelistRecord {
  id: string;
  account: string;
  reason: string;
  validFrom: string;
  validTo: string;
  auditor: string;
  status: WhitelistStatus;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface WhitelistHistory {
  id: string;
  recordId: string;
  operationType: OperationType;
  oldStatus?: WhitelistStatus;
  newStatus?: WhitelistStatus;
  oldData?: string;
  newData?: string;
  remark?: string;
  operator: string;
  operatedAt: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: {
    row: number;
    account: string;
    reason: string;
  }[];
}

export interface AuditCheckResult {
  shouldBypass: boolean;
  reason?: string;
  cachedAt?: string;
}
