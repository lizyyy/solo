export type RecordStatus = 'processed' | 'pending' | 'returned' | 'anomaly';

export type SubmitType = 'normal' | 'supplement' | 'withdraw' | 'duplicate';

export type AnomalyType = 'split_error' | 'lock_miss' | 'coverage_over' | 'missing_field' | 'duplicate_submit';

export interface Fund {
  fundId: string;
  fundName: string;
  fundCode: string;
  establishDate: string;
  manager: string;
}

export interface ShareRecord {
  shareId: string;
  fundId: string;
  shareDate: string;
  normalShares: number;
  sidePocketShares: number;
  totalShares: number;
  splitStatus: 'normal' | 'error' | 'corrected';
  version: string;
}

export interface SidePocketAsset {
  assetId: string;
  fundId: string;
  assetName: string;
  assetAmount: number;
  lockStartDate: string;
  lockEndDate: string;
  isLocked: boolean;
  restrictionStatus: 'normal' | 'missing' | 'corrected';
}

export interface ValuationRecord {
  valuationId: string;
  fundId: string;
  valuationDate: string;
  normalValue: number;
  sidePocketValue: number;
  totalValue: number;
  unitNetValue: number;
  valuationVersion: string;
  status: RecordStatus;
  anomalies: AnomalyType[];
  submitType: SubmitType;
  remark: string;
  isLatest: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FilterConditions {
  fundIds: string[];
  dateRange: [string, string] | null;
  statuses: RecordStatus[];
  valuationVersions: string[];
  submitTypes: SubmitType[];
  hasAnomaly: boolean | null;
}

export interface OperationLog {
  logId: string;
  valuationId: string;
  operator: string;
  operation: string;
  fromStatus: RecordStatus | null;
  toStatus: RecordStatus;
  remark: string;
  operateTime: string;
}

export interface StatusOperation {
  label: string;
  action: string;
  target: RecordStatus;
}

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  split_error: '份额拆分错误',
  lock_miss: '限制期漏算',
  coverage_over: '侧袋估值覆盖主账',
  missing_field: '缺字段',
  duplicate_submit: '重复提交',
};

export const STATUS_LABELS: Record<RecordStatus, string> = {
  processed: '已处理',
  pending: '待确认',
  returned: '退回补材料',
  anomaly: '异常',
};

export const SUBMIT_TYPE_LABELS: Record<SubmitType, string> = {
  normal: '正常',
  supplement: '补录',
  withdraw: '撤回',
  duplicate: '重复提交',
};
