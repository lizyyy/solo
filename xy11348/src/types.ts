export interface LabValue {
  L: number;
  a: number;
  b: number;
}

export interface Threshold {
  id?: number;
  name: string;
  standardL: number;
  standardA: number;
  standardB: number;
  deltaLMax: number;
  deltaAMax: number;
  deltaBMax: number;
  deltaEMax: number;
  createdAt?: string;
}

export interface PaperBatch {
  id?: number;
  batchNo: string;
  supplier: string;
  paperType: string;
  weight: number;
  receivedDate: string;
  status: 'available' | 'used' | 'quarantined';
  notes?: string;
  createdAt?: string;
}

export interface PrintBatch {
  id?: number;
  batchNo: string;
  productName: string;
  paperBatchId: number;
  paperBatchNo?: string;
  printDate: string;
  shift: string;
  operator: string;
  machineNo: string;
  thresholdId: number;
  thresholdName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'reworked';
  createdAt?: string;
}

export interface Measurement {
  id?: number;
  printBatchId: number;
  printBatchNo?: string;
  measurementPoint: string;
  L: number;
  a: number;
  b: number;
  deltaL: number;
  deltaA: number;
  deltaB: number;
  deltaE: number;
  isPass: boolean;
  isRetained: boolean;
  measuredAt: string;
  measuredBy: string;
  notes?: string;
  createdAt?: string;
}

export interface ReworkRecord {
  id?: number;
  printBatchId: number;
  printBatchNo?: string;
  reworkType: string;
  reason: string;
  operator: string;
  startTime: string;
  endTime?: string;
  result: 'pending' | 'success' | 'failed';
  notes?: string;
  createdAt?: string;
}

export interface ReviewRecord {
  id?: number;
  printBatchId: number;
  printBatchNo?: string;
  reviewer: string;
  reviewDate: string;
  decision: 'approve' | 'reject' | 'rework';
  reason: string;
  createdAt?: string;
}

export interface InspectionReport {
  id?: number;
  reportNo: string;
  printBatchId: number;
  printBatchNo?: string;
  generatedAt: string;
  generatedBy: string;
  totalMeasurements: number;
  passCount: number;
  failCount: number;
  passRate: number;
  status: 'draft' | 'final';
  createdAt?: string;
}

export interface BatchResult<T> {
  success: T[];
  failed: Array<{
    index: number;
    data: T;
    error: string;
  }>;
}

export interface DecisionReason {
  code: string;
  message: string;
  details?: Record<string, number>;
}
