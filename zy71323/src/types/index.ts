export type TidePhase = 'flood' | 'ebb' | 'slack';

export interface TideCycleSegment {
  id: string;
  startTime: number;
  endTime: number;
  tideHeight: number;
  flowVelocity: number;
  phase: TidePhase;
}

export interface DeviceConstraints {
  ratedPower: number;
  maxFlowVelocity: number;
  minFlowVelocity: number;
  maxEfficiency: number;
  impellerDiameter: number;
}

export interface EstimationParams {
  tidalRange: number;
  tidalRangeUnit: 'm' | 'ft';
  flowVelocity: number;
  flowVelocityUnit: 'm/s' | 'knots';
  impellerArea: number;
  impellerAreaUnit: 'm²' | 'ft²';
  efficiency: number;
  tideCycles: TideCycleSegment[];
  deviceConstraints: DeviceConstraints;
}

export interface PeriodIntegrationResult {
  segmentId: string;
  timeRange: string;
  power: number;
  energy: number;
  valid: boolean;
}

export interface ConstraintViolation {
  type: 'efficiency' | 'power' | 'velocity' | 'period_gap' | 'unit';
  field: string;
  message: string;
  actual: number;
  limit: number;
  severity: 'error' | 'warning';
}

export interface DeviceCheckResult {
  passed: boolean;
  violations: ConstraintViolation[];
}

export interface CalculationResult {
  potentialEnergy: number;
  kineticEnergy: number;
  totalEnergy: number;
  dailyGeneration: number;
  annualGeneration: number;
  capacityFactor: number;
  periodIntegration: PeriodIntegrationResult[];
  deviceCheck: DeviceCheckResult;
}

export interface ValidationError {
  code: string;
  field: string;
  message: string;
  suggestion: string;
}

export interface ValidationWarning {
  code: string;
  field: string;
  message: string;
  suggestion: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export type RecordStatus = 'draft' | 'valid' | 'invalid';

export interface EstimationRecord {
  id: string;
  params: EstimationParams;
  result: CalculationResult | null;
  validation: ValidationResult;
  status: RecordStatus;
  parentId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  note?: string;
}

export interface ComparisonScenario {
  id: string;
  recordId: string;
  label: string;
  color: string;
}

export type ExportFormat = 'pdf' | 'markdown';

export interface ExportOptions {
  format: ExportFormat;
  includeParams: boolean;
  includeCalculations: boolean;
  includeValidation: boolean;
  includeCharts: boolean;
  watermark: string;
}
