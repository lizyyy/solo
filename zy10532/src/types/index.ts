export enum RecycleStatus {
  PENDING_CONFIRM = 'pending_confirm',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  EXTENDED = 'extended',
  EXCEPTION = 'exception',
  CANCELLED = 'cancelled'
}

export enum RecycleAction {
  REMOVE_PERMISSION = 'remove_permission',
  DOWNGRADE_PLAN = 'downgrade_plan',
  SUSPEND_ACCOUNT = 'suspend_account',
  NOTIFY_ONLY = 'notify_only',
  CUSTOM = 'custom'
}

export interface Tenant {
  id: string;
  tenantId: string;
  tenantName: string;
  customerName: string;
  salesPerson: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrialFeature {
  id: string;
  tenantId: string;
  featureCode: string;
  featureName: string;
  trialStartDate: string;
  trialEndDate: string;
  originalEndDate: string;
  grantedBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecycleRecord {
  id: string;
  tenantId: string;
  featureId: string;
  trialEndDate: string;
  status: RecycleStatus;
  salesConfirmStatus: 'pending' | 'confirmed' | 'denied';
  salesConfirmedAt?: string;
  salesConfirmedBy?: string;
  salesConfirmNote?: string;
  reminderCount: number;
  lastReminderAt?: string;
  recycleAction: RecycleAction;
  recycleNote?: string;
  recycledAt?: string;
  recycledBy?: string;
  extensionDays?: number;
  extensionReason?: string;
  extendedBy?: string;
  extendedAt?: string;
  summary?: string;
  rawInput?: string;
  processingEvidence?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecycleException {
  id: string;
  recycleRecordId: string;
  errorType: string;
  errorMessage: string;
  rawInput: string;
  processingEvidence: string;
  occurredAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface CreateRecycleRequest {
  tenantId: string;
  featureId: string;
  trialEndDate: string;
  recycleAction: RecycleAction;
  createdBy: string;
  rawInput?: string;
}

export interface QueryRecycleRequest {
  tenantId?: string;
  status?: RecycleStatus;
  salesPerson?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface RecycleSummary {
  totalRecords: number;
  pendingConfirm: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  extended: number;
  exception: number;
  overdueDays: number;
}
