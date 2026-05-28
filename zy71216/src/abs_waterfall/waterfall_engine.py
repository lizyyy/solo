"""现金流瀑布核心计算引擎"""

from datetime import date
from typing import List, Tuple, Dict, Optional
from decimal import Decimal, ROUND_HALF_UP
import uuid

from .models import (
    DealStructure,
    Tranche,
    ServicingFee,
    CashFlowRecord,
    PaymentAllocation,
    FeePayment,
    PaymentType,
    WaterfallResult,
    TrancheType,
    TriggerStatus,
)


class WaterfallEngine:
    """现金流瀑布计算引擎"""

    def __init__(self, deal: DealStructure, period_start: date, period_end: date):
        self.deal = deal
        self.period_start = period_start
        self.period_end = period_end
        self.available_cash = Decimal(str(deal.collection_account_balance))
        self.reserve_cash = Decimal(str(deal.reserve_account_balance))
        self.beginning_collection = Decimal(str(deal.collection_account_balance))
        self.beginning_reserve = Decimal(str(deal.reserve_account_balance))
        self.tranche_payments: List[PaymentAllocation] = []
        self.fee_payments: List[FeePayment] = []
        self.raw_cashflows_used: List[CashFlowRecord] = []
        self.original_values: Dict[str, any] = {}

    def _round(self, amount: Decimal) -> Decimal:
        return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def _preserve_original_values(self):
        """保存原始值用于后续排错"""
        self.original_values = {
            "beginning_collection_balance": float(self.beginning_collection),
            "beginning_reserve_balance": float(self.beginning_reserve),
            "reinvestment_balance": float(self.deal.reinvestment_account_balance),
            "tranche_balances": {
                t.tranche_id: float(t.current_balance) for t in self.deal.tranches
            },
            "fee_arrears": {
                f.fee_id: float(f.arrears) for f in self.deal.servicing_fees
            },
            "trigger_statuses": {
                e.event_id: e.status.value for e in self.deal.trigger_events
            },
        }

    def _collect_period_cashflows(self) -> Tuple[Decimal, Decimal, Decimal]:
        """收集本期待分配现金流
        
        Returns:
            (常规现金流, 违约回款, 其他收入)
        """
        regular_cf = Decimal('0')
        recovery_cf = Decimal('0')
        other_cf = Decimal('0')

        for cf in self.deal.cashflows:
            if self.period_start <= cf.payment_date <= self.period_end:
                amount = Decimal(str(cf.amount))
                self.raw_cashflows_used.append(cf)

                if cf.is_recovery or cf.payment_type == PaymentType.RECOVERY:
                    recovery_cf += amount
                elif cf.payment_type in [PaymentType.LATE_FEE]:
                    other_cf += amount
                else:
                    regular_cf += amount

        total = regular_cf + recovery_cf + other_cf
        self.available_cash += total

        return regular_cf, recovery_cf, other_cf

    def _calculate_fee_scheduled(self, fee: ServicingFee) -> Decimal:
        """计算服务费应付金额"""
        if fee.is_flat_fee and fee.flat_amount is not None:
            return Decimal(str(fee.flat_amount)) + Decimal(str(fee.arrears))

        base = Decimal('0')
        if fee.calculation_base == "total_assets":
            base = Decimal(str(sum(a.current_balance for a in self.deal.assets)))
        elif fee.calculation_base == "senior_balance":
            base = Decimal(str(sum(
                t.current_balance for t in self.deal.tranches 
                if t.tranche_type == TrancheType.SENIOR
            )))
        elif fee.calculation_base == "total_tranche_balance":
            base = Decimal(str(sum(t.current_balance for t in self.deal.tranches)))
        elif fee.calculation_base == "collections":
            base = Decimal(str(sum(
                cf.amount for cf in self.deal.cashflows
                if self.period_start <= cf.payment_date <= self.period_end
                and cf.payment_type in [PaymentType.PRINCIPAL, PaymentType.INTEREST, PaymentType.PRINCIPAL_AND_INTEREST]
            )))

        calculated = base * Decimal(str(fee.rate)) / Decimal('12')
        return calculated + Decimal(str(fee.arrears))

    def _calculate_tranche_scheduled(self, tranche: Tranche) -> Tuple[Decimal, Decimal]:
        """计算分层应付利息和本金
        
        Returns:
            (应付利息, 应付本金)
        """
        balance = Decimal(str(tranche.current_balance))
        interest = balance * Decimal(str(tranche.coupon_rate)) / Decimal('12')
        interest = self._round(interest)

        principal = Decimal('0')
        if tranche.payment_type in [PaymentType.PRINCIPAL, PaymentType.PRINCIPAL_AND_INTEREST]:
            principal = balance * Decimal('0.02')
            principal = self._round(principal)

        return interest, principal

    def _sort_by_priority(self, items: List) -> List:
        """按支付优先级排序"""
        return sorted(items, key=lambda x: x.payment_priority)

    def _pay_from_available(self, amount: Decimal) -> Tuple[Decimal, Decimal]:
        """从可用现金中支付，不足部分从储备金支取
        
        Returns:
            (实际支付金额, 短缺金额)
        """
        amount = self._round(amount)
        paid = min(amount, self.available_cash)
        self.available_cash -= paid
        shortfall = amount - paid

        if shortfall > 0 and self.reserve_cash > 0:
            from_reserve = min(shortfall, self.reserve_cash)
            self.reserve_cash -= from_reserve
            paid += from_reserve
            shortfall -= from_reserve

        return paid, shortfall

    def _process_fees(self, is_accelerated: bool = False):
        """处理服务费支付"""
        sorted_fees = self._sort_by_priority(self.deal.servicing_fees)

        for fee in sorted_fees:
            scheduled = self._calculate_fee_scheduled(fee)
            paid, shortfall = self._pay_from_available(scheduled)

            fee_payment = FeePayment(
                fee_id=fee.fee_id,
                fee_name=fee.fee_name,
                scheduled_amount=float(scheduled),
                paid_amount=float(paid),
                shortfall_amount=float(shortfall),
                carried_shortfall=float(shortfall) if fee.payment_priority <= 2 else 0,
                source_account="collection" if paid <= (self.beginning_collection + sum(
                    Decimal(str(cf.amount)) for cf in self.raw_cashflows_used
                )) else "reserve",
            )
            self.fee_payments.append(fee_payment)

            fee.arrears = float(shortfall) if fee.payment_priority <= 2 else 0.0

    def _process_tranches(self, is_accelerated: bool = False):
        """处理分层支付"""
        sorted_tranches = self._sort_by_priority(self.deal.tranches)

        for tranche in sorted_tranches:
            if tranche.current_balance <= 0:
                continue

            interest_due, principal_due = self._calculate_tranche_scheduled(tranche)

            if is_accelerated and tranche.tranche_type == TrancheType.SENIOR:
                principal_due = Decimal(str(tranche.current_balance))

            total_due = interest_due + principal_due

            paid, shortfall = self._pay_from_available(total_due)

            interest_paid = min(interest_due, paid)
            remaining_paid = paid - interest_paid
            principal_paid = min(principal_due, remaining_paid)

            interest_shortfall = interest_due - interest_paid
            principal_shortfall = principal_due - principal_paid

            if interest_paid > 0:
                self.tranche_payments.append(PaymentAllocation(
                    tranche_id=tranche.tranche_id,
                    tranche_name=tranche.tranche_name,
                    payment_type=PaymentType.INTEREST,
                    scheduled_amount=float(interest_due),
                    paid_amount=float(interest_paid),
                    shortfall_amount=float(interest_shortfall),
                    carried_shortfall=float(interest_shortfall) if tranche.is_shortfall_carry else 0,
                    source_account="collection",
                ))

            if principal_paid > 0:
                self.tranche_payments.append(PaymentAllocation(
                    tranche_id=tranche.tranche_id,
                    tranche_name=tranche.tranche_name,
                    payment_type=PaymentType.PRINCIPAL,
                    scheduled_amount=float(principal_due),
                    paid_amount=float(principal_paid),
                    shortfall_amount=float(principal_shortfall),
                    carried_shortfall=float(principal_shortfall) if tranche.is_shortfall_carry else 0,
                    source_account="collection",
                ))

            tranche.current_balance = float(Decimal(str(tranche.current_balance)) - principal_paid)

    def _allocate_recoveries(self, recovery_amount: Decimal):
        """分配违约回款 - 按优先级从高到低，先补利息短缺再补本金"""
        remaining_recovery = recovery_amount
        sorted_tranches = self._sort_by_priority(self.deal.tranches)

        for tranche in sorted_tranches:
            if remaining_recovery <= 0:
                break

            for payment in self.tranche_payments:
                if payment.tranche_id != tranche.tranche_id or payment.shortfall_amount <= 0:
                    continue

                recovery_used = min(Decimal(str(payment.shortfall_amount)), remaining_recovery)
                if recovery_used > 0:
                    payment.paid_amount += float(recovery_used)
                    payment.shortfall_amount -= float(recovery_used)
                    payment.carried_shortfall -= float(recovery_used)
                    payment.is_from_recovery = True
                    remaining_recovery -= recovery_used

                    if payment.payment_type == PaymentType.PRINCIPAL:
                        tranche.current_balance = float(
                            Decimal(str(tranche.current_balance)) - recovery_used
                        )

        if remaining_recovery > 0:
            equity_tranches = [t for t in sorted_tranches if t.tranche_type == TrancheType.EQUITY]
            for eq in equity_tranches:
                if remaining_recovery <= 0:
                    break
                self.tranche_payments.append(PaymentAllocation(
                    tranche_id=eq.tranche_id,
                    tranche_name=eq.tranche_name,
                    payment_type=PaymentType.PRINCIPAL,
                    scheduled_amount=0.0,
                    paid_amount=float(remaining_recovery),
                    shortfall_amount=0.0,
                    carried_shortfall=0.0,
                    source_account="recovery",
                    is_from_recovery=True,
                ))
                eq.current_balance = float(Decimal(str(eq.current_balance)) - remaining_recovery)
                remaining_recovery = Decimal('0')

        return recovery_amount - remaining_recovery

    def run_waterfall(self, triggers: List) -> WaterfallResult:
        """执行完整的现金流瀑布计算"""
        self._preserve_original_values()

        regular_cf, recovery_cf, other_cf = self._collect_period_cashflows()

        is_accelerated = any(
            t.status == TriggerStatus.TRIGGERED 
            for t in triggers 
            if t.event_type in ["acceleration", "default"]
        )

        self._process_fees(is_accelerated)

        self._process_tranches(is_accelerated)

        if recovery_cf > 0:
            self._allocate_recoveries(recovery_cf)

        total_inflow = regular_cf + recovery_cf + other_cf
        total_outflow = (
            sum(Decimal(str(fp.paid_amount)) for fp in self.fee_payments) +
            sum(Decimal(str(tp.paid_amount)) for tp in self.tranche_payments)
        )

        result = WaterfallResult(
            period_start_date=self.period_start,
            period_end_date=self.period_end,
            total_cash_inflow=float(self._round(total_inflow)),
            total_cash_outflow=float(self._round(total_outflow)),
            beginning_collection_balance=float(self.beginning_collection),
            ending_collection_balance=float(self._round(self.available_cash)),
            beginning_reserve_balance=float(self.beginning_reserve),
            ending_reserve_balance=float(self._round(self.reserve_cash)),
            fee_payments=self.fee_payments,
            tranche_payments=self.tranche_payments,
            trigger_results=triggers,
            raw_cashflows_used=self.raw_cashflows_used,
            original_values_preserved=self.original_values,
        )

        return result
