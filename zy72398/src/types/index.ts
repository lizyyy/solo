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
  createdAt: string;
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
  currentStep: number;
  currentBatchType: BatchType;
}
