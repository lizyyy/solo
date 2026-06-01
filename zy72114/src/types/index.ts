export type ValidationType = 'direction' | 'unit' | 'timeInterval' | 'valueRange' | 'format';
export type Severity = 'info' | 'warning' | 'error';
export type SafetyLevel = 'low' | 'medium' | 'high' | 'danger';
export type PhysicsModel = 'projectile' | 'energy' | 'full';
export type DiffType = 'added' | 'modified' | 'removed';

export interface Project {
  id: string;
  name: string;
  batchNumber: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'validating' | 'calculated' | 'reported' | 'archived';
}

export interface SensorRecord {
  id: string;
  projectId: string;
  timestamp: string;
  angle: number | null;
  angleUnit: string;
  velocity: number | null;
  velocityUnit: string;
  acceleration: number | null;
  accelerationUnit: string;
  direction: string;
  timeInterval: number | null;
  timeIntervalUnit: string;
  source: 'sensor' | 'manual' | 'imported';
  isDirty?: boolean;
  dirtyReason?: string;
}

export interface DeviceParam {
  id: string;
  projectId: string;
  paramName: string;
  value: number | null;
  unit: string;
  description: string;
  category: 'structure' | 'material' | 'operation';
}

export interface FieldNote {
  id: string;
  projectId: string;
  content: string;
  recordedAt: string;
  recorder: string;
  isOriginal: boolean;
  isSupplementary?: boolean;
}

export interface ManualCorrection {
  id: string;
  projectId: string;
  fieldName: string;
  oldValue: number | null;
  newValue: number | null;
  oldUnit: string;
  newUnit: string;
  reason: string;
  correctedAt: string;
  corrector: string;
}

export interface ValidationIssue {
  id: string;
  projectId: string;
  type: ValidationType;
  severity: Severity;
  field: string;
  recordId?: string;
  message: string;
  suggestion: string;
}

export interface DataConflict {
  id: string;
  projectId: string;
  field: string;
  recordId?: string;
  photoEvidence: string;
  photoValue?: number;
  photoUnit?: string;
  importedValue: string;
  importedSource: string;
  suggestedActions: string[];
  userDecision?: string;
  decidedAt?: string;
}

export interface CalculationResult {
  id: string;
  projectId: string;
  physicsModel: PhysicsModel;
  range: number;
  rangeUnit: string;
  impactEnergy: number;
  impactEnergyUnit: string;
  maxHeight: number;
  maxHeightUnit: string;
  flightTime: number;
  flightTimeUnit: string;
  safetyLevel: SafetyLevel;
  unitSystem: 'metric' | 'imperial';
  calculatedAt: string;
  processingSuggestion: string;
}

export interface HistoryVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  snapshot: ProjectSnapshot;
  changeDescription: string;
  createdAt: string;
  createdBy: string;
}

export interface ProjectSnapshot {
  project: Project;
  sensorRecords: SensorRecord[];
  deviceParams: DeviceParam[];
  fieldNotes: FieldNote[];
  manualCorrections: ManualCorrection[];
  calculationResult?: CalculationResult;
}

export interface DiffItem {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  type: DiffType;
  path: string;
}

export interface ComparisonResult {
  versionA: HistoryVersion;
  versionB: HistoryVersion;
  diffs: DiffItem[];
  isSupplementaryNote: boolean;
  supplementaryNoteDescription?: string;
}

export interface UnitConversionTable {
  quantity: string;
  fromUnit: string;
  toUnit: string;
  value: number;
  convertedValue: number;
}

export type SampleDataType = 'normal' | 'dirty' | 'conflict';

export interface SampleData {
  type: SampleDataType;
  name: string;
  description: string;
  project: Project;
  sensorRecords: SensorRecord[];
  deviceParams: DeviceParam[];
  fieldNotes: FieldNote[];
}
