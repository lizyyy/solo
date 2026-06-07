export type RecordStatus = 'pending' | 'normal' | 'abnormal' | 'false_positive';

export interface ValuationVersion {
  id: string;
  recordId: string;
  version: string;
  valuation: number;
  description: string;
  createdAt: string;
  operator: string;
}

export interface JudgmentHistory {
  id: string;
  recordId: string;
  oldStatus: RecordStatus;
  newStatus: RecordStatus;
  oldRemark: string;
  newRemark: string;
  createdAt: string;
  operator: string;
}

export interface ValuationRecord {
  id: string;
  tradeId: string;
  counterparty: string;
  productType: string;
  notionalAmount: number;
  currentStatus: RecordStatus;
  currentRemark: string;
  isFalsePositive: boolean;
  createdAt: string;
  updatedAt: string;
  versions: ValuationVersion[];
  judgments: JudgmentHistory[];
}

export interface FilterParams {
  status?: RecordStatus | 'all';
  counterparty?: string;
  productType?: string;
  startDate?: string;
  endDate?: string;
  excludeFalsePositive?: boolean;
  keyword?: string;
}

export interface FileParseResult {
  success: boolean;
  data: Partial<ValuationRecord>[];
  errors?: string[];
}
