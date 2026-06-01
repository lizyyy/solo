export type RecordType = 'success' | 'pending' | 'legacy';
export type SampleStatus = 'normal' | 'abnormal' | 'manual' | 'legacy';
export type BatchStatus = 'running' | 'completed' | 'error';

export interface ParamItem {
  value: number;
  unit: string;
  description: string;
}

export interface ParamVersion {
  id: string;
  version: string;
  name: string;
  parameters: Record<string, ParamItem>;
  createdAt: string;
  createdBy: string;
}

export interface CalculationStep {
  step: number;
  name: string;
  formula: string;
  input: Record<string, number | string>;
  output: number;
  unit: string;
  remark?: string;
}

export interface UnitCheckResult {
  passed: boolean;
  issues: string[];
}

export interface CalculationRecord {
  id: string;
  batchId: string;
  sampleId: string;
  sampleName: string;
  type: RecordType;
  inputData: Record<string, number | string>;
  outputData: Record<string, number>;
  formula: string;
  unitCheck: UnitCheckResult;
  errorReason?: string;
  steps: CalculationStep[];
  processingAdvice?: string;
  createdAt: string;
}

export interface Sample {
  id: string;
  batchId: string;
  name: string;
  value: number;
  unit: string;
  expectedRange: { min: number; max: number };
  isOutOfBounds: boolean;
  status: SampleStatus;
  remark?: string;
  legacySource?: string;
  createdAt: string;
}

export interface Remark {
  id: string;
  recordId: string;
  content: string;
  addedBy: string;
  addedAt: string;
  isSupplement: boolean;
  diffHighlight?: string[];
}

export interface Batch {
  id: string;
  name: string;
  status: BatchStatus;
  paramVersionId: string;
  totalSamples: number;
  successCount: number;
  pendingCount: number;
  legacyCount: number;
  errorCount: number;
  createdAt: string;
  completedAt?: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  unit: string;
  recordId: string;
  sampleId: string;
  type: RecordType;
  isOutOfBounds: boolean;
}

export interface ReportSection {
  title: string;
  content: string;
  type: 'summary' | 'warning' | 'advice' | 'detail';
  highlight?: boolean;
}
