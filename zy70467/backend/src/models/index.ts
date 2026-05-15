export interface TrainingEnvironmentItem {
  courseId: string;
  courseName: string;
  traineeId: string;
  traineeName: string;
  submissionId: string;
  approvalStatus: string;
  approvalComment?: string;
  approvalDate?: Date;
  submittedAt: Date;
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'BLOCKER';
}

export interface RuleCondition {
  field: string;
  operator: string;
  value: any;
}

export interface RuleAction {
  type: string;
  params: Record<string, any>;
}

export interface RuleLogic {
  conditions: RuleCondition[];
  actions: RuleAction[];
  approvalRequired: boolean;
}

export type BatchStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'REVIEWED';
export type ItemStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface BatchExecutionResult {
  batchId: string;
  status: BatchStatus;
  totalCount: number;
  successCount: number;
  failedCount: number;
  partialSuccess: boolean;
  executionTimeMs: number;
  failedItems: Array<{
    itemId: string;
    originalData: TrainingEnvironmentItem;
    failureReason: string;
    errors: ValidationError[];
  }>;
}

export interface ProcessingReport {
  batchId: string;
  beforeProcessing: TrainingEnvironmentItem[];
  afterProcessing: TrainingEnvironmentItem[];
  executionTime: number;
  successCount: number;
  failedCount: number;
  partialSuccess: boolean;
  nextSteps: string[];
  failedItems: Array<{
    id: string;
    originalData: TrainingEnvironmentItem;
    failureReason: string;
    errorDetails: ValidationError[];
    reviewStatus: ReviewStatus;
  }>;
}
