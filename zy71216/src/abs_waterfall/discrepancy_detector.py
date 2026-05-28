"""差错检测模块 - 识别现金流分配中的常见错误"""

from datetime import date
from typing import List, Dict, Optional, Tuple
from decimal import Decimal
import uuid

from .models import (
    DealStructure,
    WaterfallResult,
    Discrepancy,
    DiscrepancyType,
    PaymentAllocation,
    FeePayment,
    TriggerEvent,
    TriggerStatus,
    AllocationReportSample,
    TrancheType,
    PaymentType,
    CashFlowRecord,
)


class DiscrepancyDetector:
    """差错检测器 - 识别ABS现金流分配中的常见错误"""

    def __init__(self, deal: DealStructure, waterfall_result: WaterfallResult):
        self.deal = deal
        self.result = waterfall_result
        self.discrepancies: List[Discrepancy] = []

    def _create_discrepancy(
        self,
        dtype: DiscrepancyType,
        severity: str,
        description: str,
        affected: List[str],
        explanation: str,
        expected: Optional[float] = None,
        actual: Optional[float] = None,
        tranche: Optional[str] = None,
        asset: Optional[str] = None,
    ) -> Discrepancy:
        return Discrepancy(
            discrepancy_id=f"DIS-{uuid.uuid4().hex[:8].upper()}",
            discrepancy_type=dtype,
            severity=severity,
            description=description,
            affected_records=affected,
            expected_value=expected,
            actual_value=actual,
            related_tranche=tranche,
            related_asset=asset,
            explanation=explanation,
        )

    def check_recovery_wrong_tranche(self) -> List[Discrepancy]:
        """检查违约回款是否分配到错误的分层
        
        常见错误：违约回款应该先用于弥补优先级债券的短缺，
        但经常被错误地直接分配给次级或权益层。
        """
        issues = []
        recovery_payments = [
            p for p in self.result.tranche_payments if p.is_from_recovery
        ]

        if not recovery_payments:
            return issues

        tranche_priority = {
            t.tranche_id: t.payment_priority for t in self.deal.tranches
        }

        recovery_amount = sum(p.paid_amount for p in recovery_payments)

        senior_shortfalls = {}
        for tranche in self.deal.tranches:
            if tranche.tranche_type in [TrancheType.SENIOR, TrancheType.MEZZANINE]:
                shortfall = sum(
                    p.shortfall_amount for p in self.result.tranche_payments
                    if p.tranche_id == tranche.tranche_id
                )
                if shortfall > 0:
                    senior_shortfalls[tranche.tranche_id] = shortfall

        for payment in recovery_payments:
            pay_tranche_priority = tranche_priority.get(payment.tranche_id, 999)

            if payment.tranche_id not in senior_shortfalls and senior_shortfalls:
                for senior_id, shortfall in senior_shortfalls.items():
                    if tranche_priority.get(senior_id, 999) < pay_tranche_priority and shortfall > 0:
                        issue = self._create_discrepancy(
                            dtype=DiscrepancyType.RECOVERY_WRONG_TRANCHE,
                            severity="CRITICAL",
                            description=f"违约回款错误分配至[{payment.tranche_name}]，优先级更高的分层存在未弥补短缺",
                            affected=[payment.tranche_id, senior_id],
                            expected=float(payment.paid_amount),
                            actual=float(payment.paid_amount),
                            tranche=payment.tranche_id,
                            explanation=(
                                f"检测到违约回款 ¥{payment.paid_amount:,.2f} 被分配给 "
                                f"{payment.tranche_name}(优先级 #{pay_tranche_priority})。"
                                f"但优先级更高的 {senior_id} 层仍存在短缺 ¥{shortfall:,.2f}。"
                                f"根据交易文件，违约回款应优先用于弥补优先级较高分层的短缺，"
                                f"在优先级短缺全部弥补前，次级/权益层不应获得违约回款分配。"
                            ),
                        )
                        issues.append(issue)
                        break

        return issues

    def check_duplicate_fee_deduction(self) -> List[Discrepancy]:
        """检查服务费是否重复扣除
        
        常见错误：同一笔服务费在 waterfall 中被多次扣除，
        或者既有按余额计提又有按回款计提的双重收费。
        """
        issues = []

        fee_payment_map: Dict[str, List[FeePayment]] = {}
        for fp in self.result.fee_payments:
            fee_payment_map.setdefault(fp.fee_id, []).append(fp)

        for fee_id, payments in fee_payment_map.items():
            if len(payments) > 1:
                total_paid = sum(p.paid_amount for p in payments)
                fee_name = payments[0].fee_name

                issue = self._create_discrepancy(
                    dtype=DiscrepancyType.DUPLICATE_FEE_DEDUCTION,
                    severity="HIGH",
                    description=f"服务费[{fee_name}]存在重复扣除记录（{len(payments)}次）",
                    affected=[p.fee_id for p in payments],
                    expected=float(sum(p.scheduled_amount for p in payments) / len(payments)),
                    actual=float(total_paid),
                    explanation=(
                        f"检测到服务费 {fee_name} 在本期现金流瀑布中被扣除了 {len(payments)} 次，"
                        f"累计扣除 ¥{total_paid:,.2f}。"
                        f"这可能是由于：1) 服务费同时按余额和回款双重计提；"
                        f"2) 前期服务费短缺结转时与当期应付重复计算；"
                        f"3) 支付优先级配置错误导致同一费用在多个节点被扣除。"
                        f"建议核对费用计算基数和支付优先级配置。"
                    ),
                )
                issues.append(issue)

        reported_groups = set()
        for fee in self.deal.servicing_fees:
            if not fee.is_flat_fee and fee.calculation_base == "collections":
                other_fees_same_base = [
                    f for f in self.deal.servicing_fees
                    if f.fee_id != fee.fee_id and f.calculation_base == "collections"
                ]
                if other_fees_same_base:
                    all_fees = sorted([fee.fee_id] + [f.fee_id for f in other_fees_same_base])
                    group_key = tuple(all_fees)
                    if group_key in reported_groups:
                        continue
                    reported_groups.add(group_key)

                    total_rate = fee.rate + sum(f.rate for f in other_fees_same_base)
                    if total_rate > 0.02:
                        issue = self._create_discrepancy(
                            dtype=DiscrepancyType.DUPLICATE_FEE_DEDUCTION,
                            severity="MEDIUM",
                            description=f"多项服务费按同一基数计提，总费率{total_rate*100:.1f}%偏高",
                            affected=list(all_fees),
                            expected=0.02,
                            actual=float(total_rate),
                            explanation=(
                                f"检测到 {len(all_fees)} 项服务费均按回款基数计提，"
                                f"综合费率达到 {total_rate*100:.1f}%。"
                                f"请确认是否存在服务范围重叠导致的重复收费，"
                                f"例如：服务商管理费与特殊服务商费是否应合并计提。"
                            ),
                        )
                        issues.append(issue)

        return issues

    def check_trigger_events_missed(self) -> List[Discrepancy]:
        """检查触发事件是否漏判
        
        常见错误：触发事件测试指标已达标但未标记为触发，
        导致现金流瀑布未能切换到加速清偿模式。
        """
        issues = []

        reported_triggers = {
            t.event_id: t for t in self.result.trigger_results
        }

        actual_should_trigger = []
        for trigger in self.deal.trigger_events:
            reported = reported_triggers.get(trigger.event_id)
            if reported is None:
                continue

            if reported.actual_value > reported.threshold and reported.status == TriggerStatus.NOT_TRIGGERED:
                if reported.test_formula.endswith("_above") or reported.test_formula.endswith("_rate") or reported.test_formula.endswith("_losses"):
                    actual_should_trigger.append((trigger, reported))
            elif reported.actual_value < reported.threshold and reported.status == TriggerStatus.NOT_TRIGGERED:
                if not (reported.test_formula.endswith("_above") or reported.test_formula.endswith("_rate") or reported.test_formula.endswith("_losses")):
                    actual_should_trigger.append((trigger, reported))

        for trigger, reported in actual_should_trigger:
            issue = self._create_discrepancy(
                dtype=DiscrepancyType.TRIGGER_EVENT_MISSED,
                severity="CRITICAL",
                description=f"触发事件[{trigger.event_name}]指标已达标但未标记为触发",
                affected=[trigger.event_id],
                expected=float(reported.threshold),
                actual=float(reported.actual_value),
                explanation=(
                    f"触发事件 {trigger.event_name} 测试结果为 {reported.actual_value*100:.2f}%，"
                    f"触发阈值为 {reported.threshold*100:.2f}%，"
                    f"已{'超过' if reported.actual_value > reported.threshold else '低于'}触发标准，"
                    f"但当前状态标记为【未触发】。"
                    f"这将导致现金流瀑布未能正确切换到"
                    f"{'加速清偿' if trigger.event_type in ['acceleration', 'default'] else '现金流截留'}模式，"
                    f"可能严重损害优先级投资者利益。"
                    f"请立即检查触发事件的计算公式和判断逻辑。"
                ),
            )
            issues.append(issue)

        for trigger in self.result.trigger_results:
            if trigger.status == TriggerStatus.TRIGGERED:
                has_acceleration_effect = False
                for payment in self.result.tranche_payments:
                    tranche = next(
                        (t for t in self.deal.tranches if t.tranche_id == payment.tranche_id),
                        None
                    )
                    if tranche and tranche.tranche_type == TrancheType.SENIOR:
                        if payment.payment_type == PaymentType.PRINCIPAL:
                            scheduled_principal = tranche.current_balance * 0.02
                            if payment.scheduled_amount > scheduled_principal * 1.5:
                                has_acceleration_effect = True
                                break

                if trigger.event_type in ["acceleration", "default"] and not has_acceleration_effect:
                    issue = self._create_discrepancy(
                        dtype=DiscrepancyType.TRIGGER_EVENT_MISSED,
                        severity="HIGH",
                        description=f"加速清偿事件已触发但现金流分配未切换模式",
                        affected=[trigger.event_id],
                        explanation=(
                            f"{trigger.event_name} 已标记为触发状态，"
                            f"但检测到优先级本金支付仍按正常摊还计划（约2%）执行，"
                            f"未进入加速清偿模式（全额本金分配）。"
                            f"根据交易文件第6.2(a)条，加速清偿事件触发后，"
                            f"所有可用现金流应优先用于偿还优先级债券本金，"
                            f"直至其全额清偿完毕。"
                            f"请检查 waterfall 引擎的事件响应逻辑。"
                        ),
                    )
                    issues.append(issue)

        return issues

    def check_cashflow_not_allocated(self) -> List[Discrepancy]:
        """检查现金流是否存在未完全分配的情况"""
        issues = []

        total_inflow = Decimal(str(self.result.total_cash_inflow))
        total_outflow = Decimal(str(self.result.total_cash_outflow))
        beginning = Decimal(str(self.result.beginning_collection_balance))
        ending = Decimal(str(self.result.ending_collection_balance))

        expected_ending = beginning + total_inflow - total_outflow
        difference = abs(ending - expected_ending)

        if difference > Decimal('0.01'):
            raw_total = sum(Decimal(str(cf.amount)) for cf in self.result.raw_cashflows_used)
            issue = self._create_discrepancy(
                dtype=DiscrepancyType.CASHFLOW_NOT_ALLOCATED,
                severity="HIGH",
                description="现金流分配存在尾差，部分资金去向不明",
                affected=[cf.record_id for cf in self.result.raw_cashflows_used],
                expected=float(expected_ending),
                actual=float(ending),
                explanation=(
                    f"现金流平衡校验失败。"
                    f"期初余额 ¥{beginning:,.2f} + 本期流入 ¥{total_inflow:,.2f} "
                    f"- 本期分配 ¥{total_outflow:,.2f} = 理论期末余额 ¥{expected_ending:,.2f}，"
                    f"但实际期末余额为 ¥{ending:,.2f}，"
                    f"差异 ¥{difference:,.2f}。"
                    f"原始回款记录合计 ¥{raw_total:,.2f}，"
                    f"请逐一核对每笔现金流的分配路径，确认是否存在："
                    f"1) 回款记录重复入账；2) 分配时四舍五入误差累积；"
                    f"3) 某笔现金流未经过 waterfall 分配直接转出。"
                ),
            )
            issues.append(issue)

        allocated_record_ids = set()
        for payment in self.result.tranche_payments:
            if payment.source_account == "recovery" and payment.is_from_recovery:
                recovery_cfs = [
                    cf.record_id for cf in self.result.raw_cashflows_used
                    if cf.is_recovery or cf.payment_type == PaymentType.RECOVERY
                ]
                allocated_record_ids.update(recovery_cfs)

        for cf in self.result.raw_cashflows_used:
            if cf.is_recovery and cf.record_id not in allocated_record_ids:
                shortfalls_exist = any(
                    p.shortfall_amount > 0 for p in self.result.tranche_payments
                )
                if shortfalls_exist:
                    issue = self._create_discrepancy(
                        dtype=DiscrepancyType.CASHFLOW_NOT_ALLOCATED,
                        severity="MEDIUM",
                        description=f"违约回款[{cf.record_id}]未用于弥补债券短缺",
                        affected=[cf.record_id],
                        expected=float(cf.amount),
                        actual=0.0,
                        asset=cf.asset_id,
                        explanation=(
                            f"违约资产 {cf.asset_id} 的回款 ¥{cf.amount:,.2f} (记录ID: {cf.record_id}) "
                            f"已到账但未用于弥补任何分层的支付短缺。"
                            f"在仍有分层存在支付短缺的情况下，违约回款应按优先级顺序用于弥补短缺，"
                            f"请检查违约回款的分配逻辑。"
                        ),
                    )
                    issues.append(issue)

        return issues

    def check_wrong_priority_order(self) -> List[Discrepancy]:
        """检查支付优先级顺序是否错误"""
        issues = []

        all_payments = []
        for fp in self.result.fee_payments:
            fee = next((f for f in self.deal.servicing_fees if f.fee_id == fp.fee_id), None)
            if fee:
                all_payments.append(("fee", fee.payment_priority, fp))

        for tp in self.result.tranche_payments:
            tranche = next((t for t in self.deal.tranches if t.tranche_id == tp.tranche_id), None)
            if tranche:
                all_payments.append(("tranche", tranche.payment_priority, tp))

        all_payments.sort(key=lambda x: x[1])

        actual_payment_order = []
        remaining_cash = (
            Decimal(str(self.result.beginning_collection_balance)) +
            Decimal(str(self.result.total_cash_inflow))
        )

        for ptype, priority, payment in all_payments:
            paid_amount = Decimal(str(payment.paid_amount))
            scheduled_amount = Decimal(str(payment.scheduled_amount))

            if paid_amount > 0 and remaining_cash < paid_amount:
                name = payment.fee_name if ptype == "fee" else payment.tranche_name
                issue = self._create_discrepancy(
                    dtype=DiscrepancyType.WRONG_PRIORITY_ORDER,
                    severity="HIGH",
                    description=f"支付顺序异常：[{name}]在现金流不足时仍获得足额支付",
                    affected=[payment.fee_id if ptype == "fee" else payment.tranche_id],
                    expected=float(min(remaining_cash, scheduled_amount)),
                    actual=float(paid_amount),
                    tranche=payment.tranche_id if ptype == "tranche" else None,
                    explanation=(
                        f"检测到支付顺序异常。在支付 {name}(优先级 #{priority}) 时，"
                        f"可用现金流仅剩 ¥{remaining_cash:,.2f}，"
                        f"但实际支付了 ¥{paid_amount:,.2f}。"
                        f"这表明可能存在：1) 优先级配置错误；"
                        f"2) 跳过了优先级更高但存在短缺的支付项；"
                        f"3) 使用了未入账的表外资金进行支付。"
                        f"请核对交易文件第5条的现金流瀑布顺序条款。"
                    ),
                )
                issues.append(issue)

            remaining_cash -= paid_amount

        for i in range(len(all_payments) - 1):
            ptype1, priority1, payment1 = all_payments[i]
            ptype2, priority2, payment2 = all_payments[i + 1]

            if priority1 > priority2:
                name1 = payment1.fee_name if ptype1 == "fee" else payment1.tranche_name
                name2 = payment2.fee_name if ptype2 == "fee" else payment2.tranche_name

                issue = self._create_discrepancy(
                    dtype=DiscrepancyType.WRONG_PRIORITY_ORDER,
                    severity="CRITICAL",
                    description=f"支付优先级顺序错误：[{name2}]应先于[{name1}]支付",
                    affected=[
                        payment1.fee_id if ptype1 == "fee" else payment1.tranche_id,
                        payment2.fee_id if ptype2 == "fee" else payment2.tranche_id,
                    ],
                    explanation=(
                        f"检测到支付顺序违反交易文件约定。"
                        f"{name2} 的优先级为 #{priority2}，"
                        f"{name1} 的优先级为 #{priority1}，"
                        f"但在实际分配中 {name1} 先于 {name2} 获得支付。"
                        f"根据交易文件第5.1条，支付应严格按照优先级编号从小到大执行。"
                        f"此错误可能导致优先级较低的债券获得超额分配，"
                        f"损害优先级较高债券持有人的利益。"
                    ),
                )
                issues.append(issue)

        return issues

    def check_shortfall_not_carried(self) -> List[Discrepancy]:
        """检查支付短缺是否正确结转至下一期"""
        issues = []

        for tranche in self.deal.tranches:
            if not tranche.is_shortfall_carry:
                continue

            shortfalls = [
                p for p in self.result.tranche_payments
                if p.tranche_id == tranche.tranche_id and p.shortfall_amount > 0
            ]

            for shortfall in shortfalls:
                if shortfall.carried_shortfall <= 0:
                    issue = self._create_discrepancy(
                        dtype=DiscrepancyType.SHORTFALL_NOT_CARRIED,
                        severity="HIGH",
                        description=f"[{tranche.tranche_name}]的{shortfall.payment_type.value}短缺未结转至下一期",
                        affected=[tranche.tranche_id],
                        expected=float(shortfall.shortfall_amount),
                        actual=0.0,
                        tranche=tranche.tranche_id,
                        explanation=(
                            f"{tranche.tranche_name} 本期{shortfall.payment_type.value}应付"
                            f"¥{shortfall.scheduled_amount:,.2f}，实付"
                            f"¥{shortfall.paid_amount:,.2f}，短缺"
                            f"¥{shortfall.shortfall_amount:,.2f}。"
                            f"根据该分层条款，短缺金额应结转至后续支付期，"
                            f"在后续现金流充足时优先偿付。"
                            f"当前短缺结转金额为 ¥0.00，属于明显计算错误。"
                        ),
                    )
                    issues.append(issue)

        for fee in self.deal.servicing_fees:
            fee_payments = [
                fp for fp in self.result.fee_payments if fp.fee_id == fee.fee_id
            ]
            for fp in fee_payments:
                if fp.shortfall_amount > 0 and fp.carried_shortfall <= 0:
                    if fee.payment_priority <= 2:
                        issue = self._create_discrepancy(
                            dtype=DiscrepancyType.SHORTFALL_NOT_CARRIED,
                            severity="MEDIUM",
                            description=f"服务费[{fp.fee_name}]的短缺未结转",
                            affected=[fee.fee_id],
                            expected=float(fp.shortfall_amount),
                            actual=0.0,
                            explanation=(
                                f"服务费 {fp.fee_name} 本期应付 ¥{fp.scheduled_amount:,.2f}，"
                                f"实付 ¥{fp.paid_amount:,.2f}，短缺 ¥{fp.shortfall_amount:,.2f}。"
                                f"根据服务协议，优先支付的服务费短缺应累计至下期支付，"
                                f"请检查费用短缺的结转逻辑。"
                            ),
                        )
                        issues.append(issue)

        return issues

    def check_balance_mismatch(self) -> List[Discrepancy]:
        """检查余额是否匹配"""
        issues = []

        original_balances = self.result.original_values_preserved.get("tranche_balances", {})

        for tranche in self.deal.tranches:
            original_balance = Decimal(str(original_balances.get(tranche.tranche_id, 0)))
            current_balance = Decimal(str(tranche.current_balance))

            principal_payments = sum(
                Decimal(str(p.paid_amount)) for p in self.result.tranche_payments
                if p.tranche_id == tranche.tranche_id and p.payment_type == PaymentType.PRINCIPAL
            )

            expected_balance = original_balance - principal_payments
            difference = abs(current_balance - expected_balance)

            if difference > Decimal('0.01'):
                issue = self._create_discrepancy(
                    dtype=DiscrepancyType.BALANCE_MISMATCH,
                    severity="HIGH",
                    description=f"[{tranche.tranche_name}]期末余额与本金支付不匹配",
                    affected=[tranche.tranche_id],
                    expected=float(expected_balance),
                    actual=float(current_balance),
                    tranche=tranche.tranche_id,
                    explanation=(
                        f"{tranche.tranche_name} 期初余额 ¥{original_balance:,.2f}，"
                        f"本期本金支付 ¥{principal_payments:,.2f}，"
                        f"理论期末余额应为 ¥{expected_balance:,.2f}，"
                        f"但系统记录的期末余额为 ¥{current_balance:,.2f}，"
                        f"差异 ¥{difference:,.2f}。"
                        f"可能原因：1) 本金支付记录重复或遗漏；"
                        f"2) 违约资产核销未正确调减余额；"
                        f"3) 短期fallback调整未入账。"
                        f"请逐一核对该分层的余额变动明细。"
                    ),
                )
                issues.append(issue)

        return issues

    def check_sample_variance(self) -> List[Discrepancy]:
        """检查分配报告样本的差异"""
        issues = []

        for sample in self.deal.allocation_samples:
            actual_amount = 0.0
            for payment in self.result.tranche_payments:
                if (payment.tranche_id == sample.tranche_id and
                    payment.payment_type == sample.expected_payment_type):
                    actual_amount += payment.paid_amount

            variance = actual_amount - sample.expected_amount
            variance_pct = (variance / sample.expected_amount * 100) if sample.expected_amount > 0 else 0

            sample.actual_amount = actual_amount
            sample.variance = variance
            sample.is_matched = abs(variance) <= sample.expected_amount * 0.005

            if not sample.is_matched:
                tranche = next(
                    (t for t in self.deal.tranches if t.tranche_id == sample.tranche_id),
                    None
                )
                tranche_name = tranche.tranche_name if tranche else sample.tranche_id

                issue = self._create_discrepancy(
                    dtype=DiscrepancyType.SAMPLE_VARIANCE_EXCEEDED,
                    severity="MEDIUM" if abs(variance_pct) < 5 else "HIGH",
                    description=f"抽样核对不通过：[{tranche_name}]的{sample.expected_payment_type.value}差异{variance_pct:.1f}%",
                    affected=[sample.sample_id, sample.tranche_id],
                    expected=float(sample.expected_amount),
                    actual=float(actual_amount),
                    tranche=sample.tranche_id,
                    explanation=(
                        f"分配报告抽样核对失败。样本 {sample.sample_id}："
                        f"{tranche_name} 的 {sample.expected_payment_type.value} "
                        f"预期金额 ¥{sample.expected_amount:,.2f}，"
                        f"实际计算金额 ¥{actual_amount:,.2f}，"
                        f"差异 ¥{variance:,.2f} ({variance_pct:.1f}%)。"
                        f"差异超过±0.5%的可接受阈值。"
                        f"请检查：1) 分层余额是否正确；2) 利率计算是否准确；"
                        f"3) 应计天数是否正确；4) 四舍五入规则是否一致。"
                    ),
                )
                issues.append(issue)

        return issues

    def run_all_checks(self) -> List[Discrepancy]:
        """运行所有差错检测"""
        self.discrepancies = []

        checks = [
            self.check_recovery_wrong_tranche,
            self.check_duplicate_fee_deduction,
            self.check_trigger_events_missed,
            self.check_cashflow_not_allocated,
            self.check_wrong_priority_order,
            self.check_shortfall_not_carried,
            self.check_balance_mismatch,
            self.check_sample_variance,
        ]

        for check in checks:
            issues = check()
            self.discrepancies.extend(issues)

        return self.discrepancies
