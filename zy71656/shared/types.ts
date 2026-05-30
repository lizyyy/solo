export type ProductType = 'PHYSICAL' | 'EBOOK' | 'DISCOUNT';

export type ExceptionType = 'LATE_RETURN' | 'LADDER_CROSSING' | 'DUPLICATE_CHANNEL' | 'DIRTY_DATA' | 'MISSING_CONTRACT' | 'MISSING_LADDER' | 'NEGATIVE_SALES';

export type ExceptionSeverity = 'WARNING' | 'ERROR' | 'INFO';

export type SettlementStatus = 'DRAFT' | 'PENDING_CONFIRMATION' | 'LOCKED' | 'COMPLETED';

export interface Author {
  id: string;
  name: string;
  taxId?: string;
  bankAccount?: string;
  email?: string;
  taxRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  isbn?: string;
  title: string;
  authorId: string;
  productType: ProductType;
  listPrice: number;
  publishDate?: string;
  createdAt: string;
}

export interface Contract {
  id: string;
  authorId: string;
  bookId: string;
  effectiveDate: string;
  expiryDate?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'DRAFT';
  specialTerms?: string;
  createdAt: string;
}

export interface RoyaltyLadder {
  id: string;
  contractId: string;
  productType: ProductType;
  minVolume: number;
  maxVolume?: number;
  rate: number;
  ladderType: 'STANDARD' | 'DISCOUNT';
  createdAt: string;
}

export interface SalesRecord {
  id: string;
  bookId: string;
  channel: string;
  saleDate: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  discountActivityId?: string;
  isDirty: boolean;
  rawData?: string;
  createdAt: string;
}

export interface ReturnRecord {
  id: string;
  bookId: string;
  originalSaleId?: string;
  returnDate: string;
  settlementPeriod: string;
  quantity: number;
  amount: number;
  reason?: string;
  isLate: boolean;
  createdAt: string;
}

export interface DiscountActivity {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  productType?: ProductType;
  adjustedRate?: number;
  ladderOverride?: string;
  createdAt: string;
}

export interface Settlement {
  id: string;
  period: string;
  authorId: string;
  createdAt: string;
  lockedAt?: string;
  status: SettlementStatus;
  totalAmount: number;
  createdBy?: string;
  lockedBy?: string;
  calculationLogId?: string;
  itemCount?: number;
  exceptionCount?: number;
}

export interface CalculationStep {
  order: number;
  description: string;
  operation: string;
  input: number;
  output: number;
  rule: string;
}

export interface CalculationTrail {
  steps: CalculationStep[];
  formula: string;
  inputs: Record<string, number>;
  timestamp: string;
}

export interface SettlementItem {
  id: string;
  settlementId: string;
  bookId: string;
  bookName: string;
  authorId: string;
  authorName: string;
  productType: ProductType;
  channel: string;
  salesVolume: number;
  salesAmount: number;
  returnVolume: number;
  returnAmount: number;
  netSalesVolume: number;
  ladderTier: number;
  ladderRange: string;
  royaltyRate: number;
  royaltyAmount: number;
  calculationTrail: CalculationTrail;
  hasExceptions: boolean;
}

export interface SettlementException {
  id: string;
  settlementId: string;
  settlementItemId?: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  message: string;
  rawData: Record<string, any>;
  isConfirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
  confirmationNote?: string;
  autoOverridable: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  settlementId?: string;
  action: string;
  operator: string;
  timestamp: string;
  oldValue?: string;
  newValue?: string;
  note?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  rawValue?: any;
}

export interface CalculateRoyaltyRequest {
  period: string;
  authorId?: string;
  bookId?: string;
  forceRecalculate?: boolean;
}

export interface CalculateRoyaltyResponse {
  settlementId: string;
  totalAmount: number;
  itemCount: number;
  exceptionCount: number;
  calculationLogId: string;
  items: SettlementItem[];
  exceptions: SettlementException[];
}

export interface ExportRequest {
  settlementId: string;
  format: 'EXCEL' | 'CSV';
  includeTrail: boolean;
  includeRawData: boolean;
  customFields?: string[];
}

export interface ExportResponse {
  downloadUrl: string;
  filename: string;
  fileSize: number;
  processingNote: string;
}

export interface ChannelMapping {
  [key: string]: string;
}

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  PHYSICAL: '纸书',
  EBOOK: '电书',
  DISCOUNT: '活动折扣'
};

export const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  LATE_RETURN: '退货晚到',
  LADDER_CROSSING: '阶梯跨档',
  DUPLICATE_CHANNEL: '渠道重复',
  DIRTY_DATA: '脏数据',
  MISSING_CONTRACT: '缺少合同',
  MISSING_LADDER: '缺少阶梯配置',
  NEGATIVE_SALES: '负数销量'
};

export const EXCEPTION_SEVERITY_COLORS: Record<ExceptionSeverity, string> = {
  WARNING: '#d69e2e',
  ERROR: '#c53030',
  INFO: '#3182ce'
};

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  DRAFT: '草稿',
  PENDING_CONFIRMATION: '待确认',
  LOCKED: '已锁定',
  COMPLETED: '已完成'
};

export interface DashboardData {
  totalAuthors: number;
  totalBooks: number;
  totalSalesRecords: number;
  totalReturnRecords: number;
  totalSettlements: number;
  totalSettledAmount: number;
  pendingExceptions: number;
  settlements: Settlement[];
}

export interface SettlementDetail {
  settlement: Settlement;
  items: SettlementItem[];
  exceptions: SettlementException[];
  auditLogs: AuditLog[];
}
