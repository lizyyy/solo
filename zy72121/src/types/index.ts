export type DataQuality = 'good' | 'missing' | 'unit_mismatch' | 'outlier';
export type RiskLevel = 'normal' | 'warning' | 'danger';

export interface InspectionRecord {
  id: string;
  location: string;
  curtainType: string;
  temperatureInside: number | null;
  tempInsideUnit: string;
  temperatureOutside: number | null;
  tempOutsideUnit: string;
  curtainArea: number | null;
  areaUnit: string;
  airChangeRate: number | null;
  samplingTime: string;
  source: string;
  dataQuality: DataQuality;
  dataIssues: string[];
  note?: string;
}

export interface CalculationParams {
  airDensity: number;
  specificHeatCapacity: number;
  heatTransferCoeff: number;
  openingTimeFactor: number;
}

export interface ThresholdVersion {
  id: string;
  version: string;
  warningThreshold: number;
  dangerThreshold: number;
  unit: string;
  description: string;
  createdAt: string;
  createdBy: string;
  isActive: boolean;
}

export interface HeatLossResult {
  id: string;
  recordId: string;
  batchId: string;
  thresholdVersionId: string;
  heatLossValue: number;
  unit: string;
  riskLevel: RiskLevel;
  calculationParams: CalculationParams;
  processedAt: string;
  processedBy: string;
}

export interface CalculationBatch {
  id: string;
  name: string;
  sourceFile?: string;
  createdAt: string;
  createdBy: string;
  paramsSnapshot: CalculationParams;
  thresholdVersionId: string;
  recordCount: number;
  notes: Note[];
}

export interface Note {
  id: string;
  batchId: string;
  recordId: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

export interface DataQualityIssue {
  recordId: string;
  type: 'missing' | 'unit_mismatch' | 'outlier';
  field: string;
  message: string;
  suggestion: string;
}

export interface BatchComparison {
  batchA: CalculationBatch;
  batchB: CalculationBatch;
  resultsA: HeatLossResult[];
  resultsB: HeatLossResult[];
  recordsA: InspectionRecord[];
  recordsB: InspectionRecord[];
}
