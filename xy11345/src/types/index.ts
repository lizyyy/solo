export enum BatchStatus {
  IMPORTED = 'imported',
  PENDING_JUDGMENT = 'pending_judgment',
  PASSED = 'passed',
  FAILED = 'failed',
  PENDING_REVIEW = 'pending_review',
  REVIEWED = 'reviewed',
  REWORKED = 'reworked',
  COMPLETED = 'completed'
}

export enum ReviewResult {
  CONFIRM_PASS = 'confirm_pass',
  CONFIRM_FAIL = 'confirm_fail',
  NEED_REWORK = 'need_rework'
}

export enum UserRole {
  OPERATOR = 'operator',
  QC = 'qc',
  ADMIN = 'admin'
}

export interface LabValue {
  L: number;
  a: number;
  b: number;
  deltaE?: number;
}

export interface StandardLabValue extends LabValue {
  tolerance: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  timestamp: number;
  requestId: string;
}

export interface ImportResult {
  successCount: number;
  failedCount: number;
  skippedCount: number;
  errors: string[];
  batchIds: string[];
}
