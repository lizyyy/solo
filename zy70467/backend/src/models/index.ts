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

export type RuleOperator = 
  | 'equals' 
  | 'notEquals' 
  | 'contains' 
  | 'notContains' 
  | 'isEmpty' 
  | 'isNotEmpty' 
  | 'in' 
  | 'notIn'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan';

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value?: any;
}

export type ErrorSeverity = 'ERROR' | 'WARNING' | 'BLOCKER';

export interface RuleAction {
  type: 'ADD_ERROR';
  severity: ErrorSeverity;
  field: string;
  errorCode: string;
  message: string;
}

export interface RuleDefinition {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  conditionMode: 'AND' | 'OR';
  action: RuleAction;
}

export interface RuleLogic {
  version: number;
  rules: RuleDefinition[];
  description: string;
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
