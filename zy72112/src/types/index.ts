export type RecordType = 'smooth' | 'pending' | 'old_caliber';
export type RecordStatus = 'pending' | 'confirmed' | 'rejected' | 'auto_pass';
export type CheckType = 'unit' | 'direction' | 'interval' | 'range';
export type Judgment = 'pass' | 'warning' | 'error';

export interface MeasureField {
  raw: number;
  unit: string;
  calculated: number;
}

export interface Direction {
  x: number;
  y: number;
}

export interface CheckStep {
  id: string;
  stepOrder: number;
  checkType: CheckType;
  title: string;
  description: string;
  originalValue: string;
  calculatedValue: string;
  judgment: Judgment;
  basis: string;
  suggestion: string;
  timestamp: string;
}

export interface Note {
  id: string;
  content: string;
  author: string;
  createdAt: string;
  isSupplementary: boolean;
  diff?: {
    field: string;
    oldValue: string;
    newValue: string;
  };
}

export interface SensorRecord {
  id: string;
  batchId: string;
  sequence: number;
  timestamp: string;
  timeSinceLast: number;
  gap: MeasureField;
  height: MeasureField;
  current: MeasureField;
  direction: Direction;
  status: RecordStatus;
  recordType: RecordType;
  source: string;
  checkSteps: CheckStep[];
  notes: Note[];
  deviceParam?: string;
  siteRemark?: string;
}

export interface Batch {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  source: string;
  status: 'processing' | 'completed' | 'archived';
  records: SensorRecord[];
  parentBatchId?: string;
}

export interface ValidationSummary {
  unitCheck: { pass: number; total: number; warnings: string[] };
  directionCheck: { pass: number; total: number; warnings: string[] };
  intervalCheck: { pass: number; total: number; warnings: string[] };
}

export interface Difference {
  field: string;
  fieldLabel: string;
  oldValue: number;
  newValue: number;
  change: number;
  changePercent: number;
}

export interface ComparisonResult {
  oldBatch: Batch;
  newBatch: Batch;
  differences: Difference[];
  recordComparisons: {
    oldRecord: SensorRecord;
    newRecord: SensorRecord;
    diffs: Difference[];
  }[];
}
