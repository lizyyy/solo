export type TemperatureUnit = 'Celsius' | 'Kelvin';

export type ThresholdStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'needs_manual';

export type WorkflowStep = 'import' | 'engineer_review' | 'coach_review' | 'report';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export type UserRole = 'engineer' | 'coach';

export type ImportSource = 'file' | 'sample' | 'manual';

export type ImportFileFormat = 'csv' | 'json' | 'xlsx' | 'unknown';

export interface ImportBatch {
  id: string;
  batchNo: string;
  source: ImportSource;
  format: ImportFileFormat;
  fileName?: string;
  importedBy: string;
  importedAt: string;
  totalCount: number;
  successCount: number;
  duplicateCount: number;
  errorCount: number;
  thresholdIds: string[];
  messages: string[];
}

export interface ManualReviewRecord {
  id: string;
  thresholdId: string;
  reviewType: 'unit_mix' | 'value_anomaly' | 'remark_change' | 'other';
  originalValue: string;
  originalUnit?: TemperatureUnit;
  modifiedValue?: string;
  modifiedUnit?: TemperatureUnit;
  decision: 'confirmed' | 'rejected' | 'pending';
  reason: string;
  reviewedBy: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface ThresholdData {
  id: string;
  name: string;
  value: number;
  unit: TemperatureUnit;
  deviceId: string;
  remark: string;
  status: ThresholdStatus;
  calculationModel?: string;
  modelVersion?: string;
  tradeOffReason?: string;
  hasUnitMix: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  importBatchId?: string;
  manualReviewId?: string;
  exportTraceId?: string;
  originalImportedValue?: number;
  originalImportedUnit?: TemperatureUnit;
}

export interface HistoryRecord {
  id: string;
  thresholdId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  modifiedBy: string;
  modifiedAt: string;
  changeReason: string;
  consistencySnapshot?: {
    thresholdStatus?: ThresholdStatus;
    workflowStep?: WorkflowStep;
    batchId?: string;
  };
}

export interface WorkflowTask {
  id: string;
  thresholdId: string;
  step: WorkflowStep;
  status: TaskStatus;
  assignee: UserRole;
  previousStep?: WorkflowStep;
  nextStep?: WorkflowStep;
  createdAt: string;
  completedAt?: string;
  consistencyCheckedAt?: string;
}

export interface HandoverReport {
  id: string;
  thresholdId: string;
  content: string;
  retentionReason: string;
  missingMaterials: string[];
  nextAction: string;
  assigneeRole: UserRole;
  createdBy: string;
  createdAt: string;
  exportTraceId?: string;
  snapshot?: {
    thresholdValue: number;
    thresholdUnit: TemperatureUnit;
    thresholdStatus: ThresholdStatus;
    thresholdRemark: string;
  };
}

export interface Device {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  nameplateParams: {
    ratedTemperature: number;
    temperatureUnit: TemperatureUnit;
    [key: string]: any;
  };
}

export interface ImportResult {
  success: number;
  duplicate: number;
  error: number;
  messages: string[];
  batchId?: string;
  importedIds: string[];
}

export interface ExportPackage {
  exportId: string;
  exportedAt: string;
  exportedBy: string;
  type: 'threshold' | 'report' | 'batch';
  referenceIds: string[];
  data: any;
  hash: string;
}
