export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVING'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'PAID'
  | 'CANCELLED';

export type SupplierLevel = 'A' | 'B' | 'C' | 'D';

export type EvidenceType = 'STATUS_CHANGE' | 'FIELD_CHANGE' | 'ATTACHMENT' | 'COMMENT' | 'PAYMENT';

export type ChangeType = 'ADD' | 'MODIFY' | 'DELETE' | 'UNCHANGED';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface DiscountApplication {
  id: string;
  applicationNo: string;
  supplierId: string;
  supplierName: string;
  supplierLevel: SupplierLevel;
  payableId: string;
  payableAmount: number;
  originalDueDate: string;
  proposedDueDate: string;
  discountRate: number;
  discountAmount: number;
  actualPaymentAmount: number;
  status: ApplicationStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  remark?: string;
}

export interface StatusTransition {
  id: string;
  applicationId: string;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  operator: string;
  operatorIp: string;
  timestamp: string;
  remark: string;
}

export interface PaymentRecord {
  id: string;
  applicationId: string;
  paymentNo: string;
  amount: number;
  paymentDate: string;
  isDuplicate: boolean;
  duplicateOf: string | null;
  version: number;
  operator: string;
  status: PaymentStatus;
}

export interface EvidenceItem {
  id: string;
  applicationId: string;
  type: EvidenceType;
  content: string;
  operator: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface VersionDiff {
  field: string;
  fieldName: string;
  oldValue: any;
  newValue: any;
  changeType: ChangeType;
}

export interface Supplier {
  id: string;
  name: string;
  level: SupplierLevel;
  creditRating: number;
  historicalDiscountCount: number;
}

export interface Payable {
  id: string;
  supplierId: string;
  amount: number;
  dueDate: string;
  invoiceNo: string;
  relatedContracts: string[];
}

export interface ApplicationFilters {
  supplierId?: string;
  status?: ApplicationStatus;
  minDiscountRate?: number;
  maxDiscountRate?: number;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

export interface DiscountCalculation {
  daysEarly: number;
  discountAmount: number;
  actualPayment: number;
  annualizedReturn: number;
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  APPROVING: '审批中',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  WITHDRAWN: '已撤回',
  PAID: '已付款',
  CANCELLED: '已取消',
};

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-success-100 text-success-700',
  REJECTED: 'bg-red-100 text-red-700',
  WITHDRAWN: 'bg-orange-100 text-orange-700',
  PAID: 'bg-success-100 text-success-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export const SUPPLIER_LEVEL_LABELS: Record<SupplierLevel, string> = {
  A: 'A级',
  B: 'B级',
  C: 'C级',
  D: 'D级',
};

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  STATUS_CHANGE: '状态变更',
  FIELD_CHANGE: '字段修改',
  ATTACHMENT: '附件上传',
  COMMENT: '备注',
  PAYMENT: '付款记录',
};
