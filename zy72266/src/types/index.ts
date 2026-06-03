export type RecordStatus =
  | "pending_review"
  | "confirmed_normal"
  | "confirmed_anomaly"
  | "pending_field_review"
  | "corrected"
  | "rolled_back";

export type ZAxisDirection = "positive" | "negative" | "missing";

export type AuditAction =
  | "import"
  | "review_confirm_normal"
  | "review_confirm_anomaly"
  | "mark_pending_field_review"
  | "field_confirm_correct"
  | "field_confirm_no_change"
  | "rollback"
  | "manual_correction";

export type OperatorRole = "instructor" | "field_team";

export type ZAxisRuleCode = "ZR-001" | "ZR-002" | "ZR-003";

export interface SafetyRadiusRecord {
  id: string;
  originalRowNumber: number;
  gateOpening: number;
  safetyRadius: number;
  zAxisValue: number | null;
  zAxisDirection: ZAxisDirection;
  coordinateOrigin: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  recordId: string;
  action: AuditAction;
  operator: string;
  operatorRole: OperatorRole;
  previousStatus: RecordStatus;
  newStatus: RecordStatus;
  detail: string;
  timestamp: string;
}

export interface ZAxisDetectionResult {
  id: string;
  recordId: string;
  ruleCode: ZAxisRuleCode;
  detectionResult: string;
  suggestedAction: string;
  autoCorrectSuppressed: boolean;
}

export interface RollbackSnapshot {
  recordId: string;
  previousStatus: RecordStatus;
  snapshot: SafetyRadiusRecord;
  timestamp: string;
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  pending_review: "待复核",
  confirmed_normal: "已确认正常",
  confirmed_anomaly: "已确认异常",
  pending_field_review: "待现场复核",
  corrected: "已更正",
  rolled_back: "已回滚",
};

export const ACTION_LABELS: Record<AuditAction, string> = {
  import: "导入",
  review_confirm_normal: "教官确认正常",
  review_confirm_anomaly: "教官确认异常",
  mark_pending_field_review: "标记待现场复核",
  field_confirm_correct: "班组确认更正",
  field_confirm_no_change: "班组确认无需更正",
  rollback: "回滚",
  manual_correction: "手动更正",
};

export const RULE_LABELS: Record<ZAxisRuleCode, string> = {
  "ZR-001": "Z轴正方向数值为负（按旧习惯写反）",
  "ZR-002": "Z轴正方向数值为正（符合规范）",
  "ZR-003": "Z轴数值缺失",
};
