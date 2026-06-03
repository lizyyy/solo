export enum ConflictType {
  WEIGHT_FORMULA_MISMATCH = 'weight_formula_mismatch',
  DUPLICATE_STUDENT_ANSWER = 'duplicate_student_answer',
  IMPORT_VERSION_CONFLICT = 'import_version_conflict',
  RECALCULATION_DISCREPANCY = 'recalculation_discrepancy'
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
  FORMULA_SCREENSHOT = 'formula_screenshot'
}

export interface ScoringWeightItem {
  id: string;
  criterionId: string;
  criterionName: string;
  weight: number;
  maxScore: number;
  formula?: string;
  source: DataSource;
  importBatchId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormulaScreenshot {
  id: string;
  batchId: string;
  imageUrl: string;
  description: string;
  formulaText: string;
  uploadedBy: string;
  uploadedAt: Date;
  isActive: boolean;
}

export interface StudentAnswer {
  id: string;
  studentId: string;
  studentName: string;
  submissionId: string;
  submissionTime: Date;
  answers: Record<string, any>;
  isResubmission: boolean;
  previousSubmissionId?: string;
  reviewStatus: AnswerReviewStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
}

export interface ScoringResult {
  id: string;
  studentId: string;
  studentName: string;
  submissionId: string;
  totalScore: number;
  details: ScoringDetail[];
  isRecalculated: boolean;
  recalculationReason?: string;
  recalculatedBy?: string;
  recalculatedAt?: Date;
  calculatedAt: Date;
  calculationBatchId: string;
}

export interface ScoringDetail {
  criterionId: string;
  criterionName: string;
  score: number;
  maxScore: number;
  weight: number;
  weightedScore: number;
  formula?: string;
  notes?: string;
}

export interface ConflictRecord {
  id: string;
  type: ConflictType;
  title: string;
  description: string;
  evidence: ConflictEvidence[];
  status: ConflictStatus;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
}

export interface ConflictEvidence {
  source: DataSource;
  fieldName: string;
  expectedValue: any;
  actualValue: any;
  location?: string;
}

export interface ImportBatch {
  id: string;
  batchNumber: string;
  importedBy: string;
  importedAt: Date;
  sourceType: 'weight_table' | 'student_answers';
  recordCount: number;
  isProcessed: boolean;
}

export interface ErrorExplanation {
  id: string;
  batchId: string;
  title: string;
  content: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SelfCheckResult {
  checkName: string;
  passed: boolean;
  message: string;
  details?: any;
  timestamp: Date;
}

export interface SystemState {
  weightBatches: ImportBatch[];
  scoringWeights: ScoringWeightItem[];
  formulaScreenshots: FormulaScreenshot[];
  studentAnswers: StudentAnswer[];
  scoringResults: ScoringResult[];
  conflictRecords: ConflictRecord[];
  errorExplanations: ErrorExplanation[];
}
