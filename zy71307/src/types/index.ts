export type ThrustUnit = 'g' | 'kg' | 'N' | 'lbf';
export type FitType = 'linear' | 'polynomial' | 'power';
export type IndependentVariable = 'rpm' | 'voltage' | 'propellerDiameter';
export type AnomalyType = 'rpm_missing' | 'voltage_sag' | 'unit_error';
export type AnomalySeverity = 'warning' | 'error' | 'critical';

export interface EnvironmentParams {
  airDensity: number;
  temperature: number;
  humidity: number;
  pressure: number;
}

export interface DataPoint {
  id: string;
  timestamp: number;
  rpm: number;
  voltage: number;
  current: number;
  propellerDiameter: number;
  thrust: number;
  thrustUnit: ThrustUnit;
  isExcluded: boolean;
  notes: string;
}

export interface FittingParams {
  fitType: FitType;
  polynomialDegree: number;
  independentVariable: IndependentVariable;
  controlVariables: {
    rpm?: [number, number];
    voltage?: [number, number];
    propellerDiameter?: number;
  };
  thrustUnit: ThrustUnit;
  rpmSamplingInterval: number;
  voltageSagThreshold: number;
  outlierThreshold: number;
}

export interface AnomalyCalculationDetails {
  expectedValue: number;
  actualValue: number;
  threshold: number;
  deviation: number;
  formula: string;
}

export interface AnomalyPoint {
  id: string;
  dataPointId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  calculationDetails: AnomalyCalculationDetails;
  isIncludedInReport: boolean;
}

export interface CalculationStep {
  step: number;
  description: string;
  formula: string;
  variables: Record<string, number>;
  result: number;
}

export interface ResidualPoint {
  x: number;
  observed: number;
  predicted: number;
  residual: number;
  standardizedResidual: number;
}

export interface FittingResult {
  formula: string;
  coefficients: number[];
  rSquared: number;
  adjustedRSquared: number;
  residuals: ResidualPoint[];
  confidenceInterval: number;
  impactFactors: {
    rpm: number;
    voltage: number;
    propellerDiameter: number;
  };
  calculationSteps: CalculationStep[];
}

export interface EfficiencyPoint {
  rpm: number;
  power: number;
  thrust: number;
  efficiency: number;
  thrustPower: number;
}

export interface EfficiencyResult {
  efficiencyCurve: EfficiencyPoint[];
  optimalOperatingPoint: {
    rpm: number;
    thrust: number;
    efficiency: number;
    power: number;
  };
  efficientRange: {
    minRpm: number;
    maxRpm: number;
    minEfficiency: number;
  };
  calculationSteps: CalculationStep[];
}

export interface Experiment {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  description: string;
  environment: EnvironmentParams;
  dataPoints: DataPoint[];
  fittingParams: FittingParams;
  anomalies: AnomalyPoint[];
  fittingResult: FittingResult | null;
  efficiencyResult: EfficiencyResult | null;
}

export interface FilterConditions {
  rpmRange?: [number, number] | null;
  voltageRange?: [number, number] | null;
  propellerDiameter?: number | null;
  excludeAnomalies: boolean;
}

export interface ReportConfig {
  includeCalculationSteps: boolean;
  includeAnomalyDetails: boolean;
  includeRawData: boolean;
  format: 'pdf' | 'csv';
}
