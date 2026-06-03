from typing import List, Optional, Dict, Any
from dataclasses import asdict

from models import (
    ConflictEvidence,
    ConflictResolution,
    HolidayExtension,
    TailAdjustment,
    DiscrepancyStatus,
    MatchStatus,
    FundMatchRecord,
)
from repository import MatchRepository


class ConflictDetector:
    def __init__(self, repository: Optional[MatchRepository] = None):
        self.repo = repository or MatchRepository()

    def detect_conflicts(self, business_nos: Optional[List[str]] = None) -> List[ConflictEvidence]:
        if business_nos is None:
            business_nos = self._get_all_business_nos()

        conflicts = []
        for business_no in business_nos:
            evidence = self.detect_conflict_for_business(business_no)
            if evidence:
                conflicts.append(evidence)
                self.repo.add_conflict_evidence(evidence)
                self._mark_records_as_conflict(business_no)

        return conflicts

    def detect_conflict_for_business(self, business_no: str) -> Optional[ConflictEvidence]:
        holiday = self.repo.get_holiday_extension_by_business_no(business_no)
        tail_adj = self.repo.get_tail_adjustment_by_business_no(business_no)

        if not holiday or not tail_adj:
            return None

        if not holiday.is_active or not tail_adj.is_active:
            return None

        holiday_amount = self._calculate_amount_from_holiday(holiday)
        tail_amount = self._calculate_amount_from_tail(tail_adj)

        if abs(holiday_amount - tail_amount) < 0.001:
            return None

        difference = abs(holiday_amount - tail_amount)
        description = (
            f"业务号 {business_no} 存在规则冲突："
            f"节假日顺延说明结论金额 {holiday_amount:.2f} 与尾差调整条计算金额 "
            f"{tail_amount:.2f} 不一致，差异 {difference:.2f} 元。"
        )

        return ConflictEvidence(
            business_no=business_no,
            holiday_conclusion=holiday.conclusion,
            tail_adjustment_rule=tail_adj.calculation_rule,
            holiday_amount=holiday_amount,
            tail_adjustment_amount=tail_amount,
            difference=difference,
            description=description,
            holiday_source=f"节假日顺延说明 [{holiday.extension_id}]，导入批次：{holiday.import_batch}",
            tail_adjustment_source=f"尾差调整条 [{tail_adj.adjustment_id}]，导入批次：{tail_adj.import_batch}",
        )

    def present_conflict_for_decision(self, business_no: str) -> Optional[Dict[str, Any]]:
        evidence = self.repo.get_conflict_evidence(business_no)
        if not evidence:
            return None

        return {
            "business_no": business_no,
            "description": evidence.description,
            "conflict_evidence": [
                {
                    "source": "节假日顺延说明",
                    "source_detail": evidence.holiday_source,
                    "conclusion": evidence.holiday_conclusion,
                    "calculated_amount": evidence.holiday_amount,
                },
                {
                    "source": "尾差调整条",
                    "source_detail": evidence.tail_adjustment_source,
                    "conclusion": evidence.tail_adjustment_rule,
                    "calculated_amount": evidence.tail_adjustment_amount,
                },
            ],
            "difference": evidence.difference,
            "available_actions": [
                {"action": "confirm_holiday", "description": "确认采用节假日顺延说明结论"},
                {"action": "confirm_tail", "description": "确认采用尾差调整条结论"},
                {"action": "reject_both", "description": "驳回两者，需要业务重新提供"},
            ],
            "warning": "请投研助理小周手动选择确认或驳回，系统不会自动采用节假日顺延说明结论。",
        }

    def resolve_conflict(
        self,
        business_no: str,
        action: str,
        operator: str,
        reason: str,
    ) -> Optional[ConflictResolution]:
        evidence = self.repo.get_conflict_evidence(business_no)
        if not evidence:
            return None

        if action == "confirm_holiday":
            resolution = ConflictResolution(
                business_no=business_no,
                resolution=DiscrepancyStatus.CONFIRMED,
                chosen_rule="holiday_extension",
                final_amount=evidence.holiday_amount,
                operator=operator,
                reason=reason,
            )
            self._apply_resolution(business_no, evidence.holiday_amount, "holiday")
        elif action == "confirm_tail":
            resolution = ConflictResolution(
                business_no=business_no,
                resolution=DiscrepancyStatus.CONFIRMED,
                chosen_rule="tail_adjustment",
                final_amount=evidence.tail_adjustment_amount,
                operator=operator,
                reason=reason,
            )
            self._apply_resolution(business_no, evidence.tail_adjustment_amount, "tail")
        elif action == "reject_both":
            resolution = ConflictResolution(
                business_no=business_no,
                resolution=DiscrepancyStatus.REJECTED,
                chosen_rule=None,
                final_amount=None,
                operator=operator,
                reason=reason,
            )
            self._apply_resolution(business_no, None, "rejected")
        else:
            raise ValueError(f"无效的操作: {action}")

        from datetime import datetime
        resolution.resolved_at = datetime.now()
        self.repo.add_conflict_resolution(resolution)
        return resolution

    def _get_all_business_nos(self) -> List[str]:
        holiday_nos = {e.business_no for e in self.repo.get_all_holiday_extensions() if e.is_active}
        tail_nos = {a.business_no for a in self.repo.get_all_tail_adjustments() if a.is_active}
        return list(holiday_nos & tail_nos)

    def _calculate_amount_from_holiday(self, holiday: HolidayExtension) -> float:
        records = self.repo.get_records_by_business_no(holiday.business_no)
        if not records:
            return 0.0

        base_amount = sum(r.expected_amount for r in records)
        return base_amount * (1 + holiday.extension_days * 0.001)

    def _calculate_amount_from_tail(self, tail_adj: TailAdjustment) -> float:
        records = self.repo.get_records_by_business_no(tail_adj.business_no)
        if not records:
            return 0.0

        base_amount = sum(r.expected_amount for r in records)
        return base_amount + tail_adj.adjustment_amount

    def _mark_records_as_conflict(self, business_no: str) -> None:
        records = self.repo.get_records_by_business_no(business_no)
        for record in records:
            if record.status != MatchStatus.PENDING_REVIEW:
                record.status = MatchStatus.CONFLICT
                record.updated_at = __import__("datetime").datetime.now()
                record.updated_by = "conflict_detector"

    def _apply_resolution(self, business_no: str, final_amount: Optional[float], rule_type: str) -> None:
        records = self.repo.get_records_by_business_no(business_no)
        for record in records:
            if final_amount is not None and records:
                total_expected = sum(r.expected_amount for r in records)
                if total_expected > 0:
                    ratio = record.expected_amount / total_expected
                    record.matched_amount = final_amount * ratio

            if rule_type == "holiday":
                record.holiday_extension_applied = True
                record.tail_adjustment_applied = False
            elif rule_type == "tail":
                record.tail_adjustment_applied = True
                record.holiday_extension_applied = False
            else:
                record.holiday_extension_applied = False
                record.tail_adjustment_applied = False

            record.status = MatchStatus.DISCREPANCY if rule_type == "rejected" else MatchStatus.MATCHED
            record.updated_at = __import__("datetime").datetime.now()
            record.updated_by = "conflict_resolution"
