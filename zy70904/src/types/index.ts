export enum RecordStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED',
  REVERSED = 'REVERSED'
}

export enum MemberLevel {
  NORMAL = 'NORMAL',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM'
}

export enum OperationType {
  BATCH_CREATED = 'BATCH_CREATED',
  RECORD_APPROVED = 'RECORD_APPROVED',
  RECORD_REJECTED = 'RECORD_REJECTED',
  RECORD_RETURNED = 'RECORD_RETURNED',
  RECORD_REVERSED = 'RECORD_REVERSED',
  RECORD_REIMPORTED = 'RECORD_REIMPORTED',
  BATCH_EXPORTED = 'BATCH_EXPORTED'
}

export interface Receipt {
  id: string;
  receiptNo: string;
  storeCode: string;
  storeName: string;
  memberId: string;
  memberPhone: string;
  transactionTime: Date;
  totalAmount: number;
  discountAmount: number;
  payAmount: number;
  items: ReceiptItem[];
  isReturn: boolean;
  originalReceiptNo?: string;
}

export interface ReceiptItem {
  skuCode: string;
  skuName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Member {
  id: string;
  memberId: string;
  name: string;
  phone: string;
  level: MemberLevel;
  points: number;
  registerTime: Date;
  lastConsumeTime?: Date;
}

export interface ActivityRule {
  id: string;
  activityCode: string;
  activityName: string;
  startTime: Date;
  endTime: Date;
  applicableStores: string[];
  applicableLevels: MemberLevel[];
  minAmount: number;
  pointMultiplier: number;
  maxPointsPerReceipt: number;
  description: string;
}

export interface Batch {
  id: string;
  batchNo: string;
  name: string;
  activityCode: string;
  storeCode: string;
  totalCount: number;
  processedCount: number;
  approvedCount: number;
  rejectedCount: number;
  returnedCount: number;
  status: BatchStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum BatchStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED'
}

export interface ProcessingRecord {
  id: string;
  batchId: string;
  receiptNo: string;
  memberId: string;
  memberLevel: MemberLevel;
  transactionTime: Date;
  totalAmount: number;
  activityCode: string;
  activityName: string;
  calculatedPoints: number;
  status: RecordStatus;
  isReturn: boolean;
  originalReceiptNo?: string;
  boundaryInfo?: BoundaryInfo;
  auditTrail: AuditTrail[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BoundaryInfo {
  type: BoundaryType;
  description: string;
  detail: string;
  suggestion?: string;
}

export enum BoundaryType {
  RETURN_REVERSAL = 'RETURN_REVERSAL',
  MULTIPLIER_BOUNDARY = 'MULTIPLIER_BOUNDARY',
  DUPLICATE_REIMPORT = 'DUPLICATE_REIMPORT',
  AMOUNT_BOUNDARY = 'AMOUNT_BOUNDARY',
  TIME_BOUNDARY = 'TIME_BOUNDARY',
  LEVEL_BOUNDARY = 'LEVEL_BOUNDARY'
}

export interface AuditTrail {
  operationType: OperationType;
  operator: string;
  reason: string;
  timestamp: Date;
  oldStatus?: RecordStatus;
  newStatus?: RecordStatus;
}

export interface OperationLog {
  id: string;
  batchId?: string;
  recordId?: string;
  operationType: OperationType;
  operator: string;
  reason: string;
  detail: string;
  createdAt: Date;
}

export interface QueryParams {
  memberLevel?: MemberLevel;
  receiptNo?: string;
  activityCode?: string;
  startDate?: Date;
  endDate?: Date;
  status?: RecordStatus;
  storeCode?: string;
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
