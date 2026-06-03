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
  | 'high_condition_number';

export interface WeightRow {
  id: string;
  originalRowNumber: number;
  criterionName: string;
  originalValue: string;
  currentValue: number;
  isPercent: boolean;
  status: WeightRowStatus;
  warnings: WarningType[];
  isManualModified: boolean;
  modifiedBy?: string;
  modifiedAt?: Date;
  notes?: string;
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
  };
  exportTime?: Date;
}
