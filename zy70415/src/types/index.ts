export interface DutyRecord {
  id: string;
  date: string;
  engineerId: string;
  engineerName: string;
  shiftType: string;
  status: string;
  riskType?: string;
  anomalyType?: string;
  anomalyDescription?: string;
  mergeError: boolean;
  mergedWith?: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  archiveBatchId?: string;
  isDirty: boolean;
  remarks?: string;
}

export interface ArchiveBatch {
  id: string;
  batchNo: string;
  name: string;
  status: 'pending' | 'candidate' | 'executing' | 'success' | 'partial_success' | 'failed' | 'rolled_back';
  operatorId: string;
  operatorName: string;
  totalCount: number;
  successCount: number;
  failCount: number;
  archivePath?: string;
  createdAt: string;
  executedAt?: string;
  completedAt?: string;
  requestId?: string;
  remarks?: string;
}

export interface ArchiveDetail {
  id: string;
  batchId: string;
  recordId: string;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  createdAt: string;
}

export interface OperationLog {
  id: string;
  batchId?: string;
  operationType: string;
  operatorId: string;
  operatorName: string;
  recordId?: string;
  oldValue?: string;
  newValue?: string;
  remarks?: string;
  createdAt: string;
}

export interface ExportRecord {
  id: string;
  batchId?: string;
  exportType: string;
  filePath: string;
  fileName: string;
  operatorId: string;
  operatorName: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewerId?: string;
  reviewerName?: string;
  reviewRemarks?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface EraseRequest {
  id: string;
  requestNo: string;
  requesterId: string;
  requesterName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  recordIds: string;
  approvedBy?: string;
  approvedAt?: string;
  executedAt?: string;
  createdAt: string;
  remarks?: string;
}

export interface CandidateItem {
  recordId: string;
  date: string;
  engineerName: string;
  riskType?: string;
  anomalyType?: string;
  isDirty: boolean;
  remarks?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}