from datetime import datetime
from typing import List, Optional, Callable
from .models import RecoveryStatus, RecoveryCheck, ReroutePlan, ParentConfirmation, ConfirmationStatus
from .rules_engine import RulesEngine


class RecoveryStateMachine:
    TRANSITIONS = {
        RecoveryStatus.PENDING: [RecoveryStatus.IN_PROGRESS, RecoveryStatus.CANCELLED],
        RecoveryStatus.IN_PROGRESS: [RecoveryStatus.VERIFIED, RecoveryStatus.FAILED, RecoveryStatus.CANCELLED],
        RecoveryStatus.VERIFIED: [],
        RecoveryStatus.FAILED: [RecoveryStatus.IN_PROGRESS, RecoveryStatus.CANCELLED],
        RecoveryStatus.CANCELLED: []
    }

    def __init__(self, rules_engine: RulesEngine):
        self.rules_engine = rules_engine

    def can_transition(self, current: RecoveryStatus, next_status: RecoveryStatus) -> bool:
        return next_status in self.TRANSITIONS.get(current, [])

    def transition(self, check: RecoveryCheck, next_status: RecoveryStatus, 
                   checked_by: str = "", notes: str = "") -> bool:
        if not self.can_transition(check.status, next_status):
            return False
        
        check.status = next_status
        check.checked_at = datetime.now()
        check.checked_by = checked_by
        
        if notes:
            if check.resolution_notes:
                check.resolution_notes += "\n" + notes
            else:
                check.resolution_notes = notes
        
        return True

    def start_check(self, check: RecoveryCheck, checked_by: str = "") -> bool:
        return self.transition(check, RecoveryStatus.IN_PROGRESS, checked_by, "开始排查")

    def verify_recovery(self, check: RecoveryCheck, checked_by: str = "", notes: str = "") -> bool:
        return self.transition(check, RecoveryStatus.VERIFIED, checked_by, notes or "恢复验证通过")

    def mark_failed(self, check: RecoveryCheck, checked_by: str = "", issues: List[str] = None) -> bool:
        if issues:
            check.issues_found = issues
        notes = "恢复失败: " + ", ".join(issues) if issues else "恢复失败"
        return self.transition(check, RecoveryStatus.FAILED, checked_by, notes)

    def cancel_check(self, check: RecoveryCheck, checked_by: str = "", reason: str = "") -> bool:
        notes = "取消原因: " + reason if reason else "已取消"
        return self.transition(check, RecoveryStatus.CANCELLED, checked_by, notes)

    def retry_check(self, check: RecoveryCheck, checked_by: str = "") -> bool:
        if check.status == RecoveryStatus.FAILED:
            check.issues_found = []
            return self.transition(check, RecoveryStatus.IN_PROGRESS, checked_by, "重新开始排查")
        return False

    def assess_recovery_readiness(self, reroute: ReroutePlan, 
                                   confirmations: List[ParentConfirmation]) -> dict:
        unique_confs, duplicates = self.rules_engine.deduplicate_confirmations(confirmations)
        
        total_expected = len(set(c.student_id for c in confirmations if c.reroute_id == reroute.reroute_id))
        confirmed = sum(1 for c in unique_confs if c.reroute_id == reroute.reroute_id and c.status == ConfirmationStatus.CONFIRMED)
        pending = sum(1 for c in unique_confs if c.reroute_id == reroute.reroute_id and c.status == ConfirmationStatus.PENDING)
        rejected = sum(1 for c in unique_confs if c.reroute_id == reroute.reroute_id and c.status == ConfirmationStatus.REJECTED)
        
        stop_mismatches = sum(1 for c in unique_confs if c.original_stop_id and not c.new_stop_id)
        
        readiness_score = 100
        issues = []
        
        if duplicates:
            readiness_score -= 10 * len(duplicates)
            issues.append(f"存在 {len(duplicates)} 条重复回执")
        
        if pending > 0:
            readiness_score -= 5 * pending
            issues.append(f"还有 {pending} 名学生待确认")
        
        if stop_mismatches > 0:
            readiness_score -= 20
            issues.append(f"有 {stop_mismatches} 条回执缺少站点替换")
        
        if rejected > 0:
            readiness_score -= 15 * rejected
            issues.append(f"有 {rejected} 名家长拒绝改线")
        
        readiness_score = max(0, readiness_score)
        
        return {
            "readiness_score": readiness_score,
            "total_expected": total_expected,
            "confirmed": confirmed,
            "pending": pending,
            "rejected": rejected,
            "duplicates": len(duplicates),
            "stop_mismatches": stop_mismatches,
            "issues": issues,
            "can_recover": readiness_score >= 80
        }
