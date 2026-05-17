export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum OperationStatus {
  CREATED = 'created',
  CONFIRMED = 'confirmed',
  LOCKED = 'locked',
  EXECUTING = 'executing',
  SUCCESS = 'success',
  FAILED = 'failed',
  ABORTED = 'aborted',
  NEEDS_MANUAL_CORRECTION = 'needs_manual_correction'
}

export interface Operation {
  id: string;
  operationNo: string;
  title: string;
  description: string;
  resourceObject: string;
  resourceType: string;
  riskLevel: RiskLevel;
  executorId: string;
  executorName: string;
  reviewerId: string | null;
  reviewerName: string | null;
  status: OperationStatus;
  planExecuteTime: Date | null;
  actualExecuteTime: Date | null;
  completeTime: Date | null;
  operationResult: string | null;
  errorMessage: string | null;
  rawInput: Record<string, any>;
  correctionHistory: CorrectionRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CorrectionRecord {
  id: string;
  operationId: string;
  correctorId: string;
  correctorName: string;
  correctionReason: string;
  originalData: Record<string, any>;
  correctedData: Record<string, any>;
  createdAt: Date;
}

export interface CreateOperationRequest {
  title: string;
  description: string;
  resourceObject: string;
  resourceType: string;
  riskLevel: RiskLevel;
  executorId: string;
  executorName: string;
  planExecuteTime?: string;
  rawInput: Record<string, any>;
}

export interface ConfirmOperationRequest {
  reviewerId: string;
  reviewerName: string;
}

export interface ExecuteOperationRequest {
  operationResult?: string;
}

export interface FailOperationRequest {
  errorMessage: string;
  operationResult?: string;
}

export interface ManualCorrectionRequest {
  correctorId: string;
  correctorName: string;
  correctionReason: string;
  correctedData: Record<string, any>;
  newStatus?: OperationStatus;
}

export interface QueryOperationsFilter {
  status?: OperationStatus;
  riskLevel?: RiskLevel;
  executorId?: string;
  reviewerId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
