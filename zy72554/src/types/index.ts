export type PlaybackStatus = 'normal' | 'pending_review' | 'modified';
export type WorkflowStep = 'import' | 'bucket' | 'metric';
export type ChangeType = 'create' | 'update' | 'rollback';
export type ReviewResult = 'confirmed_normal' | 'needs_modification';

export interface ThresholdItem {
  metricName: string;
  thresholdValue: number;
  reportValue: number;
  isConsistent: boolean;
}

export interface ThresholdNote {
  id: string;
  noteId: string;
  fileName: string;
  operator: string;
  importedAt: string;
  remark?: string;
  rawData: Record<string, any>;
}

export interface PlaybackRecord {
  id: string;
  noteId: string;
  fileName: string;
  operator: string;
  status: PlaybackStatus;
  createdAt: string;
  updatedAt: string;
  currentStep: WorkflowStep;
  hasAnomaly: boolean;
  thresholds: ThresholdItem[];
  remark?: string;
}

export interface VersionHistory {
  id: string;
  playbackId: string;
  version: number;
  fieldName: string;
  oldValue: string;
  newValue: string;
  modifiedBy: string;
  modifiedAt: string;
  changeType: ChangeType;
}

export interface Anomaly {
  id: string;
  playbackId: string;
  metricName: string;
  thresholdValue: number;
  reportValue: number;
  detectedAt: string;
  reviewedBy?: string;
  reviewResult?: ReviewResult;
  reviewedAt?: string;
}

export interface ExperimentBucket {
  id: string;
  playbackId: string;
  bucketName: string;
  bucketUrl: string;
  addedBy: string;
  addedAt: string;
}

export interface LayerMetric {
  id: string;
  playbackId: string;
  layerName: string;
  metricName: string;
  oldValue: number;
  newValue: number;
  updatedBy: string;
  updatedAt: string;
}

export interface ImportResult {
  isDuplicate: boolean;
  playbackId: string;
  message: string;
  updatedFields?: string[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}
