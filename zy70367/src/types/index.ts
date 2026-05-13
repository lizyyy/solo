export enum BatchStatus {
  CREATED = 'created',
  PRECHECKING = 'prechecking',
  PRECHECKED = 'prechecked',
  IMPORTING = 'importing',
  PARTIALLY_COMPLETED = 'partially_completed',
  COMPLETED = 'completed',
  REVOKING = 'revoking',
  PARTIALLY_REVOKED = 'partially_revoked',
  REVOKED = 'revoked',
  FAILED = 'failed'
}

export enum RecordStatus {
  PENDING = 'pending',
  CREATED = 'created',
  UPDATED = 'updated',
  SKIPPED = 'skipped',
  FAILED = 'failed',
  REVOKING = 'revoking',
  REVOKED = 'revoked',
  REVOKE_FAILED = 'revoke_failed',
  NOT_REVOCABLE = 'not_revocable'
}

export enum PrecheckWarningType {
  USER_EXISTS = 'user_exists',
  ROLE_NOT_FOUND = 'role_not_found',
  DEPARTMENT_NOT_FOUND = 'department_not_found',
  DUPLICATE_EMAIL = 'duplicate_email',
  INVALID_DATA = 'invalid_data'
}

export interface User {
  id: string;
  email: string;
  name: string;
  departmentId?: string;
  roleIds: string[];
  createdAt: number;
  updatedAt: number;
  sourceBatchId?: string;
  originalUser: boolean;
}

export interface ImportBatch {
  id: string;
  name: string;
  status: BatchStatus;
  creatorId: string;
  createdAt: number;
  updatedAt: number;
  totalRecords: number;
  successCount: number;
  failCount: number;
  revokeCount: number;
  precheckWarnings: PrecheckWarning[];
}

export interface ImportRecord {
  id: string;
  batchId: string;
  email: string;
  name: string;
  departmentId?: string;
  roleIds: string[];
  originalRoleIds?: string[];
  status: RecordStatus;
  errorMessage?: string;
  revokeErrorMessage?: string;
  isPreExisting: boolean;
  precheckWarnings: PrecheckWarning[];
  createdAt: number;
  updatedAt: number;
}

export interface PrecheckWarning {
  type: PrecheckWarningType;
  message: string;
  detail?: any;
}

export interface BatchReport {
  batchId: string;
  batchName: string;
  status: BatchStatus;
  summary: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    revoked: number;
    notRevocable: number;
    revokeFailed: number;
  };
  records: {
    email: string;
    name: string;
    status: RecordStatus;
    isPreExisting: boolean;
    canBeRevoked: boolean;
    errorMessage?: string;
    revokeErrorMessage?: string;
  }[];
  warnings: PrecheckWarning[];
}

export interface MappingConfig {
  emailColumn: string;
  nameColumn: string;
  departmentColumn: string;
  roleColumn: string;
  departmentMappings: Record<string, string>;
  roleMappings: Record<string, string>;
}
