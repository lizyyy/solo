export type MaterialType = 'normal' | 'wrong_caliber' | 'supplement';

export type BatchStatus = 'pending' | 'checking' | 'checked' | 'conflicted' | 'resolved';

export interface ImportBatch {
  id: string;
  materialType: MaterialType;
  importTime: string;
  operator: string;
  status: BatchStatus;
}

export interface Annotation {
  id: string;
  batchId: string;
  subject: string;
  teacherId: string;
  score: number;
  denominator: string;
  rawDenominator: string;
  source: string;
}

export interface SampleRecord {
  id: string;
  batchId: string;
  subject: string;
  medianValue: number;
  threshold: number;
  sampleSize: number;
  source: string;
}

export type ConflictType = 'score_mismatch' | 'denominator_zero_empty' | 'median_deviation' | 'duplicate';

export type ConflictStatus = 'pending' | 'confirmed' | 'rejected' | 'needs_review';

export interface ConflictItem {
  id: string;
  annotationId: string;
  sampleId: string;
  conflictType: ConflictType;
  status: ConflictStatus;
  resolution: string;
  resolvedBy: string;
  resolvedAt: string;
}

export interface ConflictEvidence {
  id: string;
  conflictId: string;
  annotationValue: string;
  sampleValue: string;
  annotationSource: string;
  sampleSource: string;
}

export type StepIndex = 1 | 2 | 3;

export type StepStatus = 'pending' | 'in_progress' | 'blocked' | 'completed';

export interface WorkflowStep {
  id: string;
  batchId: string;
  stepIndex: StepIndex;
  stepName: string;
  status: StepStatus;
  startedAt: string;
  completedAt: string;
  operator: string;
  snapshot: string;
}

export interface AuditLog {
  id: string;
  batchId: string;
  action: string;
  actor: string;
  detail: string;
  timestamp: string;
}

export type CheckType = 'duplicate_import' | 'denominator_zero_empty' | 'recalc_after_supplement' | 'export_consistency';

export interface SelfCheckResult {
  id: string;
  batchId: string;
  checkType: CheckType;
  passed: boolean;
  detail: string;
  checkedAt: string;
}

export interface MedianAlert {
  id: string;
  batchId: string;
  subject: string;
  medianValue: number;
  threshold: number;
  isAlert: boolean;
  calculatedAt: string;
}
