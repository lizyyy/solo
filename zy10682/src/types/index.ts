export enum CompensationStatus {
  EXPIRED = 'EXPIRED',
  APPLYING = 'APPLYING',
  COMPENSATED = 'COMPENSATED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN'
}

export enum HistoryAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
  CONSUMED = 'CONSUMED'
}

export interface Member {
  id: string;
  name: string;
  phone: string;
}

export interface ExpiryBatch {
  id: string;
  batchNo: string;
  expiryDate: string;
  totalPoints: number;
}

export interface CompensationRecord {
  id: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  expiryBatchId: string;
  expiryBatchNo: string;
  expiryPoints: number;
  compensationPoints: number;
  reason: string;
  applicantId: string;
  applicantName: string;
  approverId?: string;
  approverName?: string;
  approvalComment?: string;
  status: CompensationStatus;
  isConsumed: boolean;
  consumedAt?: string;
  appliedAt: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryRecord {
  id: string;
  compensationId: string;
  action: HistoryAction;
  operatorId: string;
  operatorName: string;
  comment?: string;
  beforeSnapshot?: Partial<CompensationRecord>;
  afterSnapshot?: Partial<CompensationRecord>;
  createdAt: string;
}

export interface CreateCompensationRequest {
  memberId: string;
  memberName: string;
  memberPhone: string;
  expiryBatchId: string;
  expiryBatchNo: string;
  expiryPoints: number;
  compensationPoints: number;
  reason: string;
  applicantId: string;
  applicantName: string;
}

export interface UpdateCompensationRequest {
  reason?: string;
  compensationPoints?: number;
}

export interface ApprovalRequest {
  approverId: string;
  approverName: string;
  comment: string;
  approved: boolean;
}

export interface QueryParams {
  memberId?: string;
  memberName?: string;
  memberPhone?: string;
  status?: CompensationStatus;
  expiryBatchId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
