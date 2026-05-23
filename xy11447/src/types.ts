export type DataSource = 'pile_alarm' | 'inspection' | 'customer_complaint' | 'store_handover';

export type WorkOrderStatus = 
  | 'pending'
  | 'queued'
  | 'processing'
  | 'retrying'
  | 'manual_takeover'
  | 'compensated'
  | 'closed'
  | 'dead_letter';

export type DirtyRecordType = 
  | 'missing_fields'
  | 'cross_day'
  | 'name_change'
  | 'amount_conflict'
  | 'quantity_conflict';

export type RetryCategory = 
  | 'network_issue'
  | 'system_error'
  | 'data_inconsistency'
  | 'pending_confirmation'
  | 'other';

export interface StatusHistory {
  id: string;
  workOrderId: string;
  status: WorkOrderStatus;
  timestamp: Date;
  operator: string;
  reason: string;
}

export interface SourceData {
  pileId?: string;
  pileName?: string;
  storeId?: string;
  storeName?: string;
  alarmTime?: Date;
  recoverTime?: Date;
  faultType?: string;
  faultDescription?: string;
  complaintNo?: string;
  inspectionNo?: string;
  customerRemark?: string;
  amount?: number;
  quantity?: number;
  [key: string]: any;
}

export interface WorkOrder {
  id: string;
  orderNo: string;
  source: DataSource;
  sourceId: string;
  sourceData: SourceData;
  rawContent: string;
  status: WorkOrderStatus;
  retryCount: number;
  maxRetries: number;
  retryCategory?: RetryCategory;
  currentAreaManager?: string;
  createdAt: Date;
  updatedAt: Date;
  faultDurationMinutes?: number;
  compensationAmount?: number;
  closedAt?: Date;
  statusHistory: StatusHistory[];
  processingOpinion?: string;
}

export interface DirtyRecord {
  id: string;
  workOrderId: string;
  type: DirtyRecordType;
  fieldName?: string;
  expectedValue?: string;
  actualValue?: string;
  rawContent: string;
  processingOpinion?: string;
  isResolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface CreateWorkOrderRequest {
  source: DataSource;
  sourceId: string;
  sourceData: SourceData;
  maxRetries?: number;
  operator: string;
}

export interface UpdateStatusRequest {
  status: WorkOrderStatus;
  operator: string;
  reason: string;
  retryCategory?: RetryCategory;
  compensationAmount?: number;
}

export interface QueryParams {
  status?: WorkOrderStatus;
  source?: DataSource;
  retryCategory?: RetryCategory;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface ExportParams {
  status?: WorkOrderStatus;
  source?: DataSource;
  format: 'csv' | 'json';
}

export interface DeadLetterStats {
  total: number;
  byCategory: Record<RetryCategory, number>;
  bySource: Record<DataSource, number>;
}

export interface AreaManagerDashboard {
  retryableByCategory: Record<RetryCategory, number>;
  deadLetterStats: DeadLetterStats;
  recoveryFollowUps: number;
  pendingManualTakeover: number;
}
