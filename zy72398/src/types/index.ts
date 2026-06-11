export type BatchType = 'normal' | 'wrong_caliber' | 'supplementary';
export type TemperatureUnit = 'C' | 'K';
export type ConflictType = 'temperature' | 'dissolved_oxygen' | 'time';
export type ConflictStatus = 'pending' | 'confirmed' | 'rejected';
export type CheckType = 'duplicate_import' | 'temperature_mixed' | 'recalculation' | 'export_consistency';

export interface WorkPhoto {
  id: string;
  batchType: BatchType;
  deviceNo: string;
  dissolvedOxygen: number;
  temperature: number;
  temperatureUnit: TemperatureUnit;
  recordTime: string;
  imageUrl?: string;
  imageName?: string;
  createdAt: string;
}

export interface InspectionNote {
  id: string;
  workPhotoId: string;
  inspectorName: string;
  content: string;
  temperature?: number;
  temperatureUnit?: TemperatureUnit;
  inspectionTime: string;
  noteImageUrl?: string;
  createdAt: string;
}

export interface Conflict {
  id: string;
  workPhotoId: string;
  inspectionNoteId: string;
  conflictType: ConflictType;
  photoValue: string;
  noteValue: string;
  status: ConflictStatus;
  resolverName?: string;
  resolutionRemark?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface DiffusionCalcResult {
  workPhotoId: string;
  deviceNo: string;
  dissolvedOxygen: number;
  temperatureC: number;
  timeHours: number;
  diffusionRate: number;
  batchType: BatchType;
  calculatedAt: string;
}

export interface ReportItem {
  workPhotoId: string;
  deviceNo: string;
  dissolvedOxygen: number;
  temperature: number;
  temperatureUnit: TemperatureUnit;
  recordTime: string;
  hasConflict: boolean;
  conflictResolved: boolean;
  temperatureMixed: boolean;
  diffusionRate?: number;
  reviewStatus: 'pending' | 'reviewed' | 'flagged';
  supplementaryUpdated: boolean;
}

export interface HistoryEntry {
  id: string;
  reportId: string;
  field: string;
  oldValue: string;
  newValue: string;
  modifier: string;
  reason: string;
  modifiedAt: string;
}

export interface HandoverReport {
  id: string;
  batchType: BatchType;
  reportTime: string;
  reviewer?: string;
  status: 'draft' | 'final';
  items: ReportItem[];
  temperatureMixed: boolean;
  conflictCount: number;
  resolvedCount: number;
  deduplicatedItemCount: number;
  diffusionResults: DiffusionCalcResult[];
  inspectionNotes: InspectionNote[];
  conflicts: Conflict[];
  createdAt: string;
}

export interface RecalcDiff {
  deviceNo: string;
  normalDiffusionRate: number;
  supplementaryDiffusionRate: number;
  diffAbsolute: number;
  diffPercent: number;
  recordTime: string;
}

export interface ExportMismatch {
  category: string;
  field: string;
  expectedValue: string;
  actualValue: string;
  recordId: string;
}

export interface SelfCheckResult {
  id: string;
  checkType: CheckType;
  passed: boolean;
  details: string;
  checkedAt: string;
  data?: any;
}

export interface AppState {
  workPhotos: WorkPhoto[];
  inspectionNotes: InspectionNote[];
  conflicts: Conflict[];
  reports: HandoverReport[];
  selfCheckResults: SelfCheckResult[];
  historyEntries: HistoryEntry[];
  currentStep: number;
  currentBatchType: BatchType;
}
