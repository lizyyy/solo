export enum QueueStatus {
  QUEUING = 'queuing',
  OVERFLOWING = 'overflowing',
  CONNECTED = 'connected',
  ABANDONED = 'abandoned'
}

export enum RecordStatus {
  SUCCESS = 'success',
  CONFLICT = 'conflict',
  REJECTED = 'rejected',
  COMPLETED = 'completed'
}

export interface Visitor {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  businessObject?: string;
}

export interface SkillGroup {
  id: string;
  name: string;
  maxCapacity: number;
  currentLoad: number;
  overflowTargetId?: string;
}

export interface StatusHistory {
  id: string;
  queueRecordId: string;
  previousStatus: QueueStatus | null;
  newStatus: QueueStatus;
  operatorId?: string;
  operatorName?: string;
  reason?: string;
  createdAt: Date;
}

export interface QueueRecord {
  id: string;
  visitor: Visitor;
  skillGroupId: string;
  skillGroupName: string;
  overflowTargetId?: string;
  overflowTargetName?: string;
  status: QueueStatus;
  recordStatus: RecordStatus;
  queueStartTime: Date;
  connectedTime?: Date;
  abandonedTime?: Date;
  queueDurationSeconds: number;
  ownerId?: string;
  ownerName?: string;
  businessObject?: string;
  createdAt: Date;
  updatedAt: Date;
  isOverflowPlaceholder?: boolean;
}

export interface CreateQueueRequest {
  visitor: Visitor;
  skillGroupId: string;
  skillGroupName: string;
  overflowTargetId?: string;
  overflowTargetName?: string;
  businessObject?: string;
  operatorId?: string;
  operatorName?: string;
}

export interface UpdateStatusRequest {
  status: QueueStatus;
  operatorId?: string;
  operatorName?: string;
  reason?: string;
}

export interface QueryFilter {
  startDate?: Date;
  endDate?: Date;
  status?: QueueStatus;
  recordStatus?: RecordStatus;
  ownerId?: string;
  businessObject?: string;
  skillGroupId?: string;
  visitorId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ExportRecord extends QueueRecord {
  statusHistoryCount: number;
  lastStatusChangeTime: Date;
}

export interface ImportResult {
  successCount: number;
  failedCount: number;
  errors: Array<{
    row: number;
    message: string;
    data: Record<string, unknown>;
  }>;
}