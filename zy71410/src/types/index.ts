export type SourceType = 'prospectus' | 'ledger' | 'payment';
export type FundCategory = 
  | '清洁能源' 
  | '清洁交通' 
  | '可持续水资源管理' 
  | '废物处理' 
  | '绿色建筑' 
  | '生态保护' 
  | '其他';
export type DiscrepancyType = 
  | 'category_mismatch' 
  | 'voucher_gap' 
  | 'disclosure_version' 
  | 'amount_mismatch'
  | 'date_mismatch';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'needs_explanation';

export interface SourceMeta {
  id: string;
  type: SourceType;
  name: string;
  version: string;
  uploadDate: string;
  uploadUser: string;
  description?: string;
}

export interface ProspectusData {
  id: string;
  sourceId: string;
  projectName: string;
  bondCode: string;
  issueAmount: number;
  plannedUse: string;
  plannedCategory: FundCategory;
  expectedDate: string;
  disclosureStandard: string;
  disclosureVersion: string;
}

export interface LedgerData {
  id: string;
  sourceId: string;
  projectName: string;
  plannedAmount: number;
  actualAmount: number;
  category: FundCategory;
  progress: number;
  plannedDate: string;
  actualDate?: string;
  status: string;
}

export interface PaymentVoucher {
  id: string;
  sourceId: string;
  voucherNumber: string;
  projectName: string;
  amount: number;
  paymentDate: string;
  payee: string;
  category: FundCategory;
  description: string;
  hasReceipt: boolean;
  hasApproval: boolean;
}

export interface FundUsageRecord {
  id: string;
  projectName: string;
  bondCode: string;
  category: FundCategory;
  plannedAmount: number;
  actualAmount: number;
  paymentDate?: string;
  prospectusId?: string;
  ledgerId?: string;
  voucherId?: string;
  disclosureVersion: string;
  approvalStatus: ApprovalStatus;
  explanation?: string;
  affectedResults?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Discrepancy {
  id: string;
  type: DiscrepancyType;
  severity: 'high' | 'medium' | 'low';
  description: string;
  recordId: string;
  fieldName?: string;
  expectedValue?: string;
  actualValue?: string;
  affectedResults: string[];
  resolved: boolean;
  resolution?: string;
}

export interface ProcessingHistory {
  id: string;
  recordId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  operator: string;
  timestamp: string;
  reason?: string;
}

export interface AppState {
  sources: SourceMeta[];
  prospectuses: ProspectusData[];
  ledgers: LedgerData[];
  vouchers: PaymentVoucher[];
  fundUsages: FundUsageRecord[];
  discrepancies: Discrepancy[];
  processingHistory: ProcessingHistory[];
  selectedBond: string | null;
  filters: FilterOptions;
}

export interface FilterOptions {
  bondCode?: string;
  category?: FundCategory;
  startDate?: string;
  endDate?: string;
  approvalStatus?: ApprovalStatus;
  hasDiscrepancies?: boolean;
  sourceType?: SourceType;
}

export interface ExportOptions {
  format: 'csv' | 'excel';
  includeDiscrepancies: boolean;
  includeHistory: boolean;
  dateRange?: { start: string; end: string };
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  prospectus: '募集说明书',
  ledger: '项目台账',
  payment: '付款凭证'
};

export const CATEGORY_LABELS: Record<FundCategory, string> = {
  '清洁能源': '清洁能源',
  '清洁交通': '清洁交通',
  '可持续水资源管理': '可持续水资源管理',
  '废物处理': '废物处理',
  '绿色建筑': '绿色建筑',
  '生态保护': '生态保护',
  '其他': '其他'
};

export const DISCREPANCY_TYPE_LABELS: Record<DiscrepancyType, string> = {
  category_mismatch: '用途错类',
  voucher_gap: '凭证缺口',
  disclosure_version: '披露口径问题',
  amount_mismatch: '金额不一致',
  date_mismatch: '日期不一致'
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: '待处理',
  approved: '已通过',
  rejected: '已拒绝',
  needs_explanation: '需解释'
};
