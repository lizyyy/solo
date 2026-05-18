export enum DepositDeductionStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  REVIEWING = 'REVIEWING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED'
}

export enum DeductionType {
  CHECK_OUT = 'CHECK_OUT',
  EXTEND_STAY = 'EXTEND_STAY',
  DAMAGE = 'DAMAGE',
  CLEANING = 'CLEANING',
  OTHER = 'OTHER'
}

export enum OrderType {
  NORMAL = 'NORMAL',
  EXTEND = 'EXTEND'
}

export interface DepositDeductionItem {
  id: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  remark?: string;
}

export interface AuditLog {
  id: string;
  deductionId: string;
  action: string;
  fromStatus?: DepositDeductionStatus;
  toStatus?: DepositDeductionStatus;
  operatorId: string;
  operatorName: string;
  submitSource: string;
  operateTime: Date;
  remark?: string;
}

export interface Order {
  id: string;
  orderNo: string;
  orderType: OrderType;
  guestName: string;
  guestPhone: string;
  roomNo: string;
  roomType: string;
  checkInDate: Date;
  checkOutDate: Date;
  originalCheckOutDate?: Date;
  depositAmount: number;
  usedDepositAmount: number;
  status: string;
  parentOrderId?: string;
  createTime: Date;
}

export interface DepositDeduction {
  id: string;
  deductionNo: string;
  orderId: string;
  orderNo: string;
  guestName: string;
  guestPhone: string;
  roomNo: string;
  deductionType: DeductionType;
  status: DepositDeductionStatus;
  totalDeductionAmount: number;
  items: DepositDeductionItem[];
  applicantId: string;
  applicantName: string;
  submitSource: string;
  applyTime: Date;
  reviewerId?: string;
  reviewerName?: string;
  reviewTime?: Date;
  reviewRemark?: string;
  executorId?: string;
  executorName?: string;
  executeTime?: Date;
  conflictDetected?: boolean;
  conflictDetails?: string;
  remark?: string;
  createTime: Date;
  updateTime: Date;
}

export interface StateTransition {
  from: DepositDeductionStatus;
  to: DepositDeductionStatus;
  action: string;
  allowedRoles: string[];
  description: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictType?: 'OVERLAP' | 'DEPOSIT_INCONSISTENCY' | 'MULTIPLE_DEDUCTION';
  conflictDetails?: string;
  conflictingDeductions?: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  errorCode?: string;
}