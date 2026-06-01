export interface SensorData {
  timestamp: number;
  velocity: number;
  acceleration: number;
  temperature: number;
  vibration: number;
  pressure: number;
}

export interface DeviceParams {
  id: string;
  name: string;
  mass: number;
  slopeAngle: number;
  frictionCoeff: number;
  gravity: number;
  normalTempMin: number;
  normalTempMax: number;
  vibrationThreshold: number;
  updatedAt: number;
}

export interface FieldNote {
  id: string;
  timestamp: number;
  content: string;
  author: string;
  createdAt: number;
}

export interface ManualCorrection {
  id: string;
  dataPointIndex: number;
  field: keyof SensorData;
  originalValue: number;
  correctedValue: number;
  reason: string;
  author: string;
  createdAt: number;
}

export interface EnergyPoint {
  timestamp: number;
  value: number;
  unit: string;
}

export type AnomalyType = 'temperature' | 'vibration' | 'energy' | 'velocity';
export type AnomalySeverity = 'warning' | 'critical';

export interface Anomaly {
  id: string;
  timestamp: number;
  dataIndex: number;
  type: AnomalyType;
  severity: AnomalySeverity;
  value: number;
  threshold: number;
  deviation: number;
  reason: string;
  acknowledged: boolean;
}

export interface ExtremeValue {
  id: string;
  type: 'max' | 'min';
  field: string;
  value: number;
  timestamp: number;
  dataIndex: number;
  avgValue: number;
  deviationPercent: number;
}

export interface AnalysisSummary {
  totalSamples: number;
  avgKineticEnergy: number;
  avgPotentialEnergy: number;
  totalEnergyLoss: number;
  maxTemperature: number;
  maxVibration: number;
  anomalyCount: number;
  criticalAnomalyCount: number;
  duration: number;
}

export interface EnergyAnalysis {
  id: string;
  batchName: string;
  sensorData: SensorData[];
  deviceParams: DeviceParams;
  fieldNotes: FieldNote[];
  manualCorrections: ManualCorrection[];
  kineticEnergy: EnergyPoint[];
  potentialEnergy: EnergyPoint[];
  totalEnergy: EnergyPoint[];
  energyLoss: EnergyPoint[];
  anomalies: Anomaly[];
  extremeValues: ExtremeValue[];
  summary: AnalysisSummary;
  createdAt: number;
  sourceFiles: string[];
  analysisReason?: string;
}

export interface AnalysisHistory {
  id: string;
  analyses: EnergyAnalysis[];
  updatedAt: number;
}
