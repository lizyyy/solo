from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Protocol

from .models import (
    ChangeType,
    RemarkStatus,
    SettlementType,
    TaxRateRemark,
)


class BoundaryAction(str, Enum):
    ALLOW = "allow"
    FLAG_FOR_REVIEW = "flag_for_review"
    BLOCK = "block"
    ROLLBACK = "rollback"


@dataclass
class BoundaryResult:
    action: BoundaryAction
    reason: str
    rule_id: str
    detail: str = ""

    def to_dict(self) -> dict:
        return {
            "action": self.action.value,
            "reason": self.reason,
            "rule_id": self.rule_id,
            "detail": self.detail,
        }


class BoundaryRule(Protocol):
    rule_id: str
    description: str

    def evaluate(
        self, remark: TaxRateRemark, proposed_settlement: SettlementType
    ) -> BoundaryResult: ...


class SettlementShiftRule:
    rule_id = "SETTLEMENT_SHIFT_001"
    description = "结算周期从短周期改为长周期（如T+1→T+2）需要基金经理复核"

    SETTLEMENT_ORDER = {
        SettlementType.T_PLUS_0: 0,
        SettlementType.T_PLUS_1: 1,
        SettlementType.T_PLUS_2: 2,
        SettlementType.T_PLUS_3: 3,
    }

    def evaluate(
        self, remark: TaxRateRemark, proposed_settlement: SettlementType
    ) -> BoundaryResult:
        current_order = self.SETTLEMENT_ORDER.get(remark.settlement_type, -1)
        proposed_order = self.SETTLEMENT_ORDER.get(proposed_settlement, -1)
        if proposed_order > current_order:
            return BoundaryResult(
                action=BoundaryAction.FLAG_FOR_REVIEW,
                reason=f"结算周期从 {remark.settlement_type.value} 延长至 {proposed_settlement.value}，需基金经理复核",
                rule_id=self.rule_id,
                detail=(
                    f"原始结算类型: {remark.original_settlement_type.value}, "
                    f"当前结算类型: {remark.settlement_type.value}, "
                    f"提议结算类型: {proposed_settlement.value}"
                ),
            )
        if proposed_order < current_order:
            return BoundaryResult(
                action=BoundaryAction.ALLOW,
                reason=f"结算周期从 {remark.settlement_type.value} 缩短至 {proposed_settlement.value}，允许自动处理",
                rule_id=self.rule_id,
            )
        return BoundaryResult(
            action=BoundaryAction.ALLOW,
            reason="结算周期未变更",
            rule_id=self.rule_id,
        )


class OriginalSettlementDeviationRule:
    rule_id = "ORIGINAL_DEVIATION_002"
    description = "任何偏离原始结算类型的改动都需要记录，偏离超过一级需标记"

    SETTLEMENT_ORDER = {
        SettlementType.T_PLUS_0: 0,
        SettlementType.T_PLUS_1: 1,
        SettlementType.T_PLUS_2: 2,
        SettlementType.T_PLUS_3: 3,
    }

    def evaluate(
        self, remark: TaxRateRemark, proposed_settlement: SettlementType
    ) -> BoundaryResult:
        original_order = self.SETTLEMENT_ORDER.get(remark.original_settlement_type, -1)
        proposed_order = self.SETTLEMENT_ORDER.get(proposed_settlement, -1)
        deviation = abs(proposed_order - original_order)
        if deviation == 0:
            return BoundaryResult(
                action=BoundaryAction.ALLOW,
                reason="与原始结算类型一致，无偏差",
                rule_id=self.rule_id,
            )
        if deviation == 1:
            return BoundaryResult(
                action=BoundaryAction.FLAG_FOR_REVIEW,
                reason=f"偏离原始结算类型一级（原始:{remark.original_settlement_type.value} → 提议:{proposed_settlement.value}），需记录并复核",
                rule_id=self.rule_id,
            )
        return BoundaryResult(
            action=BoundaryAction.BLOCK,
            reason=f"偏离原始结算类型超过一级（偏差={deviation}），禁止自动修改，必须基金经理书面确认",
            rule_id=self.rule_id,
        )


class AlreadyFlaggedRule:
    rule_id = "ALREADY_FLAGGED_003"
    description = "已被标记待基金经理复核的备注，不允许继续自动修改"

    def evaluate(
        self, remark: TaxRateRemark, proposed_settlement: SettlementType
    ) -> BoundaryResult:
        if remark.flagged_for_manager:
            return BoundaryResult(
                action=BoundaryAction.BLOCK,
                reason="该备注已被标记待基金经理复核，不允许继续自动修改",
                rule_id=self.rule_id,
            )
        return BoundaryResult(
            action=BoundaryAction.ALLOW,
            reason="未被标记，可继续评估",
            rule_id=self.rule_id,
        )


class BoundaryRuleEngine:
    def __init__(self):
        self.rules: list[BoundaryRule] = [
            AlreadyFlaggedRule(),
            SettlementShiftRule(),
            OriginalSettlementDeviationRule(),
        ]

    def evaluate_settlement_change(
        self, remark: TaxRateRemark, proposed_settlement: SettlementType
    ) -> list[BoundaryResult]:
        results = []
        for rule in self.rules:
            result = rule.evaluate(remark, proposed_settlement)
            results.append(result)
            if result.action == BoundaryAction.BLOCK:
                break
        return results

    def can_apply_change(self, results: list[BoundaryResult]) -> bool:
        for r in results:
            if r.action in (BoundaryAction.BLOCK, BoundaryAction.FLAG_FOR_REVIEW):
                return False
        return True

    def needs_manager_review(self, results: list[BoundaryResult]) -> bool:
        return any(r.action == BoundaryAction.FLAG_FOR_REVIEW for r in results)

    def is_blocked(self, results: list[BoundaryResult]) -> bool:
        return any(r.action == BoundaryAction.BLOCK for r in results)

    def apply_settlement_change(
        self,
        remark: TaxRateRemark,
        proposed_settlement: SettlementType,
        operator: str = "",
        reason: str = "",
    ) -> tuple[bool, list[BoundaryResult]]:
        results = self.evaluate_settlement_change(remark, proposed_settlement)

        if self.is_blocked(results):
            return False, results

        if self.needs_manager_review(results):
            remark.settlement_type = proposed_settlement
            remark.flagged_for_manager = True
            remark.flag_reason = "; ".join(
                r.reason for r in results if r.action == BoundaryAction.FLAG_FOR_REVIEW
            )
            remark.status = RemarkStatus.FLAGGED_FOR_MANAGER
            remark.record_change(
                change_type=ChangeType.MANUAL_EDIT,
                operator=operator,
                reason=reason or remark.flag_reason,
                settlement_override=True,
            )
            return False, results

        remark.settlement_type = proposed_settlement
        remark.record_change(
            change_type=ChangeType.MANUAL_EDIT,
            operator=operator,
            reason=reason,
        )
        return True, results

    def rollback_settlement(
        self,
        remark: TaxRateRemark,
        operator: str = "",
        reason: str = "",
    ) -> bool:
        if remark.settlement_type == remark.original_settlement_type:
            return False
        old_settlement = remark.settlement_type
        remark.settlement_type = remark.original_settlement_type
        remark.flagged_for_manager = False
        remark.flag_reason = ""
        remark.status = RemarkStatus.PENDING_REVIEW
        remark.record_change(
            change_type=ChangeType.ROLLBACK,
            operator=operator,
            reason=reason or f"回滚结算类型: {old_settlement.value} → {remark.original_settlement_type.value}",
            settlement_override=True,
        )
        return True
