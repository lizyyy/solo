export enum ConflictType {
  WEIGHT_FORMULA_MISMATCH = 'weight_formula_mismatch',
  DUPLICATE_STUDENT_ANSWER = 'duplicate_student_answer',
  IMPORT_VERSION_CONFLICT = 'import_version_conflict',
  RECALCULATION_DISCREPANCY = 'recalculation_discrepancy',
  DATA_SOURCE_MISMATCH = 'data_source_mismatch'
}

export enum ConflictStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected'
}

export enum AnswerReviewStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export enum DataSource {
  WEIGHT_TABLE = 'weight_table',
  FORMULA_SCREENSHOT = 'formula_screenshot',
  MANUAL_CORRECTION = 'manual_correction',
  BUSINESS_CONFIRMED = 'business_confirmed'
}

export enum AuditAction {
  IMPORT = 'import',
  UPLOAD = 'upload',
  UPDATE = 'update',
  REVIEW = 'review',
  RECALCULATE = 'recalculate',
  CONFLICT_RESOLVE = 'conflict_resolve',
  EXPORT = 'export',
  CREATE = 'create',
  SUPPLEMENT = 'supplement'
}

export interface KeyNoteItem {
  id: string;
  content: string;
  referencedCriterionId?: string;
  createdBy: string;
  createdAt: Date;
}

export interface ChangeRecord<T = any> {
  id: string;
  fieldName: string;
  originalValue: T;
  newValue: T;
  changedBy: string;
  changedAt: Date;
  changeReason: string;
}

export interface AuditLogEntry {
  id: string;
  entityType: 'weight' | 'screenshot' | 'answer' | 'result' | 'conflict' | 'explanation';
  entityId: string;
  action: AuditAction;
  operator: string;
  timestamp: Date;
  summary: string;
  changes: ChangeRecord[];
  nextStepContact?: string;
}

export interface ScoringWeightItem {
  id: string;
  criterionId: string;
  criterionName: string;
  weight: number;
  maxScore: number;
  formula?: string;
  originalFormula?: string;
  correctedFormula?: string;
  correctionReason?: string;
  keyNoteRefs?: string[];
  source: DataSource;
  importBatchId: string;
  createdAt: Date;
  updatedAt: Date;
  changeHistory: ChangeRecord[];
}

export interface FormulaScreenshot {
  id: string;
  batchId: string;
  imageUrl: string;
  description: string;
  formulaText: string;
  keyNotes: KeyNoteItem[];
  extractedRemarks: string;
  uploadedBy: string;
  uploadedAt: Date;
  isActive: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface StudentAnswer {
  id: string;
  studentId: string;
  studentName: string;
  submissionId: string;
  submissionTime: Date;
  answers: Record<string, any>;
  originalAnswers?: Record<string, any>;
  correctedAnswers?: Record<string, any>;
  correctionReason?: string;
  isResubmission: boolean;
  previousSubmissionId?: string;
  allSubmissionIds: string[];
  reviewStatus: AnswerReviewStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  nextStepContact?: string;
  createdAt: Date;
  changeHistory: ChangeRecord[];
}

export interface ScoringDetail {
  criterionId: string;
  criterionName: string;
  score: number;
  originalScore?: number;
  correctedScore?: number;
  maxScore: number;
  weight: number;
  weightedScore: number;
  originalWeightedScore?: number;
  formula?: string;
  notes?: string;
  correctionNote?: string;
}

export interface ScoringResult {
  id: string;
  studentId: string;
  studentName: string;
  submissionId: string;
  totalScore: number;
  originalTotalScore?: number;
  correctedTotalScore?: number;
  details: ScoringDetail[];
  isRecalculated: boolean;
  recalculationReason?: string;
  recalculatedBy?: string;
  recalculatedAt?: Date;
  displayInNormalResults: boolean;
  calculatedAt: Date;
  calculationBatchId: string;
  version: number;
  changeHistory: ChangeRecord[];
}

export interface ConflictEvidence {
  source: DataSource;
  fieldName: string;
  originalValue: any;
  currentValue: any;
  expectedValue: any;
  actualValue: any;
  location?: string;
  keyNoteRef?: string;
}

export interface ConflictRecord {
  id: string;
  type: ConflictType;
  relatedEntityType: 'weight' | 'answer' | 'result';
  relatedEntityId?: string;
  title: string;
  description: string;
  originalStatement: string;
  correctedStatement?: string;
  processingReason?: string;
  evidence: ConflictEvidence[];
  status: ConflictStatus;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  nextStepContact?: string;
  createdAt: Date;
  changeHistory: ChangeRecord[];
}

export interface ImportBatch {
  id: string;
  batchNumber: string;
  importedBy: string;
  importedAt: Date;
  sourceType: 'weight_table' | 'student_answers';
  recordCount: number;
  isProcessed: boolean;
  remarks?: string;
}

export interface ErrorExplanation {
  id: string;
  batchId: string;
  title: string;
  content: string;
  relatedConflictIds: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  changeHistory: ChangeRecord[];
}

export interface SelfCheckResult {
  checkName: string;
  passed: boolean;
  message: string;
  details?: any;
  timestamp: Date;
}

export interface UnifiedViewRecord {
  submissionId: string;
  studentId: string;
  studentName: string;
  displayStatus: 'normal' | 'pending_review' | 'corrected' | 'recalculated';
  statusText: string;
  totalScore: number;
  originalTotalScore?: number;
  isRecalculated: boolean;
  needsReview: boolean;
  reviewStatus: AnswerReviewStatus;
  scoreDetails: ScoringDetail[];
  answerData: {
    currentAnswers: Record<string, any>;
    originalAnswers?: Record<string, any>;
    correctedAnswers?: Record<string, any>;
  };
  auditInfo: {
    originalStatement?: string;
    correctedStatement?: string;
    processingReason?: string;
    nextStepContact?: string;
    lastOperator: string;
    lastOperatedAt: Date;
    allVersions: Array<{
      version: number;
      operator: string;
      operatedAt: Date;
      summary: string;
      scoreSnapshot?: number;
    }>;
  };
  conflictInfo: {
    hasConflict: boolean;
    conflictType?: ConflictType;
    conflictStatus?: ConflictStatus;
  };
  exportReady: boolean;
}

export interface SystemState {
  weightBatches: ImportBatch[];
  scoringWeights: ScoringWeightItem[];
  formulaScreenshots: FormulaScreenshot[];
  studentAnswers: StudentAnswer[];
  scoringResults: ScoringResult[];
  conflictRecords: ConflictRecord[];
  errorExplanations: ErrorExplanation[];
  auditLogs: AuditLogEntry[];
}
