export type EventStatus =
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "pending_confirm_idempotency"
  | "pending_confirm_audit_gap"
  | "pending_confirm_param_corrupted"
  | "revoked";

export type ExceptionType =
  | "none"
  | "idempotency_key_collision"
  | "audit_log_gap"
  | "client_param_corrupted";

export interface CompensationEvent {
  id: string;
  idempotencyKey: string;
  status: EventStatus;
  exceptionType: ExceptionType;
  clientId: string;
  webhookUrl: string;
  payload: string;
  createdAt: number;
  updatedAt: number;
  version: string;
}

export interface StatusChange {
  id: string;
  eventId: string;
  fromStatus: EventStatus | "";
  toStatus: EventStatus;
  reason: string;
  operator: string;
  timestamp: number;
}

export interface AuditLog {
  id: string;
  eventId: string;
  action: string;
  detail: string;
  operator: string;
  timestamp: number;
}

export interface DiffItem {
  idempotencyKey: string;
  type: "added" | "modified" | "removed";
  oldValue?: string;
  newValue?: string;
  field?: string;
}

export interface ImportRecord {
  id: string;
  fileName: string;
  version: string;
  importTime: number;
  checksum: string;
  diffSummary: {
    added: number;
    modified: number;
    removed: number;
    details: DiffItem[];
  };
}

export interface FilterState {
  statuses: EventStatus[];
  exceptionTypes: ExceptionType[];
  clientId: string;
  idempotencyKeySearch: string;
  timeRangeStart: number | null;
  timeRangeEnd: number | null;
}

export type ExportFormat = "csv" | "json";

export interface ExportConfig {
  format: ExportFormat;
  includeStatusHistory: boolean;
  includeAuditLogs: boolean;
  filterSnapshot: FilterState;
}

export const EXCEPTION_LABELS: Record<ExceptionType, string> = {
  none: "无异常",
  idempotency_key_collision: "幂等键失效",
  audit_log_gap: "审计日志缺口",
  client_param_corrupted: "客户端参数破坏",
};

export const STATUS_LABELS: Record<EventStatus, string> = {
  pending: "待处理",
  processing: "处理中",
  success: "已成功",
  failed: "已失败",
  pending_confirm_idempotency: "待确认-幂等键失效",
  pending_confirm_audit_gap: "待确认-审计日志缺口",
  pending_confirm_param_corrupted: "待确认-参数破坏",
  revoked: "已撤回",
};

export const PENDING_CONFIRM_STATUSES: EventStatus[] = [
  "pending_confirm_idempotency",
  "pending_confirm_audit_gap",
  "pending_confirm_param_corrupted",
];

export const TERMINAL_STATUSES: EventStatus[] = ["success", "failed"];

export const EXCEPTION_EXPLANATIONS: Record<
  Exclude<ExceptionType, "none">,
  { reason: string; impact: string; suggestion: string }
> = {
  idempotency_key_collision: {
    reason:
      "同一幂等键对应多条未终态事件，无法确定哪条是最终有效投递。常见原因包括上游重试、集群多节点并发写入、幂等键生成规则变更。",
    impact:
      "下游可能收到重复处理请求，或错误地接受了非最新事件的结果，导致数据不一致。",
    suggestion:
      "逐一比对相同幂等键下的事件 payload 和时间戳，确认哪条是最新的有效投递，将其标记为成功，其余标记为失败或撤回。",
  },
  audit_log_gap: {
    reason:
      "事件的状态变更记录存在时间间隔超过5分钟的空白，可能是日志服务中断、写入失败或存储层丢失。",
    impact:
      "无法完整追溯事件的处理过程，可能导致合规风险和问题排查困难。",
    suggestion:
      "检查日志服务在空白时段的运行状态，尝试从备份或监控系统补充日志。如无法补充，在确认事件当前状态无误后手动补充审计记录。",
  },
  client_param_corrupted: {
    reason:
      "事件的 payload 中必需字段缺失或格式异常，可能是客户端版本不兼容、序列化错误或传输过程中数据被篡改。",
    impact:
      "下游无法正确解析请求内容，可能导致业务逻辑执行错误或静默失败。",
    suggestion:
      "联系接入方确认客户端版本和参数格式，如能恢复正确参数则修正后重试，否则标记为失败并通知接入方修复。",
  },
};
