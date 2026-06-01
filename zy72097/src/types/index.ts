export interface RawData {
  id: string;
  material: string;
  stress: number | null;
  stressUnit: string;
  life: number | null;
  lifeUnit: string;
  source: string;
  remark: string;
  testDate: string;
  importedAt: string;
}

export interface ProcessedData extends RawData {
  stressConverted: number | null;
  lifeConverted: number | null;
  targetStressUnit: string;
  targetLifeUnit: string;
  isDuplicate: boolean;
  isNull: boolean;
  isAnomaly: boolean;
  anomalyReason: string;
  status: 'normal' | 'pending' | 'confirmed' | 'historical';
  processHistory: ProcessRecord[];
  judgment: JudgmentRecord[];
}

export interface ProcessRecord {
  id: string;
  dataId: string;
  processType: 'unit_conversion' | 'null_fill' | 'duplicate_merge' | 'anomaly_mark';
  originalValue: string;
  processedValue: string;
  reason: string;
  operator: 'system' | 'user';
  operatedAt: string;
}

export interface JudgmentRecord {
  id: string;
  dataId: string;
  status: 'normal' | 'pending' | 'confirmed' | 'historical';
  judgment: string;
  judge: string;
  judgedAt: string;
  evidence: string;
}

export interface FittingResult {
  model: 'power' | 'exponential' | 'basquin';
  formula: string;
  parameters: {
    a: number;
    b: number;
    r2: number;
  };
  weightClosure: number;
  boundaryCheck: {
    minStress: number;
    maxStress: number;
    outOfBounds: string[];
  };
  points: FittingPoint[];
}

export interface FittingPoint {
  stress: number;
  life: number;
  predictedLife: number;
  residual: number;
  dataId: string;
}

export interface QualityIssue {
  type: 'null' | 'duplicate' | 'unit_mismatch' | 'anomaly';
  dataId: string;
  rowIndex: number;
  field: string;
  originalValue: string;
  description: string;
  suggestion: string;
}

export type FittingModel = 'power' | 'exponential' | 'basquin';

export type DataStatus = 'normal' | 'pending' | 'confirmed' | 'historical';

export interface PreprocessConfig {
  targetStressUnit: string;
  targetLifeUnit: string;
  testFrequency: number;
  fillNullStrategy: 'drop' | 'interpolate' | 'manual';
  mergeDuplicateStrategy: 'average' | 'keep_first' | 'keep_last';
  anomalyThreshold: number;
}
