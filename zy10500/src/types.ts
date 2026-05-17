export enum ChangeOrderStatus {
  CREATED = 'CREATED',
  DEPENDENCIES_FREEZING = 'DEPENDENCIES_FREEZING',
  ALL_DEPENDENCIES_FROZEN = 'ALL_DEPENDENCIES_FROZEN',
  APPROVED = 'APPROVED',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  EXCEPTION = 'EXCEPTION',
  CANCELLED = 'CANCELLED'
}

export enum DependencyStatus {
  PENDING = 'PENDING',
  FROZEN = 'FROZEN',
  CONFIRMED = 'CONFIRMED',
  DELAYED = 'DELAYED',
  EXCEPTION = 'EXCEPTION'
}

export interface Dependency {
  id: string;
  serviceName: string;
  status: DependencyStatus;
  freezeWindowStart: string;
  freezeWindowEnd: string;
  confirmer?: string;
  confirmedAt?: string;
  delayReason?: string;
  delayedAt?: string;
  exceptionReason?: string;
  exceptionAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionSummary {
  timestamp: string;
  operator: string;
  action: string;
  description: string;
  originalInput?: any;
  processingBasis?: string;
}

export interface ChangeOrder {
  id: string;
  changeOrderNo: string;
  title: string;
  description: string;
  status: ChangeOrderStatus;
  dependencies: Dependency[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  executionSummaries: ExecutionSummary[];
  exceptionReason?: string;
  exceptionAt?: string;
  correctedBy?: string;
  correctedAt?: string;
}

export interface CreateChangeOrderRequest {
  changeOrderNo: string;
  title: string;
  description: string;
  createdBy: string;
  dependencies: Array<{
    serviceName: string;
    freezeWindowStart: string;
    freezeWindowEnd: string;
  }>;
}

export interface FreezeDependencyRequest {
  operator: string;
}

export interface ConfirmDependencyRequest {
  operator: string;
}

export interface DelayDependencyRequest {
  operator: string;
  reason: string;
  newFreezeWindowStart?: string;
  newFreezeWindowEnd?: string;
}

export interface ExceptionRequest {
  operator: string;
  reason: string;
}

export interface ManualCorrectionRequest {
  operator: string;
  status?: ChangeOrderStatus;
  dependencies?: Array<{
    id: string;
    status?: DependencyStatus;
    confirmer?: string;
  }>;
  reason: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
