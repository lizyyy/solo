import copy
from datetime import datetime
from typing import Dict, List, Optional

from .models import (
    ImputationResult,
    ReviewDecision,
    RecordStatus,
    AuditEntry,
    ProcessingSuggestion,
)


class Reviewer:
    def __init__(self, audit_log: Optional[List[AuditEntry]] = None, run_id: str = ""):
        self.audit_log = audit_log if audit_log is not None else []
        self.run_id = run_id

    def _log(self, record_id: str, action: str, details: Dict):
        self.audit_log.append(
            AuditEntry(
                run_id=self.run_id,
                record_id=record_id,
                action=action,
                actor="Reviewer",
                details=details,
                timestamp=datetime.now().isoformat(),
            )
        )

    def auto_review(self, result: ImputationResult) -> ImputationResult:
        if result.status == RecordStatus.REWORK:
            self._log(result.record_id, "auto_review_skip", {"reason": "rework_needed"})
            return result

        low_confidence_fields = [
            e for e in result.evidences if e.confidence < 0.5
        ]
        if low_confidence_fields:
            result.status = RecordStatus.REWORK
            result.suggestions.append(
                ProcessingSuggestion(
                    record_id=result.record_id,
                    field_name=",".join(e.field_name for e in low_confidence_fields),
                    suggestion_text=(
                        f"以下字段置信度过低需人工确认: "
                        f"{', '.join(e.field_name for e in low_confidence_fields)}。"
                        f"请对照原始数据源逐一核实，确认后可标记为通过"
                    ),
                    action_type="auto_flag_low_confidence",
                    priority="high",
                )
            )
            self._log(result.record_id, "auto_flag", {
                "low_confidence_fields": [e.field_name for e in low_confidence_fields],
            })
        else:
            result.status = RecordStatus.REVIEWED
            self._log(result.record_id, "auto_review_pass", {
                "avg_confidence": sum(e.confidence for e in result.evidences) / len(result.evidences)
                if result.evidences else 1.0,
            })

        return result

    def manual_review(
        self,
        result: ImputationResult,
        decision: ReviewDecision,
    ) -> ImputationResult:
        if decision.decision == "approve":
            result.status = RecordStatus.APPROVED
            for field_name, value in decision.corrections.items():
                if hasattr(result.imputed_record, field_name):
                    setattr(result.imputed_record, field_name, value)
            self._log(result.record_id, "manual_approve", {
                "reviewer": decision.reviewer,
                "corrections": decision.corrections,
                "comment": decision.comment,
            })
        elif decision.decision == "reject":
            result.status = RecordStatus.REJECTED
            self._log(result.record_id, "manual_reject", {
                "reviewer": decision.reviewer,
                "comment": decision.comment,
            })
        elif decision.decision == "rework":
            result.status = RecordStatus.REWORK
            for field_name, value in decision.corrections.items():
                if hasattr(result.imputed_record, field_name):
                    setattr(result.imputed_record, field_name, value)
            result.suggestions.append(
                ProcessingSuggestion(
                    record_id=result.record_id,
                    field_name=",".join(decision.corrections.keys()) if decision.corrections else "ALL",
                    suggestion_text=(
                        f"人工复核要求返工。修正字段: {list(decision.corrections.keys())}。"
                        f"复核意见: {decision.comment}。请修正后重新提交修补流程"
                    ),
                    action_type="manual_rework",
                    priority="high",
                )
            )
            self._log(result.record_id, "manual_rework", {
                "reviewer": decision.reviewer,
                "corrections": decision.corrections,
                "comment": decision.comment,
            })

        return result

    def rework_and_reimpute(
        self,
        result: ImputationResult,
        corrections: Dict[str, any],
    ) -> ImputationResult:
        for field_name, value in corrections.items():
            if hasattr(result.imputed_record, field_name):
                setattr(result.imputed_record, field_name, value)

        still_missing = [
            k for k in ("timestamp", "road_segment", "congestion_level", "weather",
                       "temperature", "surface_condition", "traffic_volume")
            if getattr(result.imputed_record, k) is None
        ]

        if still_missing:
            result.status = RecordStatus.REWORK
            result.suggestions.append(
                ProcessingSuggestion(
                    record_id=result.record_id,
                    field_name=",".join(still_missing),
                    suggestion_text=f"返工后仍缺失: {', '.join(still_missing)}，请继续补全",
                    action_type="rework_incomplete",
                    priority="high",
                )
            )
            self._log(result.record_id, "rework_incomplete", {"still_missing": still_missing})
        else:
            result.status = RecordStatus.REVIEWED
            result.suggestions = [
                s for s in result.suggestions
                if s.action_type not in ("manual_rework", "rework_incomplete", "auto_flag_low_confidence")
            ]
            result.suggestions.append(
                ProcessingSuggestion(
                    record_id=result.record_id,
                    field_name="ALL",
                    suggestion_text="返工修正完成，已补全所有缺失字段，建议进入最终确认",
                    action_type="rework_complete",
                    priority="normal",
                )
            )
            self._log(result.record_id, "rework_complete", {"corrections_applied": list(corrections.keys())})

        result.processed_at = datetime.now().isoformat()
        return result
