export interface CalibrationRecord {
  id: string;
  rowNumber: number;
  sensorId: string;
  temperature: number;
  direction: string;
  directionStatus: 'valid' | 'invalid' | 'pending_review';
  reviewed: boolean;
  reviewer?: string;
  reviewTime?: string;
  importTime: string;
  fileName: string;
}

export interface AuditLog {
  id: string;
  recordId: string;
  sensorId: string;
  action: 'create' | 'update' | 'review' | 'delete';
  field?: string;
  oldValue?: string;
  newValue?: string;
  operator: string;
  operateTime: string;
  remark?: string;
}

export interface AnomalyRecord {
  id: string;
  sensorId: string;
  anomalyType: 'temperature_abnormal' | 'direction_invalid' | 'sensor_missing';
  temperature?: number;
  direction?: string;
  threshold?: number;
  detectedTime: string;
  status: 'pending' | 'resolved' | 'ignored';
  remark?: string;
}

export interface ImportResult {
  success: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  pendingReview: number;
  message?: string;
}

export interface SensorInfo {
  sensorId: string;
  lastCalibrationTime?: string;
  calibrationCount: number;
  status: 'active' | 'inactive' | 'maintenance';
}
