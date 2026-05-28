export type SourceType = 'bank' | 'voucher' | 'invoice' | 'contract' | 'manual';

export type MatchStatus = 
  | 'unmatched' 
  | 'matched' 
  | 'pending' 
  | 'confirmed' 
  | 'rejected' 
  | 'split' 
  | 'merged'
  | 'red_flushed';

export type ConflictType = 
  | 'same_summary' 
  | 'amount_mismatch' 
  | 'red_flush_occupied'
  | 'duplicate_voucher';

export type DataSource = {
  id: string;
  name: string;
  type: SourceType;
  importTime: number;
  fileHash: string;
  recordCount: number;
  batchId: string;
};

export type BankTransaction = {
  id: string;
  batchId: string;
  sourceId: string;
  transactionDate: string;
  transactionNo: string;
  summary: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  counterparty: string;
  counterpartyAccount: string;
  remark: string;
  isRedFlush: boolean;
  originalTransactionNo?: string;
  matched: boolean;
  createdAt: number;
  updatedAt: number;
};

export type Voucher = {
  id: string;
  batchId: string;
  sourceId: string;
  voucherNo: string;
  voucherDate: string;
  summary: string;
  debitAmount: number;
  creditAmount: number;
  accountCode: string;
  accountName: string;
  isRedFlush: boolean;
  originalVoucherNo?: string;
  matched: boolean;
  createdAt: number;
  updatedAt: number;
};

export type Invoice = {
  id: string;
  batchId: string;
  sourceId: string;
  invoiceNo: string;
  invoiceCode: string;
  invoiceDate: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  counterparty: string;
  counterpartyTaxNo: string;
  matched: boolean;
  createdAt: number;
  updatedAt: number;
};

export type Contract = {
  id: string;
  batchId: string;
  sourceId: string;
  contractNo: string;
  contractName: string;
  contractAmount: number;
  counterparty: string;
  paymentTerms: string;
  matched: boolean;
  createdAt: number;
  updatedAt: number;
};

export type MatchRecord = {
  id: string;
  batchId: string;
  transactionIds: string[];
  voucherIds: string[];
  invoiceIds: string[];
  contractIds: string[];
  matchScore: number;
  matchMethod: 'auto' | 'manual' | 'split' | 'merge';
  status: MatchStatus;
  totalDebitAmount: number;
  totalCreditAmount: number;
  amountDifference: number;
  conflicts: ConflictInfo[];
  confirmedBy?: string;
  confirmedAt?: number;
  matchHistory: MatchHistoryItem[];
  createdAt: number;
  updatedAt: number;
};

export type ConflictInfo = {
  type: ConflictType;
  severity: 'high' | 'medium' | 'low';
  description: string;
  resolved: boolean;
};

export type MatchHistoryItem = {
  action: string;
  operator: string;
  timestamp: number;
  details: Record<string, unknown>;
};

export type ProcessBatch = {
  id: string;
  name: string;
  status: 'importing' | 'matching' | 'reviewing' | 'completed' | 'archived';
  sources: DataSource[];
  statistics: BatchStatistics;
  createdAt: number;
  updatedAt: number;
};

export type BatchStatistics = {
  totalTransactions: number;
  totalVouchers: number;
  totalInvoices: number;
  totalContracts: number;
  matchedCount: number;
  pendingCount: number;
  unmatchedCount: number;
  conflictCount: number;
  confirmedCount: number;
};

export type SplitRecord = {
  id: string;
  originalTransactionId: string;
  splitTransactions: string[];
  splitRatios: number[];
  splitAmounts: number[];
  createdBy: string;
  createdAt: number;
};

export type MergeRecord = {
  id: string;
  mergedTransactionIds: string[];
  resultTransactionId: string;
  createdBy: string;
  createdAt: number;
};

export type ManualConfirmation = {
  id: string;
  matchRecordId: string;
  operator: string;
  action: 'confirm' | 'reject' | 'adjust';
  comment: string;
  adjustments?: {
    transactionIds?: string[];
    voucherIds?: string[];
  };
  createdAt: number;
};

export type ImportConflict = {
  id: string;
  batchId: string;
  sourceType: SourceType;
  existingRecordId: string;
  newRecord: BankTransaction | Voucher | Invoice | Contract;
  resolution: 'skip' | 'overwrite' | 'append' | null;
  createdAt: number;
};

export type ExcelColumnMapping = {
  [key in SourceType]?: Record<string, string>;
};

export type MatchRule = {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  matchFields: string[];
  threshold: number;
  conditions: MatchCondition[];
};

export type MatchCondition = {
  field: string;
  operator: 'equals' | 'contains' | 'fuzzy' | 'range';
  value: string | number;
};

export type ExportConfig = {
  includeRawData: boolean;
  includeMatchHistory: boolean;
  includeConflicts: boolean;
  format: 'xlsx' | 'csv';
  sheets: string[];
};
