from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
import math

from .models import (
    QueryPlan,
    PlanComparison,
    RiskLevel,
    ConfirmStatus,
    RegressionConclusion
)
from .normalizer import ParameterNormalizer


@dataclass
class Difference:
    field: str
    old_value: Any
    new_value: Any
    change_percent: float = 0.0


class RuleEngine:
    HIGH_RISK_SCAN_TYPES = {'Seq Scan', 'Sequential Scan', '全表扫描'}
    LOW_RISK_SCAN_TYPES = {'Index Scan', 'Index Only Scan', 'Bitmap Scan', '索引扫描'}

    def __init__(self):
        self.normalizer = ParameterNormalizer()

    def compare_plans(
        self,
        old_plans: List[QueryPlan],
        new_plans: List[QueryPlan]
    ) -> Tuple[List[PlanComparison], List[Tuple[QueryPlan, str]]]:
        old_plan_map = self._build_plan_map(old_plans)
        new_plan_map = self._build_plan_map(new_plans)

        comparisons = []
        unmatched = []

        all_keys = sorted(set(old_plan_map.keys()) | set(new_plan_map.keys()))

        for key in all_keys:
            if key in old_plan_map and key in new_plan_map:
                old_plan = old_plan_map[key]
                new_plan = new_plan_map[key]
                comparison = self._compare_single_pair(old_plan, new_plan)
                comparisons.append(comparison)
            elif key in old_plan_map:
                unmatched.append((old_plan_map[key], "ONLY_IN_OLD"))
            else:
                unmatched.append((new_plan_map[key], "ONLY_IN_NEW"))

        comparisons.sort(key=lambda c: (
            self._risk_priority(c.risk_level),
            c.query_template,
            c.parameter_set_normalized
        ))

        return comparisons, unmatched

    def _build_plan_map(self, plans: List[QueryPlan]) -> Dict[str, QueryPlan]:
        plan_map = {}
        for plan in plans:
            param_sig, _ = self.normalizer.normalize_parameter_set(plan.parameter_set)
            query_sig = self.normalizer.generate_query_signature(plan.query_template, param_sig)
            plan_map[query_sig] = plan
        return plan_map

    def _compare_single_pair(self, old_plan: QueryPlan, new_plan: QueryPlan) -> PlanComparison:
        param_sig, _ = self.normalizer.normalize_parameter_set(old_plan.parameter_set)
        differences = self._extract_differences(old_plan, new_plan)
        risk_level = self._calculate_risk(differences, old_plan, new_plan)
        conclusion = self._derive_conclusion(risk_level, differences)

        return PlanComparison(
            query_template=old_plan.query_template,
            parameter_set_normalized=param_sig,
            old_plan=old_plan,
            new_plan=new_plan,
            differences=differences,
            risk_level=risk_level,
            confirm_status=ConfirmStatus.PENDING,
            conclusion=conclusion
        )

    def _extract_differences(self, old_plan: QueryPlan, new_plan: QueryPlan) -> Dict[str, Any]:
        differences = {}

        if old_plan.summary.scan_type != new_plan.summary.scan_type:
            differences['scan_type'] = Difference(
                field='scan_type',
                old_value=old_plan.summary.scan_type,
                new_value=new_plan.summary.scan_type
            )

        if old_plan.summary.join_type != new_plan.summary.join_type:
            differences['join_type'] = Difference(
                field='join_type',
                old_value=old_plan.summary.join_type,
                new_value=new_plan.summary.join_type
            )

        if old_plan.summary.estimated_rows != new_plan.summary.estimated_rows:
            change_pct = self._calculate_change_percent(
                old_plan.summary.estimated_rows,
                new_plan.summary.estimated_rows
            )
            differences['estimated_rows'] = Difference(
                field='estimated_rows',
                old_value=old_plan.summary.estimated_rows,
                new_value=new_plan.summary.estimated_rows,
                change_percent=change_pct
            )

        if not math.isclose(old_plan.summary.estimated_cost, new_plan.summary.estimated_cost):
            change_pct = self._calculate_change_percent(
                old_plan.summary.estimated_cost,
                new_plan.summary.estimated_cost
            )
            differences['estimated_cost'] = Difference(
                field='estimated_cost',
                old_value=old_plan.summary.estimated_cost,
                new_value=new_plan.summary.estimated_cost,
                change_percent=change_pct
            )

        old_indexes = set(old_plan.summary.used_indexes)
        new_indexes = set(new_plan.summary.used_indexes)
        if old_indexes != new_indexes:
            differences['used_indexes'] = Difference(
                field='used_indexes',
                old_value=sorted(old_indexes),
                new_value=sorted(new_indexes)
            )

        return differences

    def _calculate_change_percent(self, old_val: float, new_val: float) -> float:
        if old_val == 0:
            return float('inf') if new_val > 0 else 0.0
        return ((new_val - old_val) / abs(old_val)) * 100

    def _calculate_risk(self, differences: Dict[str, Any], old_plan: QueryPlan, new_plan: QueryPlan) -> RiskLevel:
        if not differences:
            return RiskLevel.NONE

        risk_score = 0

        if 'scan_type' in differences:
            old_scan = differences['scan_type'].old_value
            new_scan = differences['scan_type'].new_value

            if new_scan in self.HIGH_RISK_SCAN_TYPES and old_scan in self.LOW_RISK_SCAN_TYPES:
                risk_score += 100
            elif new_scan in self.HIGH_RISK_SCAN_TYPES and old_scan not in self.HIGH_RISK_SCAN_TYPES:
                risk_score += 75
            elif old_scan in self.HIGH_RISK_SCAN_TYPES and new_scan in self.LOW_RISK_SCAN_TYPES:
                risk_score -= 50

        if 'used_indexes' in differences:
            old_indexes = set(differences['used_indexes'].old_value)
            new_indexes = set(differences['used_indexes'].new_value)
            lost_indexes = old_indexes - new_indexes
            if lost_indexes:
                risk_score += 50 * len(lost_indexes)

        if 'estimated_cost' in differences:
            cost_diff = differences['estimated_cost']
            if cost_diff.change_percent >= 500:
                risk_score += 60
            elif cost_diff.change_percent >= 200:
                risk_score += 40
            elif cost_diff.change_percent >= 100:
                risk_score += 20
            elif cost_diff.change_percent <= -50:
                risk_score -= 20

        if 'estimated_rows' in differences:
            rows_diff = differences['estimated_rows']
            if rows_diff.change_percent >= 1000:
                risk_score += 30
            elif rows_diff.change_percent >= 500:
                risk_score += 15

        if risk_score >= 100:
            return RiskLevel.CRITICAL
        elif risk_score >= 75:
            return RiskLevel.HIGH
        elif risk_score >= 30:
            return RiskLevel.MEDIUM
        elif risk_score >= 10:
            return RiskLevel.LOW
        else:
            return RiskLevel.NONE

    def _derive_conclusion(self, risk_level: RiskLevel, differences: Dict[str, Any]) -> RegressionConclusion:
        if risk_level in (RiskLevel.CRITICAL, RiskLevel.HIGH):
            return RegressionConclusion.REGRESSED
        elif risk_level in (RiskLevel.MEDIUM, RiskLevel.LOW):
            return RegressionConclusion.NEED_INVESTIGATION
        else:
            return RegressionConclusion.NOT_REGRESSED

    def _risk_priority(self, risk_level: RiskLevel) -> int:
        priority_map = {
            RiskLevel.CRITICAL: 0,
            RiskLevel.HIGH: 1,
            RiskLevel.MEDIUM: 2,
            RiskLevel.LOW: 3,
            RiskLevel.NONE: 4
        }
        return priority_map.get(risk_level, 99)

    def update_confirmation(self, comparison: PlanComparison, status: ConfirmStatus, reviewer: str = "") -> PlanComparison:
        comparison.confirm_status = status
        if status == ConfirmStatus.CONFIRMED:
            comparison.conclusion = RegressionConclusion.REGRESSED
        elif status == ConfirmStatus.REJECTED:
            comparison.conclusion = RegressionConclusion.FALSE_POSITIVE

        if reviewer:
            comparison.review_by = reviewer

        return comparison
