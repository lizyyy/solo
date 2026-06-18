export type CoordinateFormat = 'decimal' | 'dms' | 'dm';

export type DataSource = 'buoy' | 'remoteSensing';

export type AnomalyType = 'cloudCover' | 'missingData' | 'outOfRange' | 'none';

export type SedimentLevel = 'normal' | 'mild' | 'moderate' | 'severe';

export interface ReportParams {
  sedimentThreshold: number;
  depthUnit: 'meter' | 'fathom';
  coordinateFormat: CoordinateFormat;
  includeAnomaly: boolean;
  dataSources: DataSource[];
  baselineDepth: number;
}

export interface ReportVersion {
  id: string;
  name: string;
  remark: string;
  createdAt: string;
  operator: string;
  params: ReportParams;
  recordCount: number;
  normalCount: number;
  anomalyCount: number;
  cloudCoverCount: number;
}

export interface SedimentRecord {
  id: string;
  versionId: string;
  rawLatitude: string;
  rawLongitude: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  source: DataSource;
  sedimentDepth: number;
  sedimentLevel: SedimentLevel;
  isNormal: boolean;
  anomalyType: AnomalyType;
  anomalyDetail?: string;
  remark?: string;
  rawData?: string;
  cloudCoverRate?: number;
  baselineDepth?: number;
  measuredDepth?: number;
  coordinateFormatDetected: CoordinateFormat;
}

export interface FilterState {
  dateRange: [string, string] | null;
  dataSources: DataSource[];
  anomalyTypes: AnomalyType[];
  sedimentLevels: SedimentLevel[];
  keyword: string;
}

export interface ParamDiff {
  key: string;
  label: string;
  oldValue: string | number | boolean | string[];
  newValue: string | number | boolean | string[];
  changed: boolean;
}

export interface RecordDiff {
  type: 'added' | 'removed' | 'modified';
  recordId: string;
  oldRecord?: SedimentRecord;
  newRecord?: SedimentRecord;
  changedFields?: { field: string; oldValue: unknown; newValue: unknown }[];
}

export interface ExportOptions {
  format: 'csv' | 'json';
  includeAnomaly: boolean;
  includeRawData: boolean;
  embedFilter: boolean;
}
