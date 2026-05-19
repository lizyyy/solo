export enum RecordStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  NEEDS_REVIEW = 'needs_review'
}

export enum ImportStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PARTIAL = 'partial'
}

export interface SampleRetention {
  id: string;
  date: string;
  dishName: string;
  dishType: string;
  quantity: number;
  reservedBy: string;
  reservedAt: string;
  storageLocation: string;
  discardDate: string;
  discardedBy?: string;
  discardedAt?: string;
  status: RecordStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemperatureLog {
  id: string;
  date: string;
  refrigeratorId: string;
  refrigeratorName: string;
  temperature: number;
  minTemperature: number;
  maxTemperature: number;
  measuredBy: string;
  measuredAt: string;
  isNormal: boolean;
  status: RecordStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiscardRecord {
  id: string;
  date: string;
  itemName: string;
  itemType: string;
  quantity: number;
  unit: string;
  discardReason: string;
  discardedBy: string;
  discardedAt: string;
  status: RecordStatus;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportRecord {
  id: string;
  batchId: string;
  importType: 'sample' | 'temperature' | 'discard';
  fileName: string;
  totalRecords: number;
  successCount: number;
  failedCount: number;
  status: ImportStatus;
  importedBy: string;
  importedAt: string;
  createdAt: string;
}

export interface FailedRecord {
  id: string;
  importId: string;
  rowNumber: number;
  originalData: string;
  errorMessage: string;
  suggestion: string;
  isResolved: boolean;
  resolvedAt?: string;
  createdAt: string;
}

export interface BatchOperationResult<T> {
  batchId: string;
  total: number;
  success: number;
  failed: number;
  successItems: T[];
  failedItems: Array<{ item: Partial<T>; error: string; suggestion: string }>;
}

export interface ReviewSummary {
  date: string;
  sampleRetention: {
    total: number;
    verified: number;
    pending: number;
    discarded: number;
  };
  temperature: {
    total: number;
    normal: number;
    abnormal: number;
    verified: number;
  };
  discard: {
    total: number;
    verified: number;
  };
  issues: string[];
}