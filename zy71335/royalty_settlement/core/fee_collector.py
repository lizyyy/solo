from typing import List, Tuple, Dict
from ..models import PlatformFee, Issue, IssueCategory, IssueSeverity, FeePeriod
from datetime import date


class FeeCollector:
    def __init__(self, performance_date: date):
        self.performance_date = performance_date
        self.issues: List[Issue] = []
        self.fee_breakdown: Dict[str, float] = {}
        self.current_period_fees: List[PlatformFee] = []
        self.cross_period_fees: List[PlatformFee] = []

    def collect(self, fees: List[PlatformFee]) -> Tuple[List[PlatformFee], List[Issue], Dict[str, float]]:
        self.issues = []
        self.fee_breakdown = {}
        self.current_period_fees = []
        self.cross_period_fees = []

        for fee in fees:
            self._process_fee(fee)

        total_fees = self.current_period_fees + self.cross_period_fees
        return total_fees, self.issues, self.fee_breakdown

    def _process_fee(self, fee: PlatformFee):
        if fee.period == FeePeriod.CROSS:
            self._handle_cross_period_fee(fee)
        elif fee.period == FeePeriod.CURRENT:
            self._add_to_breakdown(fee.fee_type, fee.amount)
            self.current_period_fees.append(fee)
        elif fee.period == FeePeriod.PREVIOUS:
            self._add_to_breakdown(f"{fee.fee_type}(上期结转)", fee.amount)
            self.current_period_fees.append(fee)
            self.issues.append(Issue(
                category=IssueCategory.CROSS_PERIOD_FEE,
                severity=IssueSeverity.WARNING,
                message=f"扣费[{fee.fee_type}]属于上期，已计入本期结算",
                reason="上期结转扣费",
                affected_items=[fee.fee_type],
                impact=f"本期扣除{fee.amount:.2f}元，将影响本期可分配收入",
                next_steps=[
                    "确认上期结转扣费的来源",
                    "核对上期结算记录",
                    "如需调整请更正后重新计算"
                ]
            ))
        elif fee.period == FeePeriod.NEXT:
            self.issues.append(Issue(
                category=IssueCategory.CROSS_PERIOD_FEE,
                severity=IssueSeverity.INFO,
                message=f"扣费[{fee.fee_type}]属于下期，已从本期扣除",
                reason="预收下期扣费",
                affected_items=[fee.fee_type],
                impact=f"本期预扣{fee.amount:.2f}元，下期结算时需核对",
                next_steps=[
                    "记录预扣费用明细",
                    "下期结算时关联此扣费",
                    "确保不重复扣除"
                ]
            ))
            self._add_to_breakdown(f"{fee.fee_type}(预收下期)", fee.amount)
            self.current_period_fees.append(fee)

        if fee.deductions:
            for sub_fee in fee.deductions:
                self._process_fee(sub_fee)

    def _handle_cross_period_fee(self, fee: PlatformFee):
        if fee.period_start and fee.period_end:
            total_days = (fee.period_end - fee.period_start).days + 1
            if total_days <= 0:
                self.issues.append(Issue(
                    category=IssueCategory.CROSS_PERIOD_FEE,
                    severity=IssueSeverity.ERROR,
                    message=f"跨期扣费[{fee.fee_type}]起止日期无效",
                    reason="扣费周期结束日期早于或等于开始日期",
                    affected_items=[fee.fee_type],
                    impact="该扣费无法正确分摊，已全部计入本期",
                    next_steps=[
                        "检查并更正扣费周期",
                        "确认实际扣费所属期间",
                        "重新计算分摊比例"
                    ]
                ))
                self._add_to_breakdown(fee.fee_type, fee.amount)
                self.current_period_fees.append(fee)
                return

            perf_date = self.performance_date
            current_start = max(fee.period_start, perf_date.replace(day=1))
            current_end = min(fee.period_end, self._end_of_month(perf_date))
            current_days = (current_end - current_start).days + 1

            if current_days > 0:
                current_ratio = current_days / total_days
                current_amount = fee.amount * current_ratio
                other_amount = fee.amount - current_amount

                current_fee = PlatformFee(
                    fee_type=f"{fee.fee_type}(本期分摊)",
                    amount=current_amount,
                    period=FeePeriod.CURRENT,
                    notes=f"跨期分摊，原周期{fee.period_start}至{fee.period_end}"
                )
                self._add_to_breakdown(current_fee.fee_type, current_amount)
                self.current_period_fees.append(current_fee)

                if other_amount > 0:
                    cross_fee = PlatformFee(
                        fee_type=f"{fee.fee_type}(跨期余额)",
                        amount=other_amount,
                        period=FeePeriod.CROSS,
                        period_start=fee.period_start,
                        period_end=fee.period_end,
                        notes=f"跨期扣费余额{other_amount:.2f}元，待后续期间处理"
                    )
                    self.cross_period_fees.append(cross_fee)

                self.issues.append(Issue(
                    category=IssueCategory.CROSS_PERIOD_FEE,
                    severity=IssueSeverity.INFO,
                    message=f"跨期扣费[{fee.fee_type}]已按天数分摊",
                    reason=f"扣费周期{fee.period_start}至{fee.period_end}跨越多期，本期占比{current_ratio:.4f}",
                    affected_items=[fee.fee_type],
                    impact=f"本期分摊{current_amount:.2f}元，剩余{other_amount:.2f}元待后续处理",
                    next_steps=[
                        "核对分摊天数计算是否正确",
                        "跟踪跨期余额的后续处理",
                        "确认各期分摊比例"
                    ]
                ))
            else:
                self._add_to_breakdown(fee.fee_type, fee.amount)
                self.current_period_fees.append(fee)
        else:
            self._add_to_breakdown(fee.fee_type, fee.amount)
            self.current_period_fees.append(fee)

    def _add_to_breakdown(self, fee_type: str, amount: float):
        if fee_type in self.fee_breakdown:
            self.fee_breakdown[fee_type] += amount
        else:
            self.fee_breakdown[fee_type] = amount

    def _end_of_month(self, d: date) -> date:
        if d.month == 12:
            return date(d.year + 1, 1, 1)
        return date(d.year, d.month + 1, 1)
