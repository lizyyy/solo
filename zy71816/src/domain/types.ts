export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY';

export interface ReceiptLine {
  id: string;
  platform: string;
  orderId: string;
  amount: number;
  currency: Currency;
  receivedAt: string;
  feeAmount: number;
  feePeriod: string;
  netAmount: number;
  status: 'pending' | 'confirmed' | 'disputed';
  modifiedBy?: string;
  modifiedAt?: string;
}

export interface JudgmentResult {
  receiptId: string;
  judgment: 'auto_confirmed' | 'needs_review' | 'cross_period_fee' | 'duplicate';
  reasons: JudgmentReason[];
  nextSteps: string[];
  decidedAt: string;
  decidedBy: 'system';
  batchRunId: string;
}

export interface JudgmentReason {
  code: string;
  message: string;
  detail: string;
  source: 'receipt_line' | 'rate_table' | 'rule_engine';
}

export interface CrossPeriodFeeAlert {
  receiptId: string;
  feeAmount: number;
  currency: Currency;
  feePeriod: string;
  receiptPeriod: string;
  feeSource: 'receipt_line' | 'rate_table';
  sourceDetail: string;
  contactPerson: string;
  explanation: string;
  nextAction: string;
}

export interface RefundItem {
  id: string;
  receiptId: string;
  refundAmount: number;
  currency: Currency;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface RefundChangeRecord {
  id: string;
  refundItemId: string;
  changedBy: string;
  changedAt: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  reconciliationNote?: string;
}

export interface ProcessingBatch {
  id: string;
  runAt: string;
  receiptIds: string[];
  results: JudgmentResult[];
  status: 'completed' | 'partial' | 'failed';
}

export interface ReceiptHistoryEntry {
  receiptId: string;
  batchRunId: string;
  judgment: JudgmentResult['judgment'];
  processedAt: string;
  skipped: boolean;
  skipReason?: string;
}

export interface ReconciliationStatement {
  receiptId: string;
  period: string;
  totalReceived: number;
  totalFees: number;
  totalRefunds: number;
  netAmount: number;
  changeRecords: RefundChangeRecord[];
  notes: string;
}
