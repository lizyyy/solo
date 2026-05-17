export enum PollutionStatus {
  CREATED = 'CREATED',
  IDENTIFIED = 'IDENTIFIED',
  SAMPLES_MARKED = 'SAMPLES_MARKED',
  IMPACT_RECALCULATED = 'IMPACT_RECALCULATED',
  REVIEW_REQUESTED = 'REVIEW_REQUESTED',
  REVIEW_APPROVED = 'REVIEW_APPROVED',
  REVIEW_REJECTED = 'REVIEW_REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum PollutionRuleType {
  INTERNAL_ACCOUNT = 'INTERNAL_ACCOUNT',
  TEST_ACCOUNT = 'TEST_ACCOUNT',
  IP_RANGE = 'IP_RANGE',
  ABNORMAL_BEHAVIOR = 'ABNORMAL_BEHAVIOR',
  CUSTOM = 'CUSTOM'
}

export interface PollutionRule {
  id: string;
  type: PollutionRuleType;
  name: string;
  description: string;
  conditions: Record<string, any>;
  createdBy: string;
  createdAt: Date;
}

export interface SampleUser {
  userId: string;
  userType: string;
  originalGroup: string;
  isPolluted?: boolean;
  markedAt?: Date;
  markedBy?: string;
  attributes: Record<string, any>;
}

export interface MetricImpact {
  metricName: string;
  originalValue: number;
  cleanedValue: number;
  changeRate: number;
  confidenceLevel: number;
  statisticalSignificance: boolean;
}

export interface ExclusionApplication {
  id: string;
  applicant: string;
  reason: string;
  appliedAt: Date;
  expectedImpact: string;
}

export interface ReviewReport {
  id: string;
  reviewer: string;
  reviewComment: string;
  reviewResult: 'APPROVED' | 'REJECTED' | 'NEEDS_MODIFICATION';
  reviewedAt: Date;
  attachments: string[];
}

export interface OperationLog {
  id: string;
  recordId: string;
  operation: string;
  operator: string;
  operatedAt: Date;
  originalInput: any;
  processingBasis: string;
  statusBefore: string;
  statusAfter: string;
  errorMessage?: string;
}

export interface ExperimentPollution {
  id: string;
  experimentId: string;
  experimentName: string;
  status: PollutionStatus;
  pollutionRules: PollutionRule[];
  sampleUsers: SampleUser[];
  exclusionApplication?: ExclusionApplication;
  metricImpacts: MetricImpact[];
  reviewReports: ReviewReport[];
  operationLogs: OperationLog[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  remarks?: string;
}

export interface CreatePollutionRequest {
  experimentId: string;
  experimentName: string;
  pollutionRules: Omit<PollutionRule, 'id' | 'createdAt'>[];
  sampleUsers: Omit<SampleUser, 'markedAt' | 'markedBy'>[];
  createdBy: string;
  remarks?: string;
}

export interface UpdateStatusRequest {
  recordId: string;
  targetStatus: PollutionStatus;
  operator: string;
  processingBasis: string;
  payload?: any;
}

export interface ManualCorrectionRequest {
  recordId: string;
  operator: string;
  correctionType: 'SAMPLE_USER' | 'POLLUTION_RULE' | 'METRIC_IMPACT' | 'REMARKS';
  originalValue: any;
  newValue: any;
  reason: string;
}

export interface QueryParams {
  experimentId?: string;
  status?: PollutionStatus;
  createdBy?: string;
  startTime?: Date;
  endTime?: Date;
  page?: number;
  pageSize?: number;
}

export interface ExportRequest {
  recordId: string;
  format: 'JSON' | 'CSV';
  includeSections: ('BASIC' | 'SAMPLES' | 'IMPACT' | 'REVIEW' | 'LOGS')[];
}
