export type RecordStatus = 
  | 'pending'      
  | 'approved'     
  | 'rejected'     
  | 'withdrawn'    
  | 'disputed'     
  | 'completed';

export type RecordSource = 
  | 'approval_screenshot' 
  | 'review_daily'        
  | 'manual_entry'        
  | 'batch_import';

export interface GuaranteeRecord {
  id: number;
  guaranteeNo: string;
  customerName: string;
  amount: number;
  currency: string;
  source: RecordSource;
  sourceRef?: string;
  status: RecordStatus;
  pendingReason?: string;
  reviewReason?: string;
  currentOperator: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  isDuplicate: boolean;
  duplicateWith?: number;
  remark?: string;
}

export interface OperationLog {
  id: number;
  recordId: number;
  operation: string;
  operator: string;
  oldStatus?: RecordStatus;
  newStatus?: RecordStatus;
  changes: string;
  reason?: string;
  createdAt: string;
}

export interface ImportResult {
  success: number;
  duplicates: number;
  errors: number;
  errorDetails: string[];
  importedIds: number[];
  duplicateIds: number[];
}

export interface QueryFilters {
  status?: RecordStatus;
  source?: RecordSource;
  isDuplicate?: boolean;
  customerName?: string;
  guaranteeNo?: string;
  startDate?: string;
  endDate?: string;
  currentOperator?: string;
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  pending: '待处理',
  approved: '已通过',
  rejected: '已驳回',
  withdrawn: '已撤回',
  disputed: '待复核',
  completed: '已完成'
};

export const SOURCE_LABELS: Record<RecordSource, string> = {
  approval_screenshot: '审批截图',
  review_daily: '复核日报',
  manual_entry: '手工录入',
  batch_import: '批量导入'
};

export const STATUS_COLORS: Record<RecordStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-800',
  disputed: 'bg-purple-100 text-purple-800',
  completed: 'bg-blue-100 text-blue-800'
};

export const getStatusLabel = (status: RecordStatus): string => STATUS_LABELS[status] || status;
export const getSourceLabel = (source: RecordSource): string => SOURCE_LABELS[source] || source;
