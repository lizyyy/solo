export enum RecordStatus {
  PENDING_IMPORT = 'PENDING_IMPORT',
  IMPORTED = 'IMPORTED',
  ZERO_WITH_REVERSAL = 'ZERO_WITH_REVERSAL',
  PENDING_REVIEW = 'PENDING_REVIEW',
  REVIEWED_NORMAL = 'REVIEWED_NORMAL',
  REVIEWED_ADJUSTED = 'REVIEWED_ADJUSTED',
  SUMMARIZED = 'SUMMARIZED'
}

export enum ReviewSource {
  TAIL_DIFF_ADJUSTMENT = 'TAIL_DIFF_ADJUSTMENT',
  CUSTODIAN_CONFIRMATION = 'CUSTODIAN_CONFIRMATION'
}

export interface AuditLog {
  timestamp: Date;
  operator: string;
  action: string;
  oldValue?: any;
  newValue?: any;
  remark?: string;
}

export interface TailDiffAdjustment {
  originalLineNumber: number;
  originalAmount: number;
  manualChange?: number;
  currentStatus: RecordStatus;
  reviewSource?: ReviewSource;
  custodianPageReference?: string;
}

export interface TradeRecord {
  id: string;
  tradeDate: string;
  traderId: string;
  instrumentId: string;
  instrumentName: string;
  quantity: number;
  amount: number;
  originalAmount: number;
  remark: string;
  status: RecordStatus;
  isZeroWithReversal: boolean;
  tailDiffAdjustment?: TailDiffAdjustment;
  auditLogs: AuditLog[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceReport {
  reportDate: string;
  records: TradeRecord[];
  summary: {
    totalRecords: number;
    normalRecords: number;
    pendingReviewRecords: number;
    zeroWithReversalRecords: number;
    totalAmount: number;
  };
}

export interface ImportResult {
  success: boolean;
  importedCount: number;
  zeroWithReversalCount: number;
  records: TradeRecord[];
}
