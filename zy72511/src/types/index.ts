export enum SampleType {
  NORMAL = 'normal',
  VERSION_CONFLICT = 'version_conflict',
  GRAY_BACKFILL = 'gray_backfill'
}

export enum AttributionStatus {
  PENDING = 'pending',
  NORMAL = 'normal',
  CONFLICT = 'conflict',
  PENDING_REVIEW = 'pending_review',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected'
}

export enum OperationType {
  IMPORT = 'import',
  REVIEW = 'review',
  CONFIRM = 'confirm',
  REJECT = 'reject',
  UPDATE = 'update',
  COMMENT = 'comment',
  SUBMIT_REVIEW = 'submit_review'
}

export interface WrongWord {
  id: string;
  original: string;
  transcribed: string;
  errorType: string;
  confidence: number;
  position: number;
}

export interface DesensitizationRule {
  id: string;
  version: string;
  importTime: string;
  importedBy: string;
  remarks: string;
  rules: Array<{
    type: string;
    pattern: string;
    replacement: string;
  }>;
}

export interface GrayBatch {
  id: string;
  batchNo: string;
  modelVersion: string;
  sampleCount: number;
  startTime: string;
  endTime: string;
  remarks: string;
  dataSource: string;
}

export interface ConflictEvidence {
  desensitizationClaim: string;
  grayBatchClaim: string;
  conflictPoints: string[];
}

export interface AttributionSample {
  id: string;
  sampleNo: string;
  type: SampleType;
  status: AttributionStatus;
  modelVersion: string;
  originalModelVersion?: string;
  originalText: string;
  transcribedText: string;
  wrongWords: WrongWord[];
  desensitizationRule?: DesensitizationRule;
  grayBatch?: GrayBatch;
  hasConflict: boolean;
  conflictEvidence?: ConflictEvidence;
  createdAt: string;
  updatedAt: string;
  currentStep: number;
  reviewBy?: string;
  reviewTime?: string;
  decisionRemark?: string;
}

export interface OperationLog {
  id: string;
  sampleId?: string;
  operationType: OperationType;
  operator: string;
  operatorRole: string;
  operationTime: string;
  description: string;
  reason?: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  affectedSamples?: string[];
}

export interface AppState {
  samples: AttributionSample[];
  operationLogs: OperationLog[];
  currentUser: {
    name: string;
    role: string;
  };
}
