export type ConcentrationUnit = 'mg/L' | 'μg/mL' | 'ng/mL';

export type EvidenceType = 'interval' | 'unit_mismatch' | 'threshold_cross';

export type EventType = 'dosing' | 'peak' | 'trough' | 'cross_threshold';

export interface DrugParams {
  id: string;
  name: string;
  halfLife: number;
  volumeOfDistribution: number;
  therapeuticMin: number;
  therapeuticMax: number;
  unit: ConcentrationUnit;
}

export interface DosingRegimen {
  dose: number;
  interval: number;
  dosesCount: number;
  startTime: number;
}

export interface SimulationConfig {
  drug: DrugParams;
  dosing: DosingRegimen;
  simulationDuration: number;
  timeStep: number;
}

export interface SimulationResultPoint {
  time: number;
  concentration: number;
  isDosingPoint: boolean;
  isAboveMax: boolean;
  isBelowMin: boolean;
  eventType?: EventType;
}

export interface EvidenceItem {
  type: EvidenceType;
  timestamp: number;
  value: number;
  description: string;
  order?: number;
}

export interface SimulationConclusion {
  steadyStateConcentration: number;
  timeToReachSteadyState: number;
  peakConcentration: number;
  troughConcentration: number;
  hasConcentrationIssue: boolean;
  issueDescription: string;
  doseHalfLifeConsistent: boolean;
  evidence: EvidenceItem[];
}

export interface SimulationData {
  config: SimulationConfig;
  results: SimulationResultPoint[];
  conclusion: SimulationConclusion;
}

export interface SampleData {
  id: string;
  name: string;
  description: string;
  config: SimulationConfig;
}
