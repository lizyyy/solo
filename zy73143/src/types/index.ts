export interface BuoyLog {
  id: string;
  buoyId: string;
  longitude: number;
  latitude: number;
  temperature: number;
  seagrassCoverage: number;
  biomass: number;
  recordTime: string;
  importBatch: string;
  remark: string;
  isConfirmed: boolean;
  confirmedAt?: string;
  confirmer?: string;
  createdAt: string;
  updatedAt: string;
  _importBatches?: string[];
  _lastMergedAt?: string;
  _mergedCount?: number;
}

export interface SpatialMark {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  type: string;
  calculationMethod: string;
  buoyLogIds: string[];
  status: 'normal' | 'abnormal';
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export type AnomalyType = 'latlng_swapped' | 'value_outlier' | 'missing_data' | 'duplicate_log';
export type AnomalySeverity = 'low' | 'medium' | 'high';
export type AnomalySourceType = 'buoy_log' | 'spatial_mark';

export interface Anomaly {
  id: string;
  sourceType: AnomalySourceType;
  sourceId: string;
  type: AnomalyType;
  description: string;
  severity: AnomalySeverity;
  isResolved: boolean;
  resolvedRemark?: string;
  resolvedBy?: string;
  detectedAt: string;
  resolvedAt?: string;
}

export type ChangeAction = 'create' | 'update' | 'confirm' | 'import' | 'resolve' | 'mark_abnormal';
export type ChangeSourceType = 'buoy_log' | 'spatial_mark' | 'anomaly';

export interface ChangeLog {
  id: string;
  sourceType: ChangeSourceType;
  sourceId: string;
  action: ChangeAction;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  operator: string;
  remark?: string;
  createdAt: string;
}

export interface ImportResult {
  total: number;
  newCount: number;
  duplicateCount: number;
  anomalyCount: number;
  skippedWithRemark: number;
  batchName: string;
  filledFieldsCount: number;
  preservedConfirmedCount: number;
  mergedCount: number;
}

export type PageType = 'dashboard' | 'buoy-logs' | 'spatial-marking' | 'anomalies' | 'audit';
