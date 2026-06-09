export interface ParameterTable {
  id: string;
  importBatch: string;
  version: string;
  importTime: string;
  importedBy: string;
}

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
  rawAlpha?: string;
  rawBeta?: string;
  rawGamma?: string;
  createdAt: string;
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
  stage: 'import_detected' | 'conflict_resolved' | 'calculation_completed' | 'owner_reviewed';
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
}

export interface CounterExample {
  id: string;
  batch: string;
  submittedTime: string;
  submittedBy: string;
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
}

export interface WorkflowState {
  id: string;
  currentStep: number;
  stepName: string;
  step1Completed: boolean;
  step2Completed: boolean;
  step3Completed: boolean;
  updatedAt: string;
}

export interface SelfCheckItem {
  id: string;
  name: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  details: string;
}

export interface SelfCheckResult {
  overallStatus: 'pass' | 'warning' | 'fail';
  items: SelfCheckItem[];
  checkedAt: string;
}

export interface ImportResult {
  success: boolean;
  message: string;
  duplicateCount: number;
  mixedFormatCount: number;
  importedCount: number;
}

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};
