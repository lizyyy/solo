export type LengthUnit = 'mm' | 'm';
export type VelocityUnit = 'm/s';
export type DensityUnit = 'kg/m³';
export type ViscosityUnit = 'Pa·s' | 'mPa·s';
export type TemperatureUnit = '℃';

export interface ParameterWithUnit<T extends string> {
  value: number | null;
  unit: T;
}

export interface SampleRecord {
  id: string;
  name: string;
  pipeDiameter: ParameterWithUnit<LengthUnit>;
  velocity: ParameterWithUnit<VelocityUnit>;
  density: ParameterWithUnit<DensityUnit>;
  viscosity: ParameterWithUnit<ViscosityUnit>;
  temperature: ParameterWithUnit<TemperatureUnit>;
  status: 'complete' | 'incomplete' | 'anomaly';
  anomalyNotes: string[];
  todoNotes: string[];
}

export interface ConversionStep {
  parameter: string;
  parameterLabel: string;
  fromValue: number;
  fromUnit: string;
  toValue: number;
  toUnit: string;
  formula: string;
}

export interface Anomaly {
  type: 'viscosity_unit_mismatch' | 'temperature_missing' | 'critical_zone';
  field: string;
  fieldLabel: string;
  message: string;
  suggestion: string;
  severity: 'warning' | 'error';
}

export type FlowRegime = 'laminar' | 'transitional' | 'turbulent';

export interface CalculationResult {
  reynoldsNumber: number | null;
  flowRegime: FlowRegime | null;
  isCritical: boolean;
  conversionSteps: ConversionStep[];
  anomalies: Anomaly[];
  canCalculate: boolean;
}

export interface FlowState {
  pipeDiameter: ParameterWithUnit<LengthUnit>;
  velocity: ParameterWithUnit<VelocityUnit>;
  density: ParameterWithUnit<DensityUnit>;
  viscosity: ParameterWithUnit<ViscosityUnit>;
  temperature: ParameterWithUnit<TemperatureUnit>;
  result: CalculationResult | null;
  currentSampleId: string | null;
  currentSampleName: string | null;
}
