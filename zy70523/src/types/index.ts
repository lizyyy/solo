export enum FilingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  BLOCKED = 'blocked',
  REVOKED = 'revoked',
  COMPENSATED = 'compensated',
  CLOSED = 'closed',
  EXPIRED = 'expired'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface OpenWindow {
  startTime: string;
  endTime: string;
  timezone?: string;
}

export interface CloseCondition {
  type: 'manual' | 'auto' | 'timeout';
  trigger?: string;
  reason?: string;
}

export interface ExceptionTrace {
  id: string;
  filingId: string;
  timestamp: string;
  step: string;
  originalInput: Record<string, any>;
  processingBasis: string;
  conclusion: string;
  errorCode?: string;
  errorMessage?: string;
  operator?: string;
}

export interface AccessLog {
  id: string;
  filingId: string;
  timestamp: string;
  sourceIp: string;
  destination: string;
  action: string;
  result: string;
}

export interface StatusHistory {
  id: string;
  filingId: string;
  fromStatus?: FilingStatus;
  toStatus: FilingStatus;
  timestamp: string;
  operator?: string;
  reason: string;
}

export interface FilingRecord {
  id: string;
  serviceName: string;
  egressAddress: string;
  openWindow: OpenWindow;
  purpose: string;
  closeCondition: CloseCondition;
  status: FilingStatus;
  approvalStatus: ApprovalStatus;
  approver?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  creator: string;
  closedAt?: string;
  closer?: string;
  closeReason?: string;
}

export interface FilingReport {
  filingId: string;
  generatedAt: string;
  summary: {
    serviceName: string;
    openDuration: number;
    accessCount: number;
    statusChanges: number;
  };
  details: {
    statusHistory: StatusHistory[];
    accessLogs: AccessLog[];
    exceptions: ExceptionTrace[];
  };
  conclusion: string;
}

export interface CreateFilingRequest {
  serviceName: string;
  egressAddress: string;
  openWindow: OpenWindow;
  purpose: string;
  closeCondition: CloseCondition;
  creator: string;
}

export interface AdvanceStatusRequest {
  targetStatus: FilingStatus;
  operator?: string;
  reason: string;
  approvalRequired?: boolean;
}

export interface HandleExceptionRequest {
  step: string;
  originalInput: Record<string, any>;
  processingBasis: string;
  conclusion: string;
  errorCode?: string;
  errorMessage?: string;
  operator?: string;
}

export interface ManualCorrectionRequest {
  field: string;
  oldValue: any;
  newValue: any;
  operator: string;
  reason: string;
}
