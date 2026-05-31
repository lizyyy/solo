export type DepositStatus =
  | 'pending_entry'
  | 'refund_list_entered'
  | 'waiting_settlement'
  | 'settlement_attached'
  | 'pending_review'
  | 'pending_recheck'
  | 'completed'
  | 'rejected';

export type MaterialType = 'refund_list' | 'settlement' | 'statement';
export type ChangeType = 'material' | 'conclusion';
export type ActionType = 'create' | 'update' | 'upload' | 'status_change';

export interface DepositRecord {
  id: string;
  franchiseeName: string;
  amount: number;
  source: string;
  status: DepositStatus;
  pendingReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface Material {
  id: string;
  recordId: string;
  type: MaterialType;
  name: string;
  uploader: string;
  uploadedAt: string;
  description: string;
}

export interface AuditLog {
  id: string;
  recordId: string;
  actionType: ActionType;
  changeType: ChangeType;
  operator: string;
  timestamp: string;
  reason: string;
  oldValue?: string;
  newValue?: string;
}

export interface StatusHistory {
  id: string;
  recordId: string;
  status: DepositStatus;
  operator: string;
  timestamp: string;
  remark: string;
}

export interface StoreState {
  records: DepositRecord[];
  materials: Material[];
  auditLogs: AuditLog[];
  statusHistories: StatusHistory[];
  currentUser: string;
}

export interface StoreActions {
  addRecord: (record: Omit<DepositRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateRecord: (id: string, updates: Partial<DepositRecord>, reason: string, changeType: ChangeType) => void;
  addMaterial: (material: Omit<Material, 'id' | 'uploadedAt'>) => void;
  changeStatus: (recordId: string, newStatus: DepositStatus, operator: string, remark: string, reason: string, changeType: ChangeType) => void;
  getRecordById: (id: string) => DepositRecord | undefined;
  getMaterialsByRecordId: (recordId: string) => Material[];
  getAuditLogsByRecordId: (recordId: string) => AuditLog[];
  getStatusHistoryByRecordId: (recordId: string) => StatusHistory[];
  exportRecord: (recordId: string) => string;
}

export const STATUS_LABELS: Record<DepositStatus, string> = {
  pending_entry: '待录入',
  refund_list_entered: '退款清单已录入',
  waiting_settlement: '待结算附件',
  settlement_attached: '结算附件已补',
  pending_review: '待审核',
  pending_recheck: '待复核',
  completed: '已完成',
  rejected: '已驳回',
};

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  refund_list: '退款清单',
  settlement: '结算附件',
  statement: '对账单',
};

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  material: '补材料',
  conclusion: '改结论',
};
