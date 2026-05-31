export type RecordStatus = 'pending' | 'completed' | 'error' | 'processing';
export type OperationAction = 'import' | 'review' | 'modify' | 'export' | 'permission_change' | 'create';
export type RecordSource = 'api_doc' | 'manual' | 'call_log';

export interface InventoryRecord {
  id: string;
  source: RecordSource;
  interfaceName: string;
  status: RecordStatus;
  stockCode: string;
  preOccupyQty: number;
  releaseQty: number;
  operator: string;
  pendingReason?: string;
  idempotentKey: string;
  idempotentValid: boolean;
  idempotentInvalidReason?: string;
  idempotentRetryCount?: number;
  rawData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface OperationLog {
  id: string;
  recordId: string;
  action: OperationAction;
  operator: string;
  reason: string;
  beforeData?: Record<string, any>;
  afterData?: Record<string, any>;
  createdAt: string;
}

export interface PermissionChange {
  id: string;
  recordId: string;
  operator: string;
  beforePermission: Record<string, any>;
  afterPermission: Record<string, any>;
  changeReason: string;
  diffSnapshot: Record<string, any>;
  createdAt: string;
}

export interface AppFilters {
  status?: RecordStatus;
  source?: RecordSource;
  keyword?: string;
  dateRange?: [string, string];
  action?: OperationAction;
}

export interface ExportReport {
  generatedAt: string;
  generatedBy: string;
  filters: AppFilters;
  statistics: {
    total: number;
    pending: number;
    completed: number;
    error: number;
    processing: number;
    idempotentInvalid: number;
    permissionChanges: number;
    completionRate: number;
  };
  records: InventoryRecord[];
  permissionChanges: PermissionChange[];
  abnormalRecords: InventoryRecord[];
  suggestions: string[];
  reviewChecklist: {
    keyMetricsChecked: boolean;
    abnormalRecordsChecked: boolean;
    permissionChangesChecked: boolean;
  };
}

export const STATUS_COLORS: Record<RecordStatus, string> = {
  pending: '#F59E0B',
  completed: '#10B981',
  error: '#EF4444',
  processing: '#06B6D4',
};

export const STATUS_LABELS: Record<RecordStatus, string> = {
  pending: '待处理',
  completed: '已完成',
  error: '异常',
  processing: '处理中',
};

export const SOURCE_LABELS: Record<RecordSource, string> = {
  api_doc: '接口文档',
  manual: '手动创建',
  call_log: '调用日志',
};

export const ACTION_LABELS: Record<OperationAction, string> = {
  import: '导入',
  review: '复核',
  modify: '修改',
  export: '导出',
  permission_change: '权限变更',
  create: '创建',
};
