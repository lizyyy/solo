export enum DetentionFeeStatus {
  PENDING_IMPORT = 'PENDING_IMPORT',
  IMPORTED = 'IMPORTED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  REVIEWED = 'REVIEWED',
  CONFIRMED = 'CONFIRMED',
  INVOICED = 'INVOICED',
  PAID = 'PAID'
}

export enum DetentionReason {
  CUSTOMS_INSPECTION = 'CUSTOMS_INSPECTION',
  CUSTOMER_DELAY = 'CUSTOMER_DELAY',
  SHIPPING_LINE_DELAY = 'SHIPPING_LINE_DELAY',
  PORT_OPERATION_DELAY = 'PORT_OPERATION_DELAY',
  DOCUMENT_DELAY = 'DOCUMENT_DELAY',
  JOINT_REASON = 'JOINT_REASON'
}

export interface DetentionFeeRecord {
  id?: string;
  billOfLadingNo: string;
  containerNo: string;
  vesselVoyage: string;
  portCode: string;
  portName: string;
  storageAgentCode: string;
  storageAgentName: string;
  customerCode: string;
  customerName: string;
  entryDate: string;
  exitDate: string;
  detentionDays: number;
  freeDays: number;
  billableDays: number;
  currency: string;
  dailyRate: number;
  totalAmount: number;
  detentionReasons: DetentionReason[];
  reasonDescription: string;
  status: DetentionFeeStatus;
  isCustomsInspection: boolean;
  isCustomerDelay: boolean;
  requiresManualRemark: boolean;
  manualRemark?: string;
  enteredBy?: string;
  enteredAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportRowResult {
  success: boolean;
  rowIndex: number;
  originalData: Record<string, any>;
  record?: DetentionFeeRecord;
  errorCode?: string;
  errorMessage?: string;
  suggestion?: string;
}

export interface ImportRequest {
  records: Record<string, any>[];
  operatorId: string;
  operatorName: string;
}

export interface ImportResponse {
  success: boolean;
  totalCount: number;
  successCount: number;
  failedCount: number;
  results: ImportRowResult[];
  requiresManualReviewCount: number;
  requiresManualReviewResults: ImportRowResult[];
}

export interface BadRowDetail {
  rowIndex: number;
  originalFields: Record<string, any>;
  errorReason: string;
  suggestion: string;
}

export const STATUS_TRANSITION_RULES: Record<DetentionFeeStatus, DetentionFeeStatus[]> = {
  [DetentionFeeStatus.PENDING_IMPORT]: [DetentionFeeStatus.IMPORTED],
  [DetentionFeeStatus.IMPORTED]: [DetentionFeeStatus.PENDING_REVIEW],
  [DetentionFeeStatus.PENDING_REVIEW]: [DetentionFeeStatus.REVIEWED],
  [DetentionFeeStatus.REVIEWED]: [DetentionFeeStatus.CONFIRMED],
  [DetentionFeeStatus.CONFIRMED]: [DetentionFeeStatus.INVOICED],
  [DetentionFeeStatus.INVOICED]: [DetentionFeeStatus.PAID],
  [DetentionFeeStatus.PAID]: []
};

export const REQUIRED_FIELDS: (keyof DetentionFeeRecord)[] = [
  'billOfLadingNo',
  'containerNo',
  'vesselVoyage',
  'portCode',
  'portName',
  'storageAgentCode',
  'storageAgentName',
  'customerCode',
  'customerName',
  'entryDate',
  'detentionDays',
  'freeDays',
  'billableDays',
  'currency',
  'dailyRate',
  'totalAmount',
  'detentionReasons'
];
