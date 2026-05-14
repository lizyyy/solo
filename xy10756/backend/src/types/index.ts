export enum AfterSalesStatus {
  CREATED = 'CREATED',
  QA_IN_PROGRESS = 'QA_IN_PROGRESS',
  QA_PASSED = 'QA_PASSED',
  QA_FAILED = 'QA_FAILED',
  REFUND_IN_PROGRESS = 'REFUND_IN_PROGRESS',
  REFUND_SUCCESS = 'REFUND_SUCCESS',
  REFUND_FAILED = 'REFUND_FAILED',
  COMPENSATION_IN_PROGRESS = 'COMPENSATION_IN_PROGRESS',
  COMPENSATION_SUCCESS = 'COMPENSATION_SUCCESS',
  COMPENSATION_FAILED = 'COMPENSATION_FAILED',
  REVIEW_PENDING = 'REVIEW_PENDING',
  REVIEW_APPROVED = 'REVIEW_APPROVED',
  REVIEW_REJECTED = 'REVIEW_REJECTED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum QaResult {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
}

export enum RefundMethod {
  ORIGINAL_PAYMENT = 'ORIGINAL_PAYMENT',
  BANK_TRANSFER = 'BANK_TRANSFER',
  COUPON = 'COUPON',
}

export enum RejectReason {
  PRODUCT_USED = 'PRODUCT_USED',
  OUT_OF_WARRANTY = 'OUT_OF_WARRANTY',
  MISSING_ACCESSORIES = 'MISSING_ACCESSORIES',
  USER_ERROR = 'USER_ERROR',
  OTHER = 'OTHER',
}

export interface AfterSalesOrder {
  id: string;
  orderNo: string;
  userId: string;
  userName: string;
  productName: string;
  amount: number;
  status: AfterSalesStatus;
  qaResult?: QaResult;
  rejectReason?: RejectReason;
  rejectReasonReview?: string;
  rejectReasonReviewed?: boolean;
  rejectReasonReviewer?: string;
  refundMethod?: RefundMethod;
  retryCount: number;
  maxRetries: number;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QaRecord {
  id: string;
  afterSalesId: string;
  inspectorId: string;
  inspectorName: string;
  result: QaResult;
  remarks?: string;
  defectImages?: string;
  createdAt: Date;
}

export interface RefundRecord {
  id: string;
  afterSalesId: string;
  method: RefundMethod;
  amount: number;
  transactionId?: string;
  status: string;
  retryCount: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompensationCoupon {
  id: string;
  afterSalesId: string;
  couponCode: string;
  amount: number;
  status: string;
  userId: string;
  issuedAt?: Date;
  usedAt?: Date;
  errorMessage?: string;
  correctionReason?: string;
  correctionOperator?: string;
  correctionTime?: Date;
  retryCount: number;
  createdAt: Date;
}

export interface LedgerRecord {
  id: string;
  afterSalesId: string;
  orderNo: string;
  type: string;
  amount: number;
  status: string;
  operator: string;
  operationTime: Date;
  remarks?: string;
}