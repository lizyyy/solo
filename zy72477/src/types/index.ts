export interface EmergencyShelter {
  id: string;
  name: string;
  address: string;
  designedCapacity: number;
  actualCapacity: number;
  latitude: number;
  longitude: number;
  status: 'normal' | 'construction' | 'closed' | 'pending_review';
  area: string;
  manager: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export interface RedLineMap {
  id: string;
  version: string;
  importBatchNo: string;
  shelterId: string;
  remarks: string;
  areaRange: string;
  effectiveDate: string;
  importOperator: string;
  importTime: string;
  isLatest: boolean;
  isReimport: boolean;
  reimportNote: string | null;
  reviewStatus: 'pending' | 'reviewed' | 'confirmed';
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  prevVersionId: string | null;
}

export interface GridInspectorReport {
  id: string;
  reportNo: string;
  shelterId: string;
  inspectorName: string;
  inspectionDate: string;
  actualCapacity: number;
  foundIssues: string;
  isTemporaryDetour: boolean;
  detourDescription: string;
  roadCondition: 'normal' | 'blocked' | 'detour';
  submittedAt: string;
}

export interface ConflictRecord {
  id: string;
  shelterId: string;
  shelterName: string;
  conflictType: 'capacity_mismatch' | 'status_mismatch' | 'detour_mismatch' | 'other';
  fieldName: string;
  redLineValue: string;
  reportValue: string;
  redLineSource: string;
  reportSource: string;
  description: string;
  status: 'pending' | 'confirmed' | 'rejected';
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export type SelfCheckItemType = 
  | 'duplicate_import' 
  | 'detour_not_synced' 
  | 'recalc_after_supplement' 
  | 'export_consistency';

export interface SelfCheckResult {
  id: string;
  checkType: SelfCheckItemType;
  checkName: string;
  status: 'pass' | 'warning' | 'error';
  description: string;
  affectedRecords: string[];
  details: string;
  checkedAt: string;
}

export interface CalculationParam {
  id: string;
  paramName: string;
  paramVersion: string;
  paramValue: string;
  rationale: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: string;
}

export interface CapacityCheckResult {
  id: string;
  shelterId: string;
  shelterName: string;
  designedCapacity: number;
  checkedCapacity: number;
  deviation: number;
  deviationRate: number;
  checkLevel: 'normal' | 'warning' | 'danger';
  calculationParams: CalculationParam[];
  dataSources: string[];
  isDetourAffected: boolean;
  detourInfo: string | null;
  needsResidentReview: boolean;
  checkTime: string;
  checkedBy: string;
}

export type WorkflowStep = 'redline_import' | 'inspector_review' | 'point_update';

export interface WorkflowRecord {
  id: string;
  shelterId: string;
  currentStep: WorkflowStep;
  stepStatus: 'pending' | 'processing' | 'completed' | 'suspended';
  redLineMapId: string | null;
  inspectorReportId: string | null;
  previousStep: WorkflowStep | null;
  nextStep: WorkflowStep | null;
  operator: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportRecord {
  id: string;
  exportType: 'detail' | 'summary' | 'self_check';
  exportTime: string;
  operator: string;
  fileHash: string;
  recordCount: number;
  dataTimestamp: string;
  batchNo: string;
  exportScope: 'all' | 'by_batch';
  sourceBatchNo: string | null;
}

export interface ChangeHistory {
  id: string;
  entityType: 'redline' | 'inspector_report' | 'capacity_check' | 'shelter' | 'conflict';
  entityId: string;
  shelterId: string;
  shelterName: string;
  changeType: 'create' | 'update' | 'reimport' | 'review' | 'recalc';
  fieldName: string;
  oldValue: string;
  newValue: string;
  operator: string;
  changeTime: string;
  remark: string;
  affectedResultIds: string[];
}

export interface UnifiedDataResponse<T> {
  data: T;
  dataTimestamp: string;
  dataVersion: string;
  source: 'unified_datalayer';
  batchInfo?: {
    currentBatch: string | null;
    historyBatches: string[];
  };
}
