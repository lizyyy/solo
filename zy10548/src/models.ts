export enum SyncTaskStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  RESUMING = 'RESUMING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum PauseWindowStatus {
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
  CANCELLED = 'CANCELLED'
}

export enum RecoveryActionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED'
}

export enum FailureType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DOWNSTREAM_ERROR = 'DOWNSTREAM_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  MANUAL_MARKED = 'MANUAL_MARKED'
}

export interface SyncTask {
  id: string;
  name: string;
  description?: string;
  sourceSystem: string;
  targetSystem: string;
  status: SyncTaskStatus;
  currentPauseWindowId?: string;
  backlogStats: BacklogStats;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  metadata?: Record<string, any>;
}

export interface PauseWindow {
  id: string;
  syncTaskId: string;
  name: string;
  reason: string;
  startTime: string;
  endTime?: string;
  status: PauseWindowStatus;
  expectedDuration?: number;
  backlogAtPause: number;
  backlogAtResume?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BacklogStats {
  totalCount: number;
  pendingCount: number;
  processingCount: number;
  failedCount: number;
  lastUpdated: string;
}

export interface RecoveryAction {
  id: string;
  syncTaskId: string;
  pauseWindowId: string;
  batchId: string;
  status: RecoveryActionStatus;
  totalRecords: number;
  processedRecords: number;
  successRecords: number;
  failedRecords: number;
  startTime?: string;
  endTime?: string;
  idempotencyKey: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FailureDetail {
  id: string;
  syncTaskId: string;
  pauseWindowId?: string;
  recoveryActionId?: string;
  failureType: FailureType;
  errorCode?: string;
  errorMessage: string;
  originalInput: Record<string, any>;
  processingBasis: Record<string, any>;
  finalConclusion?: string;
  stackTrace?: string;
  timestamp: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface SyncReport {
  id: string;
  syncTaskId: string;
  pauseWindowId?: string;
  reportType: 'PAUSE_SUMMARY' | 'RECOVERY_SUMMARY' | 'FAILURES_SUMMARY' | 'FULL_REPORT';
  generatedAt: string;
  generatedBy: string;
  content: {
    taskOverview: {
      taskName: string;
      status: string;
      sourceSystem: string;
      targetSystem: string;
    };
    pauseWindow?: {
      name: string;
      reason: string;
      startTime: string;
      endTime?: string;
      duration?: number;
      backlogAtPause: number;
      backlogAtResume?: number;
      backlogProcessed?: number;
    };
    recoveryStats?: {
      totalActions: number;
      totalRecords: number;
      successRecords: number;
      failedRecords: number;
      averageProcessingTime?: number;
    };
    failures: {
      totalCount: number;
      byType: Record<string, number>;
      unresolvedCount: number;
    };
    backlogSummary: BacklogStats;
  };
  exportFormat?: 'JSON' | 'CSV';
  filePath?: string;
}

export interface CreateSyncTaskRequest {
  name: string;
  description?: string;
  sourceSystem: string;
  targetSystem: string;
  createdBy: string;
  metadata?: Record<string, any>;
}

export interface CreatePauseWindowRequest {
  syncTaskId: string;
  name: string;
  reason: string;
  startTime?: string;
  expectedDuration?: number;
  createdBy: string;
}

export interface StartRecoveryRequest {
  syncTaskId: string;
  pauseWindowId: string;
  idempotencyKey: string;
  createdBy: string;
  batchSize?: number;
}

export interface ManualCorrectionRequest {
  failureId: string;
  correctedInput: Record<string, any>;
  resolutionNote: string;
  correctedBy: string;
  retry: boolean;
}

export interface QueryParams {
  syncTaskId?: string;
  status?: string;
  startTimeFrom?: string;
  startTimeTo?: string;
  page?: number;
  pageSize?: number;
}
