export interface SensorBatch {
  id: string;
  name: string;
  importTime: string;
  source: string;
  recordCount: number;
}

export interface SensorRecord {
  id: string;
  batchId: string;
  timestamp: number;
  vehicleSpeed: number | null;
  brakePressure: number | null;
  motorRpm: number | null;
  batteryVoltage: number | null;
  batteryCurrent: number | null;
  temperature: number | null;
  status: 'normal' | 'empty_field' | 'duplicate' | 'boundary' | 'anomaly' | 'corrected';
}

export interface FieldNote {
  id: string;
  batchId: string;
  startTime: number;
  endTime: number;
  content: string;
  eventType: string;
}

export interface ManualCorrection {
  id: string;
  batchId: string;
  recordId: string;
  field: string;
  oldValue: number | null;
  newValue: number;
  reason: string;
  correctedBy: string;
  correctedAt: string;
}

export interface DeviceParam {
  id: string;
  name: string;
  description: string;
}

export interface ParamVersion {
  id: string;
  paramId: string;
  versionNumber: number;
  values: ParamValues;
  changedBy: string;
  changedAt: string;
  changeNote: string;
}

export interface ParamValues {
  vehicleMass: number;
  wheelRadius: number;
  transmissionRatio: number;
  motorEfficiency: number;
  maxBrakeForce: number;
  maxVehicleSpeed: number;
  maxMotorRpm: number;
  maxBatteryVoltage: number;
  minBatteryVoltage: number;
  maxBatteryCurrent: number;
  motorTorqueCoefficients: number[];
}

export interface EstimationRun {
  id: string;
  batchId: string;
  paramVersionId: string;
  runTime: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface EstimationResult {
  id: string;
  runId: string;
  timestamp: number;
  regenBrakeForce: number;
  energyRecoveryRate: number;
  totalEnergyRecovered: number;
  anomalyFlag: 'none' | 'warning' | 'severe' | 'excluded';
}

export interface AnomalyRecord {
  id: string;
  runId: string;
  recordId: string;
  level: 'warning' | 'severe' | 'excluded';
  type: 'physical_limit' | 'trend_deviation' | 'note_contradiction' | 'empty_value' | 'duplicate' | 'boundary';
  description: string;
  evidence: string;
  resolution: string;
}

export interface ConflictRecord {
  id: string;
  runId: string;
  noteId: string;
  recordId: string;
  sensorEvidence: string;
  noteEvidence: string;
  suggestedAction: string;
  userDecision: string;
  decisionReason: string;
  decisionTime: string | null;
}

export interface DirtyDataRecord {
  id: string;
  batchId: string;
  recordId: string;
  dirtyType: 'empty_value' | 'duplicate' | 'boundary';
  field: string;
  description: string;
  suggestion: string;
  resolution: string;
}

export type AnomalyLevel = 'warning' | 'severe' | 'excluded';
export type DirtyType = 'empty_value' | 'duplicate' | 'boundary';
export type ConflictDecision = 'use_sensor' | 'use_note' | 'mark_pending' | 'exclude';
