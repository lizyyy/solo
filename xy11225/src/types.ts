export enum FaultType {
  CABINET_DOOR_FAILED = '柜门打不开',
  SCAN_FAILED = '扫码失败',
  EMPTY_BIN_FALSE_ALARM = '空仓误报',
  OTHER = '其他'
}

export enum RecordStatus {
  PENDING = '待处理',
  PROCESSING = '处理中',
  RESOLVED = '已解决',
  REJECTED = '已驳回',
  MERGED = '已合并'
}

export enum ProcessingResult {
  ALLOWED = '放行',
  BLOCKED = '拦截'
}

export interface FaultRecord {
  id: string;
  cabinetId: string;
  faultType: FaultType;
  description: string;
  reporter: string;
  handler?: string;
  status: RecordStatus;
  isOffline: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  mergedFrom?: string[];
  processingResult?: ProcessingResult;
  processingReason?: string;
  batchId?: string;
}

export interface BatchOperationResult {
  batchId: string;
  total: number;
  successCount: number;
  failureCount: number;
  successes: string[];
  failures: Array<{
    recordId?: string;
    error: string;
  }>;
  createdAt: string;
}

export interface StorageData {
  records: FaultRecord[];
  batches: BatchOperationResult[];
  cabinets: {
    [cabinetId: string]: {
      isOffline: boolean;
      lastMaintenanceAt?: string;
    };
  };
}

export interface FilterOptions {
  handler?: string;
  startDate?: string;
  endDate?: string;
  status?: RecordStatus;
  faultType?: FaultType;
  cabinetId?: string;
}

export interface RuleValidationResult {
  passed: boolean;
  reason: string;
  action?: 'merge' | 'block' | 'allow' | 'flag';
  relatedRecordId?: string;
}
