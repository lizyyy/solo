from datetime import datetime
from typing import Dict, List, Optional

from ..models.models import (
    ArtifactGrade,
    Discrepancy,
    DiscrepancyType,
    ReconciliationRecord,
    ReconciliationStatus,
    ReviewDecision,
    ReviewStatus,
)


class ReviewManager:
    def __init__(self):
        self.review_log: List[dict] = []

    def can_approve(self, record: ReconciliationRecord) -> tuple:
        if not record.has_discrepancies:
            return True, "无差异，可直接放行"

        critical_count = sum(1 for d in record.discrepancies if d.severity == "critical")
        if critical_count > 0:
            return False, f"存在{critical_count}项严重差异，需详细审核后决定"

        if record.artifact_grade in (ArtifactGrade.FIRST_CLASS, ArtifactGrade.SECOND_CLASS):
            if len(record.discrepancies) >= 2:
                return False, f"{record.artifact_grade.value}存在多项差异，需提交审批"

        return True, "差异项较少且无严重问题，可复核后放行"

    def get_review_guidance(self, record: ReconciliationRecord) -> dict:
        guidance = {
            "can_approve": False,
            "approval_reason": "",
            "risk_level": "low",
            "required_documents": [],
            "suggested_action": ReviewStatus.PENDING.value,
            "explanations": [],
        }

        if not record.has_discrepancies:
            guidance["can_approve"] = True
            guidance["approval_reason"] = "无任何差异，建议直接放行"
            guidance["suggested_action"] = ReviewStatus.APPROVED.value
            return guidance

        critical_discs = [d for d in record.discrepancies if d.severity == "critical"]
        normal_discs = [d for d in record.discrepancies if d.severity == "normal"]

        if critical_discs:
            guidance["risk_level"] = "high"
            guidance["can_approve"] = False
            guidance["approval_reason"] = f"存在{len(critical_discs)}项严重差异，不能直接放行"
            guidance["required_documents"].append("差异情况说明")
            guidance["suggested_action"] = ReviewStatus.NEEDS_SUPPLEMENT.value

            for disc in critical_discs:
                if disc.discrepancy_type in (DiscrepancyType.VALUATION_CHANGE, DiscrepancyType.INSURANCE_MISMATCH):
                    guidance["required_documents"].append("估值依据材料")
                if disc.discrepancy_type == DiscrepancyType.TRANSPORT_NODE_MISSING:
                    guidance["required_documents"].append("运输确认函")
                if disc.discrepancy_type in (DiscrepancyType.TEMPERATURE_ABNORMAL, DiscrepancyType.HUMIDITY_ABNORMAL):
                    guidance["required_documents"].append("文物状态检查报告")
        elif normal_discs:
            guidance["risk_level"] = "medium"
            guidance["approval_reason"] = f"存在{len(normal_discs)}项一般差异"

            if record.artifact_grade in (ArtifactGrade.FIRST_CLASS, ArtifactGrade.SECOND_CLASS):
                guidance["required_documents"].append("差异确认说明")
                guidance["suggested_action"] = ReviewStatus.NEEDS_SUPPLEMENT.value
            else:
                guidance["can_approve"] = True
                guidance["suggested_action"] = ReviewStatus.APPROVED.value

        for disc in record.discrepancies:
            guidance["explanations"].append({
                "type": disc.discrepancy_type.value,
                "field": disc.field_name,
                "description": disc.description,
                "explanation": disc.explanation,
                "severity": disc.severity,
            })

        return guidance

    def make_decision(
        self,
        record: ReconciliationRecord,
        decision: str,
        reviewer: str,
        comments: str = "",
        required_actions: str = "",
        manual_fix_fields: Optional[List[str]] = None,
    ) -> ReconciliationRecord:
        decision_enum = ReviewStatus(decision)
        requires_manual = decision_enum == ReviewStatus.NEEDS_SUPPLEMENT

        record.review_decision = ReviewDecision(
            artifact_id=record.artifact_id,
            decision=decision_enum,
            reviewer=reviewer,
            review_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            comments=comments,
            required_actions=required_actions,
            requires_manual_fix=requires_manual,
            manual_fix_fields=manual_fix_fields or [],
        )

        if decision_enum in (ReviewStatus.APPROVED, ReviewStatus.REJECTED):
            record.status = ReconciliationStatus.RESOLVED
            for disc in record.discrepancies:
                disc.resolved = True
                disc.resolution_note = comments
        elif decision_enum == ReviewStatus.NEEDS_SUPPLEMENT:
            record.status = ReconciliationStatus.NEEDS_REVIEW
            for disc in record.discrepancies:
                if disc.field_name in (manual_fix_fields or []):
                    disc.resolved = False
                    disc.resolution_note = required_actions

        record.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        self.review_log.append({
            "artifact_id": record.artifact_id,
            "artifact_name": record.artifact_name,
            "decision": decision_enum.value,
            "reviewer": reviewer,
            "review_time": record.review_decision.review_time,
            "comments": comments,
            "required_actions": required_actions,
            "manual_fix_fields": manual_fix_fields or [],
        })

        return record

    def correct_artifact_field(
        self,
        record: ReconciliationRecord,
        field: str,
        value,
        reviewer: str,
        reason: str,
    ) -> ReconciliationRecord:
        if field == "valuation" and record.artifact:
            record.artifact.current_valuation = float(value)
        elif field == "insured_amount" and record.insurance:
            record.insurance.insured_amount = float(value)
        elif field == "transport_end_date" and record.transport:
            record.transport.actual_end_date = str(value)
        elif field == "condition" and record.artifact:
            record.artifact.condition = str(value)
        elif field == "previous_valuation" and record.artifact:
            record.artifact.previous_valuation = float(value)
        else:
            raise ValueError(f"不支持修改的字段: {field}")

        for disc in record.discrepancies:
            if field in disc.field_name or disc.field_name in field:
                disc.resolved = True
                disc.resolution_note = f"{reviewer}修正: {reason}"

        record.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        return record

    def get_review_history(self) -> List[dict]:
        return self.review_log

    def get_pending_reviews(self, records: Dict[str, ReconciliationRecord]) -> List[dict]:
        pending = []
        for artifact_id, record in records.items():
            if record.status in (ReconciliationStatus.NEEDS_REVIEW, ReconciliationStatus.EXCEPTION):
                pending.append({
                    "artifact_id": record.artifact_id,
                    "artifact_name": record.artifact_name,
                    "grade": record.artifact_grade.value if record.artifact_grade else "未分级",
                    "status": record.status.value,
                    "discrepancy_count": len(record.discrepancies),
                    "critical_count": sum(1 for d in record.discrepancies if d.severity == "critical"),
                    "discrepancy_types": list(set(d.discrepancy_type.value for d in record.discrepancies)),
                })
        return sorted(pending, key=lambda x: x["critical_count"], reverse=True)