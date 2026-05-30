export type BatchStatus = 'draft' | 'analyzed' | 'reported';

export type ChangeType = 'manual' | 'automatic';

export type TimeUnit = 's' | 'ms' | 'μs';

export type ResistanceUnit = 'Ω' | 'kΩ' | 'MΩ';

export type CapacitanceUnit = 'F' | 'μF' | 'nF' | 'pF';

export type FitMode = 'charge' | 'discharge';

export interface Batch {
  id: string;
  batchNo: string;
  studentName: string;
  experimentDate: string;
  resistance: number | null;
  resistanceUnit: ResistanceUnit;
  capacitance: number | null;
  capacitanceUnit: CapacitanceUnit;
  initialVoltage: number | null;
  supplyVoltage: number | null;
  timeUnit: TimeUnit;
  status: BatchStatus;
  needsReanalysis: boolean;
  fitMode: FitMode;
  createdAt: string;
  updatedAt: string;
  dataVersion: number;
}

export interface SamplePoint {
  id: string;
  batchId: string;
  time: number;
  voltage: number;
  isOutlier: boolean;
  outlierReason: string | null;
  residual: number | null;
  sequence: number;
}

export interface HistoryRecord {
  id: string;
  batchId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  modifiedBy: string;
  changeType: ChangeType;
  description: string;
  timestamp: string;
  version: number;
}

export interface FitResult {
  id: string;
  batchId: string;
  tau: number;
  tauStdErr: number;
  rSquared: number;
  adjustedRSquared: number;
  rootMeanSquaredError: number;
  fittedParams: {
    V0: number;
    Vs: number;
    tau: number;
  };
  confidenceInterval: {
    lower: number[];
    upper: number[];
  };
  algorithm: string;
  computedAt: string;
  dataVersion: number;
}

export interface ValidationError {
  id: string;
  field: string;
  severity: 'error' | 'warning';
  message: string;
  target: string;
  suggestion: string;
}

export interface FilterCriteria {
  dateRange: [string, string] | null;
  studentName: string | null;
  resistanceRange: [number, number] | null;
  capacitanceRange: [number, number] | null;
  status: BatchStatus | null;
}

export interface ParameterImpact {
  name: string;
  label: string;
  impact: number;
  unit: string;
}

export interface TheoryPoint {
  time: number;
  voltage: number;
}
