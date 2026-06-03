import type {
  RecordStatus,
  AuditAction,
  AuditLog,
  RollbackSnapshot,
} from "@/types";

export const VALID_TRANSITIONS: Record<RecordStatus, AuditAction[]> = {
  pending_review: [
    "review_confirm_normal",
    "review_confirm_anomaly",
  ],
  confirmed_normal: ["rollback"],
  confirmed_anomaly: ["mark_pending_field_review"],
  pending_field_review: [
    "field_confirm_correct",
    "field_confirm_no_change",
  ],
  corrected: ["rollback"],
  rolled_back: [],
};

export function getNextStatus(
  currentStatus: RecordStatus,
  action: AuditAction
): RecordStatus | null {
  const transitions: Partial<Record<`${RecordStatus}-${AuditAction}`, RecordStatus>> = {
    "pending_review-review_confirm_normal": "confirmed_normal",
    "pending_review-review_confirm_anomaly": "confirmed_anomaly",
    "confirmed_anomaly-mark_pending_field_review": "pending_field_review",
    "pending_field_review-field_confirm_correct": "corrected",
    "pending_field_review-field_confirm_no_change": "confirmed_normal",
    "confirmed_normal-rollback": "rolled_back",
    "corrected-rollback": "rolled_back",
  };
  return transitions[`${currentStatus}-${action}`] ?? null;
}

export function validateTransition(
  currentStatus: RecordStatus,
  action: AuditAction
): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(action) ?? false;
}

export function createAuditLog(
  recordId: string,
  action: AuditAction,
  operator: string,
  operatorRole: "instructor" | "field_team",
  previousStatus: RecordStatus,
  newStatus: RecordStatus,
  detail: string
): AuditLog {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    recordId,
    action,
    operator,
    operatorRole,
    previousStatus,
    newStatus,
    detail,
    timestamp: new Date().toISOString(),
  };
}

export function createRollbackSnapshot(
  recordId: string,
  previousStatus: RecordStatus,
  snapshot: RollbackSnapshot["snapshot"]
): RollbackSnapshot {
  return {
    recordId,
    previousStatus,
    snapshot: { ...snapshot },
    timestamp: new Date().toISOString(),
  };
}
