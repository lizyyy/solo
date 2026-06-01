export type Direction = 'positive' | 'negative' | 'unknown';

export interface DataPoint {
  id: string;
  timestamp: number;
  timeLabel: string;
  centrifugalForce: number;
  direction: Direction;
  unit: string;
  isAnomaly?: boolean;
  anomalyReason?: string;
  remark?: string;
}

export interface Metadata {
  source: string;
  processedAt: number;
  processor: string;
  remarks: string;
  supplementaryNote?: string;
}

export type ValidationErrorType = 'direction' | 'unit' | 'time_interval' | 'missing_value' | 'invalid_number';

export interface ValidationError {
  type: ValidationErrorType;
  rowIndex: number;
  message: string;
  suggestion: string;
}

export interface ValidationWarning {
  type: string;
  rowIndex?: number;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export type AnomalyMethod = 'iqr' | 'zscore' | 'threshold';

export interface AnomalyConfig {
  method: AnomalyMethod;
  iqrMultiplier: number;
  zscoreThreshold: number;
  manualThreshold?: { min: number; max: number };
}

export interface AnalysisSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  dataPoints: DataPoint[];
  metadata: Metadata;
  validation: ValidationResult;
  anomalyConfig: AnomalyConfig;
  hasSupplementaryNote: boolean;
  dataBeforeSupplementary?: DataPoint[];
}

export interface UploadedFile {
  name: string;
  content: string;
  type: string;
}

export interface AnomalyStatistics {
  totalCount: number;
  anomalyCount: number;
  normalCount: number;
  maxValue: number;
  minValue: number;
  avgValue: number;
  maxAnomalyValue?: number;
  anomalyPoints: DataPoint[];
}
