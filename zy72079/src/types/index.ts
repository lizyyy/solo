export type RecordStatus = 'success' | 'pending' | 'legacy' | 'error';
export type AnomalyType = 'empty_value' | 'duplicate' | 'unit_mismatch' | 'outlier' | 'boundary';
export type AnomalySeverity = 'high' | 'medium' | 'low';
export type DataSource = 'system' | 'manual' | 'legacy';
export type AreaType = '东城区' | '西城区' | '朝阳区' | '海淀区' | '丰台区' | '石景山区';

export interface CalculationStep {
  stepId: string;
  description: string;
  input: Record<string, any>;
  output: Record<string, any>;
  unitBefore?: string;
  unitAfter?: string;
  formula: string;
}

export interface Anomaly {
  type: AnomalyType;
  field: string;
  description: string;
  severity: AnomalySeverity;
}

export interface RawPipeData {
  pipeLength?: number;
  pipeDiameter?: number;
  pipeDiameterUnit?: string;
  rainfallIntensity?: number;
  rainfallUnit?: string;
  runoffCoefficient?: number;
}

export interface CalculatedResult {
  capacity: number;
  unit: string;
}

export interface EstimationRecord {
  id: string;
  recordNo: string;
  area: AreaType;
  calculationDate: string;
  rawData: RawPipeData;
  calculatedResult?: CalculatedResult;
  status: RecordStatus;
  calculationSteps: CalculationStep[];
  anomalies: Anomaly[];
  parameterVersion: string;
  source: DataSource;
  remark: string;
  failureReason?: string;
  createdAt: string;
}

export interface FilterState {
  status: RecordStatus[];
  area: AreaType[];
  dateRange: {
    start: string;
    end: string;
  };
  source: DataSource[];
}

export interface ParameterVersion {
  version: string;
  effectiveDate: string;
  parameters: {
    minPipeDiameter: number;
    maxPipeDiameter: number;
    minRainfallIntensity: number;
    maxRainfallIntensity: number;
    minRunoffCoefficient: number;
    maxRunoffCoefficient: number;
    capacityUnit: string;
  };
}

export interface ExportConfig {
  includeSteps: boolean;
  includeAnomalies: boolean;
  format: 'csv' | 'xlsx';
}
