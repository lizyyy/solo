export type RecordType = 'normal' | 'duplicate' | 'supplement';
export type RecordStatus = 'pending' | 'confirmed' | 'rejected';
export type ReviewStep = 'step1' | 'step2' | 'step3';
export type EvidenceType = 'kb_reference' | 'work_order' | 'duplicate_check' | 'system' | 'review';
export type ConflictResolution = 'confirm_kb' | 'confirm_work_order' | 'reject_both' | null;

export interface Evidence {
  id: string;
  type: EvidenceType;
  title: string;
  content: string;
  source: string;
  url?: string;
  timestamp: string;
  operator?: string;
  isHighlighted?: boolean;
}

export interface Conflict {
  id: string;
  kbContent: string;
  workOrderContent: string;
  conflictingPoints: string[];
  resolution?: ConflictResolution;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface OperationLog {
  id: string;
  operator: string;
  action: string;
  detail: string;
  timestamp: string;
}

export interface ModelParams {
  version: string;
  params: Record<string, string | number | boolean>;
  tradeOffReason: string;
}

export interface ReviewRecord {
  id: string;
  type: RecordType;
  status: RecordStatus;
  userFeedback: string;
  userId: string;
  modelVersion: string;
  batchId: string;
  createdAt: string;
  updatedAt: string;
  currentStep: ReviewStep;
  evidences: Evidence[];
  conflicts?: Conflict[];
  operationLogs: OperationLog[];
  modelParams: ModelParams;
  duplicateCount?: number;
}

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  normal: '顺利记录',
  duplicate: '重复计入',
  supplement: '补录旧口径',
};

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  pending: '待复核',
  confirmed: '已确认',
  rejected: '已驳回',
};

export const REVIEW_STEP_LABELS: Record<ReviewStep, string> = {
  step1: '知识库导入',
  step2: '补看线上工单',
  step3: '证据回放更新',
};

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  kb_reference: '知识库引用',
  work_order: '线上工单',
  duplicate_check: '重复检测',
  system: '系统操作',
  review: '复核记录',
};
