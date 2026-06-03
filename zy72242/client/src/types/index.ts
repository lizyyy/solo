export type RecordStatus = 'pending' | 'reviewing' | 'approved' | 'rejected';
export type ModificationType = 't1_to_t2' | 'other';
export type OperatorRole = 'fund_manager' | 'product_manager' | 'system';
export type AuditAction = 'create' | 'modify' | 'import' | 'adjust' | 'review' | 'rerun';
export type HolidayType = 'weekend' | 'public_holiday';

export interface ReconciliationRecord {
  id: string;
  tradeDate: string;
  expectedArrivalDate: string;
  actualArrivalDate: string;
  amount: number;
  fundCode: string;
  futuresCode: string;
  status: RecordStatus;
  hasManualModification: boolean;
  modificationType?: ModificationType;
  modifiedBy?: string;
  modifiedAt?: string;
  modificationReason?: string;
  whyKept: string;
  missingMaterials: string;
  nextAction: string;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationRecordWithRelations extends ReconciliationRecord {
  adjustments: TailAdjustment[];
  auditLogs: AuditLog[];
  reviews: ReviewRecord[];
}

export interface TailAdjustment {
  id: string;
  recordId: string;
  amount: number;
  reason: string;
  adjustedBy: string;
  adjustedAt: string;
  affectsReconciliation: boolean;
}

export interface AuditLog {
  id: string;
  recordId: string;
  action: AuditAction;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  reason: string;
  operator: string;
  operatorRole: OperatorRole;
  timestamp: string;
  affectedResults: string;
}

export interface ReviewRecord {
  id: string;
  recordId: string;
  reviewer: string;
  status: 'approved' | 'rejected';
  comment?: string;
  reviewedAt: string;
}

export interface Holiday {
  date: string;
  name: string;
  type: HolidayType;
}

export interface ReconciliationNoteUpdate {
  whyKept: string;
  missingMaterials: string;
  nextAction: string;
  updatedBy: string;
}

export interface TailAdjustmentCreate {
  recordId: string;
  amount: number;
  reason: string;
  adjustedBy: string;
}

export interface ReviewCreate {
  recordId: string;
  reviewer: string;
  status: 'approved' | 'rejected';
  comment?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface DemoStepResult {
  message: string;
  details: {
    step: number;
    description: string;
    keyPoint: string;
    records?: ReconciliationRecord[];
    record?: ReconciliationRecord;
    adjustment?: TailAdjustment;
    flowSummary?: string[];
  };
}

export interface StatusBadgeConfig {
  label: string;
  className: string;
}

export const STATUS_CONFIG: Record<RecordStatus, StatusBadgeConfig> = {
  pending: { label: '待处理', className: 'bg-gray-100 text-gray-800' },
  reviewing: { label: '待基金经理复核', className: 'bg-amber-100 text-amber-800' },
  approved: { label: '已通过', className: 'bg-green-100 text-green-800' },
  rejected: { label: '已驳回', className: 'bg-red-100 text-red-800' }
};

export const ACTION_LABELS: Record<AuditAction, string> = {
  create: '创建',
  modify: '修改',
  import: '导入',
  adjust: '尾差调整',
  review: '复核',
  rerun: '重跑'
};

export const ROLE_LABELS: Record<OperatorRole, string> = {
  fund_manager: '基金经理',
  product_manager: '产品经理',
  system: '系统'
};
