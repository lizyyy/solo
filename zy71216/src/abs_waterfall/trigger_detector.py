"""触发事件检测模块"""

from datetime import date
from typing import List, Dict, Tuple
from decimal import Decimal

from .models import (
    DealStructure,
    TriggerEvent,
    TriggerStatus,
    TriggerEventType,
    AssetStatus,
    TrancheType,
    DefaultRecord,
)


class TriggerDetector:
    """触发事件检测器"""

    def __init__(self, deal: DealStructure, test_date: date):
        self.deal = deal
        self.test_date = test_date

    def _calculate_default_rate(self) -> float:
        """计算违约率"""
        total_assets = sum(a.current_balance for a in self.deal.assets)
        if total_assets == 0:
            return 0.0
        defaulted_balance = sum(
            a.current_balance for a in self.deal.assets
            if a.status in [AssetStatus.DEFAULTED, AssetStatus.WRITTEN_OFF]
        )
        return defaulted_balance / total_assets

    def _calculate_delinquency_rate(self, days: int = 30) -> float:
        """计算逾期率"""
        total_assets = sum(a.current_balance for a in self.deal.assets)
        if total_assets == 0:
            return 0.0
        delinquent_balance = sum(
            a.current_balance for a in self.deal.assets
            if a.status == AssetStatus.DELINQUENT
        )
        return delinquent_balance / total_assets

    def _calculate_coverage_ratio(self) -> float:
        """计算覆盖率（DSCR）"""
        total_debt_service = 0.0
        for tranche in self.deal.tranches:
            if tranche.tranche_type in [TrancheType.SENIOR, TrancheType.MEZZANINE]:
                interest = tranche.current_balance * tranche.coupon_rate / 12
                principal = tranche.current_balance * 0.02
                total_debt_service += interest + principal

        if total_debt_service == 0:
            return float('inf')

        total_collections = sum(
            cf.amount for cf in self.deal.cashflows
            if (self.test_date.replace(day=1) <= cf.payment_date <= self.test_date)
            and cf.payment_type in ["principal", "interest", "principal_and_interest"]
        )

        return total_collections / total_debt_service if total_debt_service > 0 else float('inf')

    def _calculate_overcollateralization_ratio(self) -> float:
        """计算超额抵押率（OC Ratio）"""
        total_tranche_balance = sum(t.current_balance for t in self.deal.tranches)
        if total_tranche_balance == 0:
            return float('inf')

        total_asset_balance = sum(a.current_balance for a in self.deal.assets)
        reserve = self.deal.reserve_account_balance

        return (total_asset_balance + reserve) / total_tranche_balance

    def _calculate_cumulative_losses(self) -> float:
        """计算累计损失率"""
        total_original_balance = sum(a.original_balance for a in self.deal.assets)
        if total_original_balance == 0:
            return 0.0

        total_write_offs = sum(d.write_off_amount for d in self.deal.default_records)
        return total_write_offs / total_original_balance

    def _calculate_recovery_rate(self) -> float:
        """计算回收率"""
        total_default_amount = sum(d.original_default_amount for d in self.deal.default_records)
        if total_default_amount == 0:
            return 1.0

        total_recovery = sum(d.recovery_amount for d in self.deal.default_records)
        return total_recovery / total_default_amount

    def _evaluate_trigger(self, trigger: TriggerEvent) -> Tuple[float, bool]:
        """评估单个触发事件
        
        Returns:
            (实际值, 是否触发)
        """
        actual_value = 0.0

        if trigger.event_type == TriggerEventType.DEFAULT:
            if trigger.test_formula == "default_rate":
                actual_value = self._calculate_default_rate()
            elif trigger.test_formula == "cumulative_losses":
                actual_value = self._calculate_cumulative_losses()
            elif trigger.test_formula == "delinquency_30_plus":
                actual_value = self._calculate_delinquency_rate(30)
            elif trigger.test_formula == "delinquency_60_plus":
                actual_value = self._calculate_delinquency_rate(60)
            elif trigger.test_formula == "delinquency_90_plus":
                actual_value = self._calculate_delinquency_rate(90)

        elif trigger.event_type == TriggerEventType.ACCELERATION:
            if trigger.test_formula == "dscr_below":
                actual_value = self._calculate_coverage_ratio()
            elif trigger.test_formula == "oc_ratio_below":
                actual_value = self._calculate_overcollateralization_ratio()
            elif trigger.test_formula == "recovery_rate_below":
                actual_value = self._calculate_recovery_rate()

        elif trigger.event_type == TriggerEventType.CASH_TRAP:
            if trigger.test_formula == "dscr_below":
                actual_value = self._calculate_coverage_ratio()
            elif trigger.test_formula == "default_rate_above":
                actual_value = self._calculate_default_rate()

        elif trigger.event_type == TriggerEventType.STEPDOWN:
            if trigger.test_formula == "oc_ratio_above":
                actual_value = self._calculate_overcollateralization_ratio()
            elif trigger.test_formula == "dscr_above":
                actual_value = self._calculate_coverage_ratio()

        elif trigger.event_type == TriggerEventType.REINVESTMENT:
            if trigger.test_formula == "reinvestment_period":
                actual_value = 1.0

        if trigger.test_formula.endswith("_above") or trigger.test_formula.endswith("_rate") or trigger.test_formula.endswith("_losses"):
            is_triggered = actual_value > trigger.threshold
        else:
            is_triggered = actual_value < trigger.threshold

        return round(actual_value, 6), is_triggered

    def run_tests(self) -> List[TriggerEvent]:
        """运行所有触发事件测试"""
        results = []

        for trigger in self.deal.trigger_events:
            if trigger.status == TriggerStatus.WAIVED:
                trigger.actual_value = 0.0
                trigger.test_date = self.test_date
                results.append(trigger)
                continue

            actual_value, is_triggered = self._evaluate_trigger(trigger)
            trigger.actual_value = actual_value
            trigger.test_date = self.test_date

            if is_triggered:
                if trigger.status == TriggerStatus.NOT_TRIGGERED:
                    trigger.status = TriggerStatus.TRIGGERED
                elif trigger.status == TriggerStatus.TRIGGERED:
                    pass
            else:
                if trigger.status == TriggerStatus.TRIGGERED and trigger.cure_period > 0:
                    trigger.cure_period -= 1
                    if trigger.cure_period == 0:
                        trigger.status = TriggerStatus.CURED
                else:
                    trigger.status = TriggerStatus.NOT_TRIGGERED

            results.append(trigger.model_copy())

        return results
