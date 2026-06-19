export type WeightRowStatus = 
  | 'pending'      
  | 'normal'       
  | 'warning'      
  | 'error'        
  | 'needs_review';

export type WarningType = 
  | 'percent_decimal_mixed' 
  | 'duplicate_row'         
  | 'invalid_value'       
  | 'high_condition_number'
  | 'duplicate_import';

export interface ImportBatch {
  id: string;
  fingerprint: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  importTime: Date;
  importedBy: string;
  isDuplicate: boolean;
  matchedBatchId?: string;
}

export interface ReviewInfo {
  previousValue: string;
  previousRawValue: string;
  newValue: string;
  newRawValue: string;
  reason: string;
  nextHandler: string;
  reviewedAt: Date;
  reviewedBy: string;
  finalized: boolean;
}

export interface ChangeHistoryEntry {
  id: string;
  rowId: string;
  criterionName: string;
  field: 'originalValue' | 'modifiedValue' | 'status' | 'notes';
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: Date;
  reason?: string;
  dataVersion: number;
}

export interface WeightRow {
  id: string;
  originalRowNumber: number;
  criterionName: string;
  originalImportValue: string;
  originalValue: string;
  modifiedValue?: string;
  currentValue: number;
  isPercent: boolean;
  status: WeightRowStatus;
  warnings: WarningType[];
  isManualModified: boolean;
  modifiedBy?: string;
  modifiedAt?: Date;
  notes?: string;
  reviewInfo?: ReviewInfo;
  importBatchId: string;
  isDuplicateImport: boolean;
  matchedRowId?: string;
}

export interface MatrixConditionResult {
  conditionNumber: number;
  isWarning: boolean;
  threshold: number;
  details: {
    eigenvalues: number[];
    maxEigenvalue: number;
    minEigenvalue: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  warnings: WarningType[];
  message: string;
}

export interface WeightTableData {
  rows: WeightRow[];
  importTime: Date;
  importedBy: string;
  matrixResult: MatrixConditionResult | null;
  processStep: ProcessStep;
  formulaScreenshot?: string;
  hasReviewStatus: 'not_viewed' | 'viewed' | 'confirmed';
  history: ChangeHistoryEntry[];
  dataVersion: number;
  importBatches: ImportBatch[];
  currentBatchId: string;
}

export type ProcessStep = 
  | 'step1_imported' 
  | 'step2_formula_review' 
  | 'step3_calculation_updated';

export interface UnifiedResult {
  rows: WeightRow[];
  matrixResult: MatrixConditionResult | null;
  summary: {
    totalRows: number;
    warningCount: number;
    errorCount: number;
    needsReviewCount: number;
    normalCount: number;
    modifiedCount: number;
    duplicateImportCount: number;
  };
  processStep: ProcessStep;
  importTime: Date;
  importedBy: string;
  history: ChangeHistoryEntry[];
  dataVersion: number;
  importBatches: ImportBatch[];
  currentBatchId: string;
  exportTime?: Date;
}
