export type PhotoTag = 'unit_error' | 'zero_drift' | 'sample_gap' | 'other';

export type PointStatus = 'normal' | 'anomaly' | 'pending' | 'excluded';

export type Severity = 'high' | 'medium' | 'low';

export interface SensorLog {
  id: string;
  name: string;
  type: 'csv' | 'image' | 'text';
  url: string;
}

export interface Correction {
  id: string;
  content: string;
  version: number;
  timestamp: string;
  author: string;
  isLatest: boolean;
}

export interface AnomalyPhoto {
  id: string;
  name: string;
  url: string;
  tags: PhotoTag[];
  timestamp: string;
  uploader: string;
  sensorLogs: SensorLog[];
  corrections: Correction[];
  description: string;
}

export interface ScanPoint {
  id: string;
  x: number;
  y: number;
  value: number;
  status: PointStatus;
  linkedPhotoId?: string;
  linkedCorrectionId?: string;
  notes?: string;
}

export interface ScanReport {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  points: ScanPoint[];
  notes: string;
  author: string;
}

export interface ValidationResult {
  id: string;
  type: 'unit_error' | 'zero_drift' | 'sample_gap';
  severity: Severity;
  description: string;
  location: { start: number; end: number };
  suggestion: string;
  dataPointId?: string;
}

export interface OperationLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  operator: string;
  details: string;
}
