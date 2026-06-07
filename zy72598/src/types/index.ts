export type ExperimentStatus = 'draft' | 'importing' | 'notes_pending' | 'conflicts_found' | 'ready' | 'completed';

export type ConflictType = 'log_vs_note' | 'feature_missing' | 'data_inconsistency';

export type ConflictStatus = 'pending' | 'confirmed' | 'rejected';

export interface Experiment {
  id: string;
  name: string;
  status: ExperimentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CurvePoint {
  epoch: number;
  metric: string;
  value: number;
}

export interface FeatureInfo {
  name: string;
  present: boolean;
  defaultValue?: number;
}

export interface TrainingLog {
  id: string;
  experimentId: string;
  curveData: CurvePoint[];
  features: FeatureInfo[];
  hasDefaultScores: boolean;
  importedAt: string;
}

export interface ThresholdItem {
  metric: string;
  value: number;
  note?: string;
}

export interface ParamNote {
  id: string;
  experimentId: string;
  thresholds: ThresholdItem[];
  notes: string;
  recordedAt: string;
}

export interface Summary {
  id: string;
  experimentId: string;
  content: string;
  metrics: Record<string, number>;
  version: number;
  createdAt: string;
}

export interface Conflict {
  id: string;
  experimentId: string;
  type: ConflictType;
  description: string;
  evidence: {
    log: string;
    note: string;
  };
  status: ConflictStatus;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface HistoryRecord {
  id: string;
  experimentId: string;
  action: string;
  operator: string;
  timestamp: string;
  details: Record<string, any>;
}

export interface SelfCheckResult {
  duplicateImport: { passed: boolean; details: string };
  missingFeatures: { passed: boolean; details: string };
  recalculation: { passed: boolean; details: string };
  exportConsistency: { passed: boolean; details: string };
}

export type SelfCheckKey = keyof SelfCheckResult;
