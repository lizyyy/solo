export enum InspectionStatus {
  PENDING = 'pending',
  MISSED_PENDING = 'missed_pending',
  SUPPLEMENTED = 'supplemented',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  MANUAL_REVIEW = 'manual_review'
}

export enum FlowType {
  NORMAL = 'normal',
  REJECTION = 'rejection',
  MANUAL_REVIEW = 'manual_review'
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  SUPPLEMENT = 'supplement',
  CONFIRM = 'confirm',
  REJECT = 'reject',
  SUBMIT_REVIEW = 'submit_review',
  APPROVE_REVIEW = 'approve_review'
}

export interface Device {
  id: string;
  code: string;
  name: string;
  type: string;
  location: string;
  department: string;
  manufacturer: string;
  model: string;
  installDate: string;
  warrantyExpireDate: string;
  status: 'active' | 'maintenance' | 'retired';
  createdAt: string;
  updatedAt: string;
}

export interface Inspector {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  phone: string;
  email: string;
  certificationLevel: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface InspectionPlan {
  id: string;
  deviceId: string;
  inspectorId: string;
  planDate: string;
  planTime: string;
  frequency: string;
  items: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionRecord {
  id: string;
  planId: string;
  deviceId: string;
  inspectorId: string;
  planDate: string;
  actualInspectionDate?: string;
  supplementReason?: string;
  supplementDate?: string;
  discoveredDate?: string;
  status: InspectionStatus;
  flowType: FlowType;
  remarks?: string;
  attachmentUrls?: string[];
  requiredMaterials?: string[];
  inspectionResults?: Record<string, string>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface OperationHistory {
  id: string;
  recordId: string;
  operationType: OperationType;
  operatorId: string;
  operatorName: string;
  previousStatus?: InspectionStatus;
  newStatus: InspectionStatus;
  remarks?: string;
  operationTime: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  errorCode?: string;
  requiredMaterials?: string[];
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginationResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ImportResult {
  successCount: number;
  failCount: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  data: Record<string, any>;
  message: string;
}
