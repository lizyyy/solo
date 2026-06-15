export type RecordStatus = 'normal' | 'pending_review' | 'conflict' | 'completed';

export type RecordType = 'smooth' | 'duplicate_training' | 'old_caliber';

export type StepKey = 'import_log' | 'review_notes' | 'update_version';

export type StepStatusType = 'completed' | 'current' | 'pending' | 'blocked';

export interface StepStatus {
  key: StepKey;
  label: string;
  status: StepStatusType;
  blockedReason?: string;
}

export interface TrainingLogPoint {
  epoch: number;
  loss: number;
  accuracy: number;
}

export interface TrainingLog {
  id: string;
  batchId: string;
  curveData: TrainingLogPoint[];
  importTime: string;
  isDuplicate: boolean;
  duplicateOf?: string;
}

export interface ThresholdNote {
  id: string;
  version: string;
  content: string;
  updateTime: string;
  operator: string;
  isOldCaliber: boolean;
}

export interface FeatureVersion {
  version: string;
  featureName: string;
  caliber: string;
  updateTime: string;
  operator: string;
  remark: string;
}

export interface ConflictEvidence {
  id: string;
  type: 'log_vs_note' | 'version_mismatch';
  description: string;
  logEvidence?: string;
  noteEvidence?: string;
  resolution?: 'confirmed' | 'rejected' | null;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface ReviewHistoryItem {
  operator: string;
  action: string;
  time: string;
  remark: string;
}

export interface CheckRecord {
  id: string;
  title: string;
  type: RecordType;
  status: RecordStatus;
  currentStep: StepKey;
  steps: StepStatus[];
  batchId: string;
  featureName: string;
  createTime: string;
  updateTime: string;
  trainingLog: TrainingLog;
  thresholdNote: ThresholdNote;
  featureVersions: FeatureVersion[];
  conflicts: ConflictEvidence[];
  reviewHistory: ReviewHistoryItem[];
}

export const statusLabelMap: Record<RecordStatus, string> = {
  normal: '正常',
  pending_review: '待策略产品复核',
  conflict: '有冲突',
  completed: '已完成',
};

export const statusColorMap: Record<RecordStatus, string> = {
  normal: 'bg-emerald-600',
  pending_review: 'bg-amber-600',
  conflict: 'bg-red-600',
  completed: 'bg-slate-600',
};

export const typeLabelMap: Record<RecordType, string> = {
  smooth: '顺利记录',
  duplicate_training: '重复训练',
  old_caliber: '旧口径补录',
};

export interface ReconcileItem {
  id: string;
  label: string;
  match: boolean;
  left: string;
  right: string;
  detail?: string;
}

export interface ReconcileResult {
  status: 'ok' | 'warn' | 'blocked' | 'pending';
  summary: string;
  items: ReconcileItem[];
  nextAction?: string;
}
