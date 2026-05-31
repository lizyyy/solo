export type SourceType = "活动复盘" | "关卡草表";
export type StatusType = "待草表" | "待确认" | "已完成" | "已驳回";
export type ActionType = "创建" | "状态变更" | "人工确认" | "驳回" | "关联" | "重复标记";

export interface QueueRecord {
  id: string;
  activityId: string;
  source: SourceType;
  status: StatusType;
  submittedBy: string;
  submittedAt: string;
  content: string;
  isDuplicate: boolean;
  isAnomaly: boolean;
  anomalyReason?: string;
  relatedRecordId?: string;
}

export interface StatusChange {
  id: string;
  recordId: string;
  fromStatus: string;
  toStatus: string;
  changedBy: string;
  changedAt: string;
  reason: string;
}

export interface AuditLog {
  id: string;
  recordId: string;
  action: ActionType;
  operator: string;
  operatedAt: string;
  detail: string;
}

export interface RecordDetail extends QueueRecord {
  statusChanges: StatusChange[];
  auditLogs: AuditLog[];
  relatedRecords: QueueRecord[];
}

export interface CreateRecordRequest {
  activityId: string;
  source: SourceType;
  submittedBy: string;
  content: string;
}

export interface UpdateStatusRequest {
  toStatus: StatusType;
  changedBy: string;
  reason: string;
}
