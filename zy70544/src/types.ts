export enum RecalculationStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
  NEEDS_MANUAL_CORRECTION = 'NEEDS_MANUAL_CORRECTION'
}

export enum ReasonCategory {
  PRICE_ADJUSTMENT = 'PRICE_ADJUSTMENT',
  QUANTITY_CORRECTION = 'QUANTITY_CORRECTION',
  DISCOUNT_APPLICATION = 'DISCOUNT_APPLICATION',
  TAX_RECALCULATION = 'TAX_RECALCULATION',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
  OTHER = 'OTHER'
}

export interface ImpactDetail {
  id: string;
  itemCode: string;
  itemName: string;
  originalAmount: number;
  newAmount: number;
  difference: number;
  remarks: string;
}

export interface ApprovalHistory {
  id: string;
  applicationId: string;
  status: RecalculationStatus;
  approver: string;
  approverRole: string;
  opinion: string;
  createdAt: string;
}

export interface RecalculationSnapshot {
  id: string;
  applicationId: string;
  snapshotType: 'ORIGINAL_INPUT' | 'PROCESSING_RESULT' | 'FINAL_CONCLUSION';
  data: string;
  createdAt: string;
}

export interface RecalculationApplication {
  id: string;
  idempotencyKey: string;
  billingMonth: string;
  customerAccount: string;
  customerName: string;
  reasonCategory: ReasonCategory;
  reasonDetail: string;
  triggerSource: string;
  totalOriginalAmount: number;
  totalNewAmount: number;
  totalDifference: number;
  impactDetails: ImpactDetail[];
  status: RecalculationStatus;
  currentApprover: string | null;
  failureReason: string | null;
  processingBasis: string | null;
  finalConclusion: string | null;
  reportUrl: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationRequest {
  idempotencyKey: string;
  billingMonth: string;
  customerAccount: string;
  customerName: string;
  reasonCategory: ReasonCategory;
  reasonDetail: string;
  triggerSource: string;
  impactDetails: Omit<ImpactDetail, 'id'>[];
  createdBy: string;
}

export interface UpdateStatusRequest {
  status: RecalculationStatus;
  approver: string;
  approverRole: string;
  opinion: string;
}

export interface ManualCorrectionRequest {
  totalNewAmount: number;
  impactDetails: ImpactDetail[];
  correctedBy: string;
  correctionReason: string;
}