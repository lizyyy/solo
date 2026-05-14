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

export interface FieldMapping {
  csvField: string;
  apiField: string;
  transformer?: string;
  required?: boolean;
  validator?: string;
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'regex' | 'enum' | 'custom';
  pattern?: string;
  values?: string[];
  errorMessage: string;
}

export interface CsvTemplate {
  id: string;
  name: string;
  description: string;
  columns: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiMapping {
  id: string;
  name: string;
  templateId: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  fieldMappings: FieldMapping[];
  validationRules: ValidationRule[];
  batchSize: number;
  createdAt: Date;
  updatedAt: Date;
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
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
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
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncReport {
  batchId: string;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    success: number;
    failed: number;
  };
  details: {
    rowNumber: number;
    status: RowStatus;
    errors?: string[];
    apiResponse?: any;
  }[];
  generatedAt: Date;
}

export interface CreateBatchRequest {
  mappingId: string;
}

export interface QueryBatchesRequest {
  page?: number;
  pageSize?: number;
  status?: SyncStatus;
  mappingId?: string;
}

export interface QueryBatchesResponse {
  batches: SyncBatch[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RetryFailedRowsRequest {
  batchId: string;
  rowIds?: string[];
}
