export type TideUnit = 'm' | 'cm' | 'ft';

export type ManualStatus =
  | 'normal'
  | 'outlier_keep'
  | 'outlier_reject'
  | 'pending';

export interface SurveyRecord {
  id: string;
  siteName: string;
  timestamp: string;
  coverage: number;
  tideLevel: number;
  tideUnit: TideUnit;
  waterQuality: number;
  sourceRow: number;
  sourceBatch: string;
  flags: {
    isOutlier: boolean;
    isUnitMismatch: boolean;
    isNameMismatch: boolean;
    isPendingMaterial: boolean;
  };
  anomalyTags?: string[];
  remark?: string;
  manualOverride?: {
    by: string;
    at: string;
    reason: string;
    newStatus: ManualStatus;
  };
  processedAt?: string;
  pendingNote?: string;
}

export interface RunParams {
  smoothWindow: number;
  outlierThreshold: number;
  normalizeUnit: boolean;
  keepSuspicious: boolean;
  nameFuzzyMatch: number;
}

export interface ParamDiff {
  paramKey: keyof RunParams;
  oldValue: RunParams[keyof RunParams];
  newValue: RunParams[keyof RunParams];
}

export interface ParamSnapshot {
  version: string;
  createdAt: string;
  params: RunParams;
  affectedRecordIds: string[];
  diffFromPrev?: ParamDiff[];
}

export interface ImportDetail {
  fingerprint: string;
  action: 'insert' | 'skip_duplicate' | 'preserve_remark' | 'merge';
  recordId: string;
}

export interface ImportResult {
  totalIncoming: number;
  skippedDuplicate: number;
  remarkPreserved: number;
  merged: number;
  details: ImportDetail[];
  timestamp: string;
}

export type ColumnKind = 'processed' | 'pending' | 'manual';

export interface HoveredPoint {
  recordId: string;
  x: number;
  y: number;
}
