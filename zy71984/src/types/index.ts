export enum FreezeStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  AUTO_FREEZE_APPROVED = 'AUTO_FREEZE_APPROVED',
  AUTO_FREEZE_REJECTED = 'AUTO_FREEZE_REJECTED',
  MANUAL_REVIEW_REQUIRED = 'MANUAL_REVIEW_REQUIRED',
  FROZEN = 'FROZEN',
  UNFROZEN = 'UNFROZEN',
  CANCELLED = 'CANCELLED',
  ERROR = 'ERROR'
}

export enum FreezeReason {
  FRAUD_SUSPECTED = 'FRAUD_SUSPECTED',
  RISK_ALERT = 'RISK_ALERT',
  COMPLIANCE_VIOLATION = 'COMPLIANCE_VIOLATION',
  MANUAL_REQUEST = 'MANUAL_REQUEST',
  ABNORMAL_ACTIVITY = 'ABNORMAL_ACTIVITY',
  LEGAL_REQUIREMENT = 'LEGAL_REQUIREMENT'
}

export enum ParameterSource {
  ALARM_RECORD = 'ALARM_RECORD',
  OLD_API_DOCUMENT = 'OLD_API_DOCUMENT',
  NEW_API = 'NEW_API',
  UNKNOWN = 'UNKNOWN'
}

export interface AccountFreezeRequest {
  requestId: string;
  accountId: string;
  accountName: string;
  freezeReason: FreezeReason;
  reasonDetail: string;
  operatorId?: string;
  operatorName?: string;
  clientParameters?: Record<string, unknown>;
  clientVersion?: string;
  parameterSource?: ParameterSource;
  riskScore?: number;
  createdAt: Date;
}

export interface AccountFreezeRecord {
  recordId: string;
  requestId: string;
  accountId: string;
  accountName: string;
  freezeReason: FreezeReason;
  reasonDetail: string;
  status: FreezeStatus;
  operatorId?: string;
  operatorName?: string;
  decisionReason?: string;
  nextStep?: string;
  nextStepOwner?: string;
  clientParameters?: Record<string, unknown>;
  clientVersion?: string;
  parameterSource?: ParameterSource;
  parameterValidationIssues?: ParameterIssue[];
  riskScore?: number;
  auditLogs: AuditLog[];
  createdAt: Date;
  updatedAt: Date;
  isHistorical: boolean;
}

export interface AuditLog {
  logId: string;
  timestamp: Date;
  action: string;
  operatorId?: string;
  operatorName?: string;
  reason: string;
  fromStatus?: FreezeStatus;
  toStatus?: FreezeStatus;
  details: Record<string, unknown>;
}

export interface ParameterIssue {
  field: string;
  issue: string;
  severity: 'WARNING' | 'ERROR';
  source: ParameterSource;
  suggestedContact: string;
}

export interface StateTransition {
  from: FreezeStatus | null;
  to: FreezeStatus;
  condition: (record: AccountFreezeRecord) => boolean;
  decisionReason: (record: AccountFreezeRecord) => string;
  nextStep: (record: AccountFreezeRecord) => string;
  nextStepOwner: (record: AccountFreezeRecord) => string;
}

export interface MigrationReportFilter {
  startDate?: Date;
  endDate?: Date;
  status?: FreezeStatus[];
  freezeReason?: FreezeReason[];
  accountId?: string;
  operatorId?: string;
  includeHistorical?: boolean;
}

export interface MigrationReport {
  reportId: string;
  generatedAt: Date;
  filter: MigrationReportFilter;
  totalRecords: number;
  summary: {
    byStatus: Record<FreezeStatus, number>;
    byReason: Record<FreezeReason, number>;
    autoApproved: number;
    manualReviewRequired: number;
    historicalRecords: number;
    parameterIssues: number;
  };
  records: AccountFreezeRecord[];
}

export interface StateMachineContext {
  currentRecord?: AccountFreezeRecord;
  executionId: string;
  executedAt: Date;
  isReRun: boolean;
}
