export interface AddItemRecord {
  id: string;
  customerName: string;
  idCard: string;
  phone: string;
  packageCode: string;
  itemCode: string;
  itemName: string;
  itemPrice: number;
  quantity: number;
  couponCode?: string;
  couponAmount?: number;
  unitCode?: string;
  operator: string;
  operationTime: string;
  remark?: string;
  isRefund?: boolean;
  originalRecordId?: string;
}

export interface PackageInfo {
  packageCode: string;
  packageName: string;
  basePrice: number;
  includedItems: string[];
  addableItems: string[];
}

export interface UnitAgreement {
  unitCode: string;
  unitName: string;
  contractNumber: string;
  totalQuota: number;
  usedQuota: number;
  validFrom: string;
  validTo: string;
  eligibleEmployees: string[];
  allowedPackages: string[];
  settlementType: 'monthly' | 'quarterly' | 'yearly';
}

export interface CouponInfo {
  couponCode: string;
  couponType: 'discount' | 'cash' | 'freeItem';
  value: number;
  maxStackCount: number;
  validFrom: string;
  validTo: string;
  applicableItems: string[];
  minConsumption?: number;
}

export type RecordStatus = 'normal' | 'pending' | 'failed';

export interface ProcessingResult {
  status: RecordStatus;
  record: AddItemRecord;
  originalFields: Record<string, any>;
  appliedRules: string[];
  suggestions: string[];
  readableExplanation: string;
}

export interface BatchProcessingResponse {
  batchId: string;
  totalCount: number;
  normalItems: ProcessingResult[];
  pendingItems: ProcessingResult[];
  failedItems: ProcessingResult[];
  summary: {
    normalCount: number;
    pendingCount: number;
    failedCount: number;
    totalAmount: number;
    couponDiscount: number;
    unitSettlementAmount: number;
  };
  warnings: string[];
  ruleViolations: RuleViolation[];
}

export interface RuleViolation {
  ruleName: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
  affectedRecords: number;
}

export interface ProcessedBatch {
  batchId: string;
  processedAt: string;
  fileHashes: string[];
  recordCount: number;
}

export interface ParsedData {
  addItems: AddItemRecord[];
  packages: PackageInfo[];
  unitAgreements: UnitAgreement[];
  coupons: CouponInfo[];
}
