export interface ParameterTable {
  id: string;
  importBatch: string;
  version: string;
  importTime: string;
  importedBy: string;
  strategy: 'overwrite' | 'skip' | 'append';
  source: 'upload' | 'manual' | 'demo';
  fileName?: string;
}

export type ParameterPreviousValues = {
  rawAlpha?: string;
  rawBeta?: string;
  rawGamma?: string;
  forecastConclusion?: string;
  version?: number;
  source?: 'original' | 'overwritten' | 'corrected';
  changeReason?: string;
  previousValues?: ParameterPreviousValues;
};

export interface ParameterRecord {
  id: string;
  tableId: string;
  productId: string;
  productName: string;
  alpha: number | string;
  beta: number | string;
  gamma: number | string;
  forecastConclusion: string;
  valueFormat: 'decimal' | 'percentage' | 'mixed';
  hasMixedFormat: boolean;
  rawAlpha: string;
  rawBeta: string;
  rawGamma: string;
  createdAt: string;
  source: 'original' | 'overwritten' | 'corrected';
  lastModifiedAt: string;
  lastModifiedBy: string;
  previousValues?: ParameterPreviousValues;
  changeReason?: string;
  nextOwner?: string;
  version: number;
}

export interface MixedFormatInfo {
  rawAlpha: string;
  rawBeta: string;
  rawGamma: string;
  parsedAlpha: number;
  parsedBeta: number;
  parsedGamma: number;
  hasPercentage: boolean[];
  originalDescription: string;
  normalizedDescription: string;
  needManualReview: boolean;
  nextOwner: string;
}

export interface ConflictDecisionInfo {
  conflictId: string;
  resolution: 'accept_example' | 'reject_example';
  parameterValue: number;
  exampleValue: number;
  diffPercentage: number;
  evidence: string;
  resolutionReason: string;
  resolvedBy: string;
  resolvedAt: string;
  originalStatement: string;
  updatedValue: number;
  changeReason: string;
  nextOwner: string;
}

export interface ReviewChainEntry {
  stage: 'import_detected' | 'duplicate_handled' | 'corrected' | 'conflict_resolved' | 'calculation_completed' | 'owner_reviewed';
  action: string;
  originalValue?: string;
  updatedValue?: string;
  reason?: string;
  operator?: string;
  nextOwner?: string;
  timestamp: string;
}

export interface ForecastResult {
  id: string;
  productId: string;
  productName: string;
  parameterVersion: string;
  calculationDetail: string;
  tradeoffReason: string;
  forecastValue: number;
  rawValue: number | string;
  valueFormat: 'decimal' | 'percentage' | 'mixed';
  isMixedFormat: boolean;
  reviewStatus: 'pending_review' | 'reviewed' | 'normal';
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  historicalData: number[];
  smoothedData: number[];
  rawAlpha: string;
  rawBeta: string;
  rawGamma: string;
  parsedAlpha: number;
  parsedBeta: number;
  parsedGamma: number;
  mixedFormatInfo: MixedFormatInfo | null;
  conflictDecision: ConflictDecisionInfo | null;
  reviewChain: ReviewChainEntry[];
  importBatch: string;
  calculatedAt: string;
  lastModifiedBy: string;
  recalculationCount: number;
}

export interface CounterExample {
  id: string;
  batch: string;
  submittedTime: string;
  submittedBy: string;
  source: 'upload' | 'manual' | 'demo';
  fileName?: string;
}

export interface ExampleRecord {
  id: string;
  exampleId: string;
  productId: string;
  productName: string;
  manualCalculation: number;
  reasoning: string;
  createdAt: string;
}

export interface Conflict {
  id: string;
  parameterRecordId: string;
  exampleRecordId: string;
  productId: string;
  productName: string;
  parameterValue: number;
  exampleValue: number;
  diffPercentage: number;
  evidence: string;
  status: 'pending' | 'resolved';
  resolution: 'accept_example' | 'reject_example' | null;
  resolutionReason: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export interface WorkflowState {
  id: string;
  currentStep: number;
  stepName: string;
  step1Completed: boolean;
  step2Completed: boolean;
  step3Completed: boolean;
  updatedAt: string;
  importBatchCount: number;
  correctionCount: number;
  recalculationCount: number;
}

export interface ImportResult {
  success: boolean;
  message: string;
  importedCount: number;
  duplicateCount: number;
  mixedFormatCount: number;
  overwrittenCount: number;
  skippedCount: number;
  batchId: string;
  tableId: string;
  duplicateProductIds: string[];
  overwrittenProductIds: string[];
  skippedProductIds: string[];
  mixedProductIds: string[];
  allProductIds: string[];
}

export type CheckStatus = 'pass' | 'warning' | 'fail' | 'pending';

export interface SelfCheckItem {
  id: 'duplicate-imports' | 'mixed-format' | 'recalculation' | 'export-consistency';
  name: string;
  status: CheckStatus;
  message: string;
  details: string;
  lastCheckedAt?: string;
  triggeredCount?: number;
  affectedProducts?: string[];
}

export interface SelfCheckResult {
  overallStatus: CheckStatus;
  items: SelfCheckItem[];
  checkedAt: string;
  triggeredBy: 'manual' | 'auto';
}

export type AuditAction =
  | 'parameter.import'
  | 'parameter.update'
  | 'parameter.skipped_duplicate'
  | 'parameter.overwritten_duplicate'
  | 'counterexample.import'
  | 'conflict.resolved'
  | 'forecast.calculated'
  | 'forecast.exported'
  | 'review.completed';

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actor: string;
  timestamp: string;
  productIds: string[];
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  nextOwner?: string;
  batchId?: string;
}

export interface MetadataState {
  lastExportedAt: string | null;
  lastExportedCount: number | null;
  lastExportedHash: string | null;
  lastCalculatedAt: string | null;
  lastCalculationCount: number | null;
  importBatchCounter: number;
  totalImportCount: number;
  totalCorrectionCount: number;
  recalculationCount: number;
}

export interface ParameterUpdateRequest {
  productId: string;
  rawAlpha?: string;
  rawBeta?: string;
  rawGamma?: string;
  forecastConclusion?: string;
  reason: string;
  operator: string;
}

export interface ParsedParameterRow {
  productId: string;
  productName: string;
  rawAlpha: string;
  rawBeta: string;
  rawGamma: string;
  forecastConclusion: string;
  parseErrors?: string[];
}
