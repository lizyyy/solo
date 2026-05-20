export enum RecordStatus {
  PENDING = 'pending',
  NEEDS_REVIEW = 'needs_review',
  PROCESSED = 'processed',
  RETURNED = 'returned',
  APPROVED = 'approved'
}

export enum IssueType {
  AMOUNT_MISMATCH = 'amount_mismatch',
  MISSING_SIGNATURE = 'missing_signature',
  CROSS_DAY_TRANSFER = 'cross_day_transfer',
  MISSING_DATA = 'missing_data'
}

export interface Teller {
  tellerId: string;
  name: string;
  cashBoxId: string;
  branchId: string;
}

export interface ScheduleEntry {
  tellerId: string;
  date: string;
  shift: 'morning' | 'afternoon' | 'full';
  supervisorId: string;
  supervisorName: string;
}

export interface Issue {
  type: IssueType;
  description: string;
  detectedAt: string;
}

export interface ProcessingHistory {
  status: RecordStatus;
  handledBy: string;
  handledAt: string;
  comment?: string;
}

export interface TransferRecord {
  id: string;
  batchId: string;
  tellerId: string;
  tellerName: string;
  cashBoxId: string;
  transferDate: string;
  transferTime: string;
  previousAmount: number;
  currentAmount: number;
  difference: number;
  receivedBy: string;
  handedOverBy: string;
  firstSignature: string;
  secondSignature: string;
  issues: Issue[];
  status: RecordStatus;
  processingHistory: ProcessingHistory[];
  errorNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: string;
  name: string;
  description?: string;
  branchId: string;
  createdBy: string;
  totalRecords: number;
  processedRecords: number;
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface ErrorRecord {
  errorNumber: string;
  transferRecordId: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved' | 'closed';
  reportedBy: string;
  reportedAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: string;
}

export interface QueryFilters {
  cashBoxId?: string;
  supervisorId?: string;
  errorNumber?: string;
  tellerId?: string;
  status?: RecordStatus;
  batchId?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
