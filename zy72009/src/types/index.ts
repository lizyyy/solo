export type SettlementStatus =
  | 'pending'
  | 'confirmed'
  | 'need_material'
  | 'manual_adjust'
  | 'conflict';

export type DataSource =
  | 'system_import'
  | 'manual_entry'
  | 'historical_reconciliation';

export type ImportStrategy = 'skip' | 'update' | 'conflict';

export interface Transaction {
  id: string;
  transNo: string;
  transTime: string;
  amount: number;
  channel: string;
  memo: string;
}

export interface RefundRequest {
  id: string;
  requestNo: string;
  requestTime: string;
  amount: number;
  reason: string;
  applicant: string;
}

export interface ApprovalEmail {
  id: string;
  subject: string;
  sender: string;
  receiver: string;
  sentAt: string;
  content: string;
}

export interface Note {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface OperationLog {
  id: string;
  action: string;
  operator: string;
  operatedAt: string;
  reason: string;
  fromStatus: SettlementStatus | null;
  toStatus: SettlementStatus;
}

export interface Settlement {
  id: string;
  merchantName: string;
  amount: number;
  originalAmount?: number;
  status: SettlementStatus;
  source: DataSource;
  dataCaliber: string;
  createdAt: string;
  updatedAt: string;
  operator: string;
  adjustmentReason?: string;
  transactions: Transaction[];
  refundRequests: RefundRequest[];
  approvalEmails: ApprovalEmail[];
  notes: Note[];
  operationLogs: OperationLog[];
}

export interface ImportResult {
  total: number;
  success: number;
  skipped: number;
  updated: number;
  conflict: number;
  errors: string[];
}

export interface ValidationIssue {
  severity: 'warning' | 'error';
  field: string;
  message: string;
  suggestion: string;
}

export interface SettlementFilters {
  status: SettlementStatus | 'all';
  keyword: string;
  dateRange: [string, string] | null;
}

export const STATUS_LABELS: Record<SettlementStatus, string> = {
  pending: '待审核',
  confirmed: '已确认',
  need_material: '待补材料',
  manual_adjust: '人工改判',
  conflict: '冲突待处理',
};

export const SOURCE_LABELS: Record<DataSource, string> = {
  system_import: '系统导入',
  manual_entry: '手工录入',
  historical_reconciliation: '月底对账表补录',
};

export const IMPORT_STRATEGY_LABELS: Record<ImportStrategy, string> = {
  skip: '跳过重复',
  update: '更新覆盖',
  conflict: '标记冲突',
};
