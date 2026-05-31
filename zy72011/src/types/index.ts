export type WarningType = 'amount_mismatch' | 'reason_unknown' | 'old_version' | 'other';

export type WarningStatus = 'pending' | 'confirmed' | 'rejected' | 'need_manual';

export type MaterialType = 'bank_receipt' | 'business_ledger' | 'screenshot' | 'contract_scan' | 'supplement';

export type HistoryAction = 'create' | 'update' | 'judge' | 'rollback' | 'remark';

export type DiffType = 'add' | 'delete' | 'modify' | 'conflict';

export interface MaterialItem {
  id: string;
  type: MaterialType;
  name: string;
  url?: string;
  uploadTime: string;
  isDirty?: boolean;
  formatNote?: string;
}

export interface HistoryRecord {
  id: string;
  action: HistoryAction;
  operator: string;
  time: string;
  oldValue?: any;
  newValue?: any;
  note?: string;
}

export interface WarningRecord {
  id: string;
  supplierName: string;
  billAmount: number;
  warningType: WarningType;
  status: WarningStatus;
  source: MaterialType;
  originalRemark: string;
  currentRemark: string;
  materials: MaterialItem[];
  history: HistoryRecord[];
  createdAt: string;
  updatedAt: string;
  processingAdvice: string;
}

export interface DiffItem {
  field: string;
  oldValue: any;
  newValue: any;
  type: DiffType;
}

export interface ImportResult {
  total: number;
  skipped: number;
  updated: number;
  conflicts: number;
  conflictItems: string[];
  diffReport: { recordId: string; diffs: DiffItem[] }[];
}

export const WARNING_TYPE_LABELS: Record<WarningType, string> = {
  amount_mismatch: '金额不匹配',
  reason_unknown: '原因待核实',
  old_version: '旧口径数据',
  other: '其他',
};

export const STATUS_LABELS: Record<WarningStatus, string> = {
  pending: '待处理',
  confirmed: '已确认',
  rejected: '已驳回',
  need_manual: '需人工确认',
};

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  bank_receipt: '银行回单',
  business_ledger: '业务台账',
  screenshot: '群截图',
  contract_scan: '合同扫描件',
  supplement: '补充说明',
};

export const HISTORY_ACTION_LABELS: Record<HistoryAction, string> = {
  create: '创建',
  update: '更新',
  judge: '改判',
  rollback: '回退',
  remark: '备注',
};
