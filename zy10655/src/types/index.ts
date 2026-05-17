export enum AdjustmentStatus {
  PENDING_RECALCULATION = 'PENDING_RECALCULATION',
  RECALCULATING = 'RECALCULATING',
  EFFECTIVE = 'EFFECTIVE',
  PENDING_REVIEW = 'PENDING_REVIEW'
}

export enum OperationSource {
  API = 'API',
  IMPORT = 'IMPORT',
  MANUAL = 'MANUAL',
  SYSTEM = 'SYSTEM'
}

export interface OrganizationAdjustment {
  id: string;
  userId: string;
  userName: string;
  oldDepartmentId: string;
  oldDepartmentName: string;
  newDepartmentId: string;
  newDepartmentName: string;
  dataScope: string;
  retainOldDataAccess: boolean;
  status: AdjustmentStatus;
  operatorId: string;
  operatorName: string;
  operationSource: OperationSource;
  createdAt: Date;
  updatedAt: Date;
  effectiveAt?: Date;
  remark?: string;
}

export interface AdjustmentHistory {
  id: string;
  adjustmentId: string;
  fromStatus?: AdjustmentStatus;
  toStatus: AdjustmentStatus;
  operatorId: string;
  operatorName: string;
  operationSource: OperationSource;
  operationType: string;
  remark?: string;
  createdAt: Date;
}

export interface CreateAdjustmentRequest {
  userId: string;
  userName: string;
  oldDepartmentId: string;
  oldDepartmentName: string;
  newDepartmentId: string;
  newDepartmentName: string;
  dataScope: string;
  retainOldDataAccess: boolean;
  operatorId: string;
  operatorName: string;
  operationSource: OperationSource;
  remark?: string;
}

export interface UpdateStatusRequest {
  status: AdjustmentStatus;
  operatorId: string;
  operatorName: string;
  operationSource: OperationSource;
  remark?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    suggestion?: string;
  };
}

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DUPLICATE_REQUEST = 'DUPLICATE_REQUEST',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',
  ADJUSTMENT_NOT_FOUND = 'ADJUSTMENT_NOT_FOUND',
  CONFLICT_ADJUSTMENT = 'CONFLICT_ADJUSTMENT',
  IMPORT_ERROR = 'IMPORT_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR'
}
