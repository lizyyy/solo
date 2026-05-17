export enum RecycleStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  ERROR = 'error'
}

export interface GrayScope {
  type: 'percentage' | 'tenant_list' | 'tag';
  value: number | string[];
}

export interface RecycleReport {
  recycledCount: number;
  failedCount: number;
  details: Array<{
    tenantId: string;
    status: 'success' | 'failed';
    message?: string;
  }>;
  completedAt: Date;
}

export interface ExceptionRecord {
  id: string;
  originalInput: any;
  errorMessage: string;
  handler: string;
  handledAt: Date;
  resolution: string;
}

export interface GrayConfigRecycle {
  id: string;
  configKey: string;
  grayScope: GrayScope;
  owner: string;
  recycleDate: Date;
  hitTenants: string[];
  status: RecycleStatus;
  report?: RecycleReport;
  exceptions: ExceptionRecord[];
  createdAt: Date;
  updatedAt: Date;
  remindersSent: number;
  lastReminderAt?: Date;
}

export interface CreateRecycleRequest {
  configKey: string;
  grayScope: GrayScope;
  owner: string;
  recycleDate: string;
  hitTenants?: string[];
}

export interface QueryRecycleRequest {
  configKey?: string;
  owner?: string;
  status?: RecycleStatus;
  page?: number;
  pageSize?: number;
}

export interface QueryRecycleResponse {
  data: GrayConfigRecycle[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StatusTransitionRequest {
  status: RecycleStatus;
  operator: string;
  remark?: string;
}

export interface ExceptionHandleRequest {
  handler: string;
  resolution: string;
}

export interface ManualCorrectionRequest {
  configKey?: string;
  grayScope?: GrayScope;
  owner?: string;
  recycleDate?: string;
  hitTenants?: string[];
  operator: string;
  reason: string;
}
