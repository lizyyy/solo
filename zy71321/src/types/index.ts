export interface SimulationParams {
  turns: number;
  fieldStrength: number;
  velocity: number;
  area: number;
  samplePoints: number;
  direction: 1 | -1;
}

export interface CalculationLog {
  stepId: string;
  timestamp: number;
  formula: string;
  rawInputs: SimulationParams;
  intermediate: {
    maxFlux: number;
    dFlux_dt: number;
  };
  result: {
    voltage: number[];
    maxVoltage: number;
    minVoltage: number;
    timePoints: number[];
  };
}

export type WarningType = 'zero_turns' | 'reverse_direction' | 'curve_truncated' | 'extreme_value';
export type WarningSeverity = 'warning' | 'to_confirm';

export interface BoundaryWarning {
  id: string;
  type: WarningType;
  severity: WarningSeverity;
  message: string;
  confirmed: boolean;
}

export type ExportType = 'screenshot' | 'report' | 'data';

export interface ExportRecord {
  id: string;
  type: ExportType;
  timestamp: number;
  dataHash: string;
}

export interface SimulationSession {
  id: string;
  params: SimulationParams;
  calculationHistory: CalculationLog[];
  warnings: BoundaryWarning[];
  exportHistory: ExportRecord[];
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_PARAMS: SimulationParams = {
  turns: 100,
  fieldStrength: 0.5,
  velocity: 2.0,
  area: 0.01,
  samplePoints: 100,
  direction: 1,
};

export const PARAM_RANGES = {
  turns: { min: 0, max: 500, step: 1 },
  fieldStrength: { min: 0, max: 2.0, step: 0.01 },
  velocity: { min: 0, max: 10.0, step: 0.1 },
  area: { min: 0.001, max: 0.1, step: 0.001 },
  samplePoints: { min: 10, max: 500, step: 10 },
};

export const TEACHING_RANGES = {
  turns: { min: 10, max: 300 },
  fieldStrength: { min: 0.1, max: 1.0 },
  velocity: { min: 0.5, max: 5.0 },
  area: { min: 0.005, max: 0.05 },
};
