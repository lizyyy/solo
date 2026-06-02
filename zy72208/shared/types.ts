export type BatchStatus = 'DRAFT' | 'IMPORTED' | 'RISK_REVIEWED' | 'AUDITED' | 'COMPLETED';

export type DetailStatus = 'PENDING' | 'EXCEPTION' | 'PENDING_REVIEW' | 'REVIEWED' | 'APPROVED';

export type CheckType = 'DUPLICATE_IMPORT' | 'MIXED_CURRENCY' | 'RECALC_AFTER_SUPPLEMENT' | 'EXPORT_CONSISTENCY';

export type CheckStatus = 'PASS' | 'FAIL' | 'WARNING';

export type OperationType = 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'CURRENCY_REVIEW' | 'TAX_RATE_UPDATE';

export type ImportSource = 'PASTE' | 'FILE_UPLOAD';

export type CurrencyReviewDecision = 'MARK_EXCEPTION' | 'SUBMIT_REVIEW' | 'REJECT';

export interface SettlementBatch {
  id: string;
  batchNo: string;
  status: BatchStatus;
  sourceFile: string;
  sourceType: string;
  totalCount: number;
  totalCommissionAmount: number;
  totalTaxAmount: number;
  totalNetAmount: number;
  warningCount: number;
  hasMixedCurrency: number;
  importedBy: string;
  importedAt: string;
  riskReviewedBy?: string;
  riskReviewedAt?: string;
  auditedBy?: string;
  auditedAt?: string;
  importDate: string;
  importOperator: string;
  riskOperator?: string;
  auditOperator?: string;
  totalRecords: number;
  exceptionRecords: number;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementDetail {
  id: string;
  batchId: string;
  originalLineNo: number;
  originalSnapshotId: string;
  policyNo: string;
  productName: string;
  commissionAmount: number;
  currency: string;
  currencyRaw: string;
  hasMixedCurrency: boolean;
  taxRate?: number;
  taxRateRemark?: string;
  netAmount: number;
  status: DetailStatus;
  tierLevel: number;
  tierRate: number;
  currentHandler?: string;
  dataFingerprint: string;
  createdAt: string;
  updatedAt: string;
}

export interface OriginalSnapshot {
  id: string;
  batchId: string;
  originalLineNo: number;
  rawContent: string;
  importedAt: string;
  importSource: ImportSource;
  fileHash?: string;
}

export interface AuditLog {
  id: string;
  detailId: string;
  batchId: string;
  operator: string;
  operationType: OperationType;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  remark?: string;
  operatedAt: string;
}

export interface SelfCheckResult {
  id: string;
  batchId: string;
  checkType: CheckType;
  status: CheckStatus;
  message: string;
  affectedDetailIds: string[];
  checkedAt: string;
  checkMetadata: Record<string, any>;
}

export interface MixedCurrencyDetectionResult {
  hasMixed: boolean;
  detectedCurrencies: string[];
  normalized: string | null;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicates: Array<{ batchNo: string; lineNo: number }>;
}

export interface ConsistencyCheckResult {
  consistent: boolean;
  pageFingerprint: string;
  apiFingerprint: string;
  exportFingerprint: string;
}

export interface ReplayCommand {
  command: string;
  description: string;
  expectedOutput: string;
}

export interface ImportRawRow {
  lineNo: number;
  policyNo: string;
  productName: string;
  commissionAmount: string;
  currency: string;
  [key: string]: any;
}
