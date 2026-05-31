export type RateType = 'service_fee' | 'commission' | 'penalty';
export type ItemStatus = 'normal' | 'pending' | 'anomaly';
export type AnomalyType = 'duplicate' | 'cross_period' | 'pending' | 'late_attachment';
export type AnomalyStatus = 'open' | 'confirmed' | 'rejected';
export type AnomalySeverity = 'high' | 'medium' | 'low';
export type ConfirmationConclusion = 'valid' | 'invalid' | 'adjusted';
export type FileType = 'invoice' | 'settlement' | 'proof';
export type ActionType = 'import' | 'detect_anomaly' | 'confirm' | 'reject' | 'adjust' | 'add_note' | 'export';

export interface RateTable {
  id: string;
  supplierId: string;
  supplierName: string;
  rateType: RateType;
  rate: number;
  effectiveFrom: string;
  effectiveTo: string;
  version: string;
}

export interface SettlementAttachment {
  id: string;
  refundId: string;
  fileName: string;
  fileType: FileType;
  uploadDate: string;
  reviewDeadline: string;
  isLate: boolean;
  hash: string;
  content: string;
}

export interface Anomaly {
  id: string;
  refundId: string;
  type: AnomalyType;
  description: string;
  severity: AnomalySeverity;
  detectedAt: string;
  status: AnomalyStatus;
  relatedRefundIds: string[];
  crossPeriodDays?: number;
  pendingDays?: number;
}

export interface ManualConfirmation {
  id: string;
  refundId: string;
  operator: string;
  conclusion: ConfirmationConclusion;
  explanation: string;
  reconciliationNote: string;
  confirmedAt: string;
  evidenceChainHash: string;
}

export interface RefundItem {
  id: string;
  serialNo: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  feeAmount: number;
  refundDate: string;
  belongPeriod: string;
  entryDate: string;
  writeOffDate: string | null;
  status: ItemStatus;
  rateId: string;
  anomalies: Anomaly[];
  attachments: SettlementAttachment[];
  confirmations: ManualConfirmation[];
}

export interface OperationLog {
  id: string;
  refundId: string;
  operator: string;
  action: ActionType;
  oldValue: any;
  newValue: any;
  remark: string;
  operatedAt: string;
  snapshotHash: string;
}

export interface ExportVerification {
  exportId: string;
  exportTime: string;
  operator: string;
  recordCount: number;
  totalAmount: number;
  totalFeeAmount: number;
  statusBreakdown: {
    normal: number;
    pending: number;
    anomaly: number;
  };
  dataHash: string;
  signature: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  type: 'rate' | 'refund' | 'attachment' | 'confirmation' | 'anomaly';
  item: RefundItem | RateTable | SettlementAttachment | ManualConfirmation | Anomaly;
  refundId: string;
}

export interface FilterState {
  supplierId: string;
  status: ItemStatus | 'all';
  anomalyType: AnomalyType | 'all';
  dateRange: {
    start: string;
    end: string;
  };
  searchKeyword: string;
}
