from typing import Dict, Any, Callable
from .models import SettlementRecord, SettlementStatus, ProcessingStep


class BoundaryRules:
    ZERO_AMOUNT_REVERSAL_KEYWORDS = ["已冲正", "冲正", "reversed", "reverse"]
    EVIDENCE_PRIORITY = {
        "tax_rate_remark": 2,
        "ex_date_screenshot": 1,
    }

    @staticmethod
    def is_zero_amount_with_reversal(record: SettlementRecord) -> bool:
        if abs(record.amount) > 1e-9:
            return False
        remark_lower = record.remark.lower()
        return any(
            keyword.lower() in remark_lower
            for keyword in BoundaryRules.ZERO_AMOUNT_REVERSAL_KEYWORDS
        )

    @staticmethod
    def should_escalate_to_risk(record: SettlementRecord) -> bool:
        return record.has_zero_amount_with_reversal and record.risk_review_required

    @staticmethod
    def determine_next_step(
        record: SettlementRecord, current_action: str
    ) -> ProcessingStep:
        step_order = [
            ProcessingStep.STEP_1_IMPORT,
            ProcessingStep.STEP_2_TAX_REVIEW,
            ProcessingStep.STEP_3_SUMMARY,
        ]
        current_idx = step_order.index(record.current_step)
        if current_action == "advance":
            if BoundaryRules.should_escalate_to_risk(record):
                return record.current_step
            if current_idx < len(step_order) - 1:
                return step_order[current_idx + 1]
        return record.current_step

    @staticmethod
    def can_edit_tax_rate(record: SettlementRecord) -> bool:
        return record.current_step in [
            ProcessingStep.STEP_1_IMPORT,
            ProcessingStep.STEP_2_TAX_REVIEW,
        ]

    @staticmethod
    def can_approve(record: SettlementRecord, operator_role: str) -> bool:
        if operator_role == "risk":
            return record.status == SettlementStatus.PENDING_RISK_REVIEW
        if operator_role == "operator":
            return not record.risk_review_required
        return False

    @staticmethod
    def resolve_evidence_conflict(
        ex_date_value: Any, tax_remark_value: Any
    ) -> Dict[str, Any]:
        ex_priority = BoundaryRules.EVIDENCE_PRIORITY["ex_date_screenshot"]
        tax_priority = BoundaryRules.EVIDENCE_PRIORITY["tax_rate_remark"]
        if tax_priority > ex_priority:
            return {
                "winner": "tax_rate_remark",
                "value": tax_remark_value,
                "confidence": "high",
                "note": "税费率备注优先级高于除权日截图",
            }
        return {
            "winner": "ex_date_screenshot",
            "value": ex_date_value,
            "confidence": "high",
            "note": "除权日截图优先级低于税费率备注",
        }

    @staticmethod
    def get_reversal_conditions() -> Dict[str, Callable]:
        return {
            "zero_amount_with_reversal_remark": BoundaryRules.is_zero_amount_with_reversal,
            "manual_flag": lambda r: r.metadata.get("manual_reversal", False),
        }

    @staticmethod
    def get_rollback_requirements(record: SettlementRecord) -> Dict[str, Any]:
        return {
            "can_rollback": record.status != SettlementStatus.REVERSED,
            "required_approvals": ["risk"] if record.risk_review_required else ["operator"],
            "fields_to_restore": [
                "amount",
                "status",
                "current_step",
                "is_reversed",
            ],
        }
