export type BatchStatus = 'normal' | 'pending_review' | 'supplemented';

export type ProcessAction = 
  | 'import' 
  | 'auto_parse' 
  | 'manual_correction' 
  | 'threshold_check' 
  | 'supplement' 
  | 'review' 
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
}

export interface BatchRecord {
  id: string;
  name: string;
  materialType: string;
  status: BatchStatus;
  remark: string;
  hasManualCorrection: boolean;
  correctionReason?: string;
  source: string;
  supplementedFrom?: string;
  supplementedAt?: Date;
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
