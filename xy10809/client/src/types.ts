export enum SyncStatus {
  PENDING = 'pending',
  VALIDATING = 'validating',
  VALIDATED = 'validated',
  PROCESSING = 'processing',
  PARTIAL_SUCCESS = 'partial_success',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum RowStatus {
  PENDING = 'pending',
  VALID = 'valid',
  INVALID = 'invalid',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export interface CsvTemplate {
  id: string;
  name: string;
  description: string;
  columns: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiMapping {
  id: string;
  name: string;
  templateId: string;
  endpoint: string;
  method: string;
  fieldMappings: any[];
  validationRules: any[];
  batchSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncBatch {
  id: string;
  mappingId: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  successRows: number;
  failedRows: number;
  status: SyncStatus;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncRow {
  id: string;
  batchId: string;
  rowNumber: number;
  rawData: Record<string, any>;
  transformedData?: Record<string, any>;
  status: RowStatus;
  validationErrors?: string[];
  apiRequest?: any;
  apiResponse?: any;
  errorMessage?: string;
  retryCount: number;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  totalBatches: number;
  totalRows: number;
  successRows: number;
  failedRows: number;
  byStatus: Record<string, number>;
}
