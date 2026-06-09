export type BatchStatus = 'normal' | 'pending_review' | 'supplemented' | 'needs_supplement';

export type ProcessAction = 
  | 'import' 
  | 'auto_parse' 
  | 'manual_correction' 
  | 'threshold_check' 
  | 'supplement' 
  | 'review' 
  | 'remark_edit'
  | 'complete';

export interface TemperaturePoint {
  id: string;
  batchId: string;
  timeIndex: number;
  temperature: number;
  targetTemp: number;
  isAbnormal: boolean;
  isCorrected: boolean;
  originalTemp?: number;
}

export interface ProcessLog {
  id: string;
  batchId: string;
  action: ProcessAction;
  operator: string;
  description: string;
  timestamp: Date;
  beforeValue?: string;
  afterValue?: string;
  fieldName?: string;
}

export interface RemarkHistory {
  id: string;
  timestamp: Date;
  operator: string;
  beforeRemark: string;
  afterRemark: string;
  reason: string;
}

export interface BatchRecord {
  id: string;
  name: string;
  materialType: string;
  status: BatchStatus;
  remark: string;
  originalRemark: string;
  remarkHistory: RemarkHistory[];
  hasManualCorrection: boolean;
  correctionReason?: string;
  source: string;
  originalThresholdVersion?: string;
  appliedThresholdVersion?: string;
  supplementedFrom?: string;
  supplementedAt?: Date;
  supplementOperator?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  temperaturePoints: TemperaturePoint[];
  processLogs: ProcessLog[];
}

export interface ThresholdConfig {
  id: string;
  version: string;
  zone: number;
  minTemp: number;
  maxTemp: number;
  warningThreshold: number;
  isCurrent: boolean;
  effectiveDate: Date;
  description?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SupplementPayload {
  thresholdVersion: string;
  operator: string;
  supplementRemark: string;
}

export interface ReviewPayload {
  reviewer: string;
  reason: string;
  newRemark?: string;
}
