export type TemperatureUnit = '°C' | '°F' | 'K';
export type PowerUnit = 'kW' | 'W' | 'BTU/h' | 'RT';
export type AreaUnit = 'm²' | 'ft²';
export type ThicknessUnit = 'mm' | 'cm' | 'in';

export type DataStatus = 'clean' | 'missing' | 'unit_mismatch' | 'conflict';
export type RecordStatus = 'normal' | 'pending' | 'old_caliber' | 'extreme';
export type BatchStatus = 'draft' | 'processing' | 'completed' | 'archived';
export type AbnormalType = 'threshold_exceed' | 'extreme_value' | 'data_conflict' | 'missing_data';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type ConfirmStatus = 'pending' | 'confirmed' | 'rejected';
export type SourceType = 'import' | 'inspection' | 'manual';
export type ConflictStatus = 'none' | 'pending' | 'resolved';
export type DecisionType = 'parameter_change' | 'status_change' | 'conflict_resolve' | 'extreme_handle';
export type ConflictResolution = 'use_imported' | 'use_inspection' | 'custom';
export type ReportFormat = 'pdf' | 'markdown';

export interface PhysicsParams {
  iceArea: number;
  iceAreaUnit: AreaUnit;
  iceThickness: number;
  iceThicknessUnit: ThicknessUnit;
  iceTemperature: number;
  iceTemperatureUnit: TemperatureUnit;
  ambientTemperature: number;
  ambientTemperatureUnit: TemperatureUnit;
  ambientHumidity: number;
  peopleCount: number;
  equipmentPower: number;
  equipmentPowerUnit: PowerUnit;
  lightingPower: number;
  lightingPowerUnit: PowerUnit;
}

export interface ThresholdConfig {
  maxCoolingLoad: number;
  maxCoolingLoadUnit: PowerUnit;
  warningRatio: number;
  extremeOutlierThreshold: number;
  expectedIntervalMinutes: number;
}

export interface DataSource {
  id: string;
  recordId: string;
  sourceType: SourceType;
  sourceFile: string;
  sourceLine: number;
  originalValue: string;
  originalUnit: string;
  importTimestamp: Date;
}

export interface UnitConversion {
  id: string;
  fromUnit: string;
  toUnit: string;
  fromValue: number;
  toValue: number;
  formula: string;
}

export interface CalculationStep {
  id: string;
  name: string;
  formula: string;
  inputs: Record<string, number>;
  result: number;
  unit: string;
}

export interface DataRecord {
  id: string;
  batchId: string;
  timestamp: Date;
  temperature: number;
  temperatureUnit: TemperatureUnit;
  humidity: number;
  coolingLoad?: number;
  coolingLoadUnit?: PowerUnit;
  dataStatus: DataStatus;
  recordStatus: RecordStatus;
  sources: DataSource[];
  missingFields: string[];
  unitIssues: string[];
  notes?: string;
}

export interface CalculationResult {
  id: string;
  recordId: string;
  totalLoad: number;
  totalLoadUnit: PowerUnit;
  iceLoad: number;
  convectionLoad: number;
  radiationLoad: number;
  moistureLoad: number;
  personnelLoad: number;
  equipmentLoad: number;
  lightingLoad: number;
  calculationSteps: CalculationStep[];
  unitConversions: UnitConversion[];
}

export interface AbnormalRecord {
  id: string;
  recordId: string;
  type: AbnormalType;
  severity: Severity;
  threshold: number;
  actualValue: number;
  description: string;
  confirmStatus: ConfirmStatus;
  confirmedBy?: string;
  confirmedAt?: Date;
  notes?: string;
}

export interface InspectionData {
  id: string;
  batchId: string;
  source: string;
  caliber: 'new' | 'old';
  recordDate: Date;
  rawData: Record<string, any>;
  conflictStatus: ConflictStatus;
  conflictingFields: string[];
  conflictEvidence?: {
    importedData: any;
    inspectionData: any;
    suggestions: string[];
  };
  resolution?: {
    type: ConflictResolution;
    resolvedBy: string;
    resolvedAt: Date;
    notes: string;
  };
}

export interface DecisionTrace {
  id: string;
  batchId: string;
  recordId?: string;
  decisionType: DecisionType;
  beforeValue: any;
  afterValue: any;
  reason: string;
  operator: string;
  timestamp: Date;
  notes?: string;
}

export interface Batch {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  parameters: PhysicsParams;
  thresholds: ThresholdConfig;
  status: BatchStatus;
  createdBy: string;
  records: DataRecord[];
  calculationResults: CalculationResult[];
  abnormalRecords: AbnormalRecord[];
  inspectionData: InspectionData[];
  decisionTraces: DecisionTrace[];
}

export interface UnitIssue {
  recordId: string;
  field: string;
  original: string;
  normalized: string;
  confidence: number;
}

export interface OutlierDetectionResult {
  outliers: number[];
  outlierIndices: number[];
  bounds: { lower: number; upper: number };
  stats: { median: number; q1: number; q3: number; iqr: number; mean: number; robustMean: number };
}

export interface ConflictInfo {
  recordId: string;
  inspectionId: string;
  field: string;
  importedValue: any;
  inspectionValue: any;
  difference: number;
  suggestions: string[];
}

export interface AppState {
  currentBatch: Batch | null;
  batches: Batch[];
  activeTab: string;
  selectedRecordId: string | null;
  comparisonBatchIds: string[];
  operatorName: string;
}

export interface AppActions {
  createBatch: (name: string, params?: Partial<PhysicsParams>) => Batch;
  importData: (batchId: string, data: any[], fileName: string) => void;
  importInspection: (batchId: string, data: any[], sourceName: string, caliber: 'new' | 'old') => void;
  runCalculation: (batchId: string) => void;
  updateParameters: (batchId: string, params: Partial<PhysicsParams>, reason: string) => void;
  updateThresholds: (batchId: string, thresholds: Partial<ThresholdConfig>, reason: string) => void;
  confirmAbnormal: (batchId: string, abnormalId: string, status: ConfirmStatus, notes: string) => void;
  resolveConflict: (batchId: string, inspectionId: string, resolution: ConflictResolution, notes: string) => void;
  updateRecordStatus: (batchId: string, recordId: string, status: RecordStatus, reason: string, notes?: string) => void;
  saveBatch: (batchId: string) => void;
  loadBatch: (batchId: string) => void;
  deleteBatch: (batchId: string) => void;
  exportReport: (batchId: string, format: ReportFormat) => Blob;
  addDecisionTrace: (batchId: string, trace: Omit<DecisionTrace, 'id' | 'timestamp'>) => void;
  setActiveTab: (tab: string) => void;
  setSelectedRecordId: (id: string | null) => void;
  toggleComparisonBatch: (batchId: string) => void;
  setOperatorName: (name: string) => void;
  generateSampleData: () => Batch;
}

export type AppStore = AppState & AppActions;
