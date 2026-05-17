import { TaskStatus, FailureCode } from '../entities/TranscodeTask';
import { RetryType, RetryTrigger } from '../entities/RetryHistory';
import { ValidationStatus } from '../entities/RowValidation';

export interface CreateTaskRequest {
  businessNo: string;
  fileName: string;
  fileHash: string;
  fileSize: number;
  sourceFormat: string;
  targetFormat: string;
  sourceFilePath?: string;
  fileMetadata?: Record<string, any>;
  createdBy: string;
  retryParams?: Record<string, any>;
}

export interface ManualRetryRequest {
  taskId: string;
  retriedBy: string;
  retryNote?: string;
  retryParams?: Record<string, any>;
  requestId?: string;
  forceRetry?: boolean;
}

export interface BatchRetryRequest {
  taskIds: string[];
  retriedBy: string;
  retryNote?: string;
  retryParams?: Record<string, any>;
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus;
  failureCode?: FailureCode;
  failureMessage?: string;
  outputFilePath?: string;
  updatedBy?: string;
}

export interface ResolveConflictRequest {
  taskId: string;
  resolvedBy: string;
  resolutionNote: string;
  createNewTask?: boolean;
  cancelOldTask?: boolean;
}

export interface TaskQueryParams {
  businessNo?: string;
  status?: TaskStatus;
  failureCode?: FailureCode;
  createdBy?: string;
  isManuallyRetried?: boolean;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface TaskDetailResponse {
  id: string;
  businessNo: string;
  fileName: string;
  fileHash: string;
  fileSize: number;
  sourceFormat: string;
  targetFormat: string;
  status: TaskStatus;
  failureCode?: FailureCode;
  failureMessage?: string;
  retryParams?: Record<string, any>;
  retryCount: number;
  maxRetryCount: number;
  isManuallyRetried: boolean;
  lastRetriedBy?: string;
  lastRetriedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  conflictNote?: string;
  retryHistories?: RetryHistoryResponse[];
  rowValidations?: RowValidationResponse[];
}

export interface RetryHistoryResponse {
  id: string;
  taskId: string;
  retryType: RetryType;
  retryTrigger: RetryTrigger;
  statusBefore: TaskStatus;
  statusAfter: TaskStatus;
  retryParams?: Record<string, any>;
  fileHashBefore?: string;
  fileHashAfter?: string;
  isHashChanged: boolean;
  previousFailureCode?: FailureCode;
  previousFailureMessage?: string;
  retriedBy?: string;
  retryNote?: string;
  isDuplicateRequest: boolean;
  isCallbackOverride: boolean;
  requestId?: string;
  retryAttemptNumber: number;
  createdAt: Date;
  completedAt?: Date;
  sourceFileReplaced: boolean;
}

export interface RowValidationResponse {
  id: string;
  taskId: string;
  rowNumber: number;
  sheetName?: string;
  rowData?: Record<string, any>;
  status: ValidationStatus;
  validationErrors?: any[];
  isBadRow: boolean;
  isImported: boolean;
  createdAt: Date;
  validatedAt?: Date;
}

export interface ExportQueryParams {
  taskIds?: string[];
  businessNo?: string;
  status?: TaskStatus;
  startDate?: string;
  endDate?: string;
  format?: 'csv' | 'json';
  includeHistory?: boolean;
  includeValidations?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
  errors?: any[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
