export type UserRole = 'engineer' | 'technician' | 'analyst';

export type RecordType = 'smooth' | 'overwritten' | 'supplemented';

export type RecordStatus = 'normal' | 'pending_review' | 'reviewed' | 'rejected';

export type ProcessStep = 'threshold_import' | 'nameplate_review' | 'conversion_update';

export type ProcessStatus = 'pending' | 'in_progress' | 'completed';

export type ConflictStatus = 'pending' | 'confirmed' | 'rejected';

export type DataSource = 'normal' | 'wrong_caliber' | 'supplemented';

export type CaliberSource = 'measurement' | 'nameplate';

export interface ProcessLog {
  id: string;
  recordId: string;
  step: ProcessStep;
  operator: string;
  action: string;
  timestamp: string;
}

export interface CalculationNote {
  id: string;
  recordId: string;
  conversionId: string;
  parameterVersion: string;
  calculationFormula: string;
  tradeOffReason: string;
}

export interface RecordData {
  id: string;
  type: RecordType;
  typeLabel: string;
  measuredSpeed: number;
  averageSpeed: number;
  thresholdMax: number;
  isOverThreshold: boolean;
  isOverwrittenByAverage: boolean;
  caliber: string;
  caliberSource: CaliberSource;
  status: RecordStatus;
  dataSource: DataSource;
  dataSourceLabel: string;
  measurementTime: string;
  processLogs: ProcessLog[];
  calculationNote: CalculationNote;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface ThresholdTable {
  id: string;
  version: string;
  maxAllowedSpeed: number;
  minAllowedSpeed: number;
  importDate: string;
  importBy: string;
}

export interface NameplateParam {
  id: string;
  equipmentId: string;
  equipmentName: string;
  caliber: string;
  ratedSpeed: number;
  calibrationDate: string;
  parameterVersion: string;
  manufacturer: string;
}

export interface ConflictDecision {
  id: string;
  conflictId: string;
  decision: 'confirm' | 'reject';
  reason: string;
  operator: string;
  decisionTime: string;
}

export interface ConflictData {
  id: string;
  item: string;
  thresholdValue: number;
  thresholdSource: string;
  thresholdVersion: string;
  nameplateValue: number;
  nameplateSource: string;
  nameplateVersion: string;
  evidence: string[];
  status: ConflictStatus;
  decision?: ConflictDecision;
}

export interface UnitConversion {
  id: string;
  formula: string;
  formulaDisplay: string;
  parameterVersion: string;
  parameterSource: 'threshold' | 'nameplate';
  parameterSourceLabel: string;
  tradeOffReason: string;
  updateTime: string;
  updatedBy: string;
  historyVersions: ConversionHistory[];
}

export interface ConversionHistory {
  version: string;
  formula: string;
  parameterSource: string;
  updateTime: string;
  reason: string;
}

export interface ProcessState {
  currentStep: ProcessStep;
  steps: Record<ProcessStep, ProcessStatus>;
  thresholdImported: boolean;
  nameplateReviewedByHe: boolean;
  conversionUpdated: boolean;
}

export interface AppState {
  currentRole: UserRole;
  records: RecordData[];
  thresholdTable: ThresholdTable;
  nameplateParams: NameplateParam[];
  conflicts: ConflictData[];
  unitConversion: UnitConversion;
  processState: ProcessState;
  selectedRecordId: string | null;
}
