export enum VerificationStatus {
  PENDING = '待核销',
  PARTIAL = '部分核销',
  COMPLETED = '已核销',
  ABNORMAL = '异常'
}

export interface Team {
  id: string;
  name: string;
  contactPerson: string;
  contactPhone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationPoint {
  id: string;
  name: string;
  address: string;
  operatorId: string;
  operatorName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketBatch {
  id: string;
  batchNo: string;
  teamId: string;
  teamName: string;
  totalQuantity: number;
  remainingQuantity: number;
  verifiedQuantity: number;
  status: VerificationStatus;
  validFrom: Date;
  validTo: Date;
  remark: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface VerificationRecord {
  id: string;
  sequence: number;
  batchId: string;
  batchNo: string;
  teamId: string;
  teamName: string;
  verificationPointId: string;
  verificationPointName: string;
  operatorName: string;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  statusBefore: VerificationStatus;
  statusAfter: VerificationStatus;
  remark: string;
  isImported: boolean;
  importSource: string;
  createdAt: Date;
}

export interface VerificationRequest {
  batchId: string;
  verificationPointId: string;
  quantity: number;
  operatorName: string;
  remark: string;
}

export interface ConflictResponse {
  success: false;
  errorCode: 'CONCURRENT_CONFLICT';
  message: string;
  requiredDocuments: string[];
  nextSteps: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
}

export interface ImportRowError {
  rowNumber: number;
  data: Record<string, any>;
  errors: string[];
}

export interface ImportResult {
  successCount: number;
  errorCount: number;
  errors: ImportRowError[];
}
