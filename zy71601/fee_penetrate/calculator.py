from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from sqlalchemy import and_

from .database import Database
from .models import (
    Product, FeeRule, NavFlow, CustomerShare, ChannelRebate,
    FeeAccrual, ChannelAllocation, SalesChannel, FeeType,
    ShareCaliber, AccrualMethod, AuditReport
)


class SharePenetrationResult:
    def __init__(self, product_code: str, share_date: date):
        self.product_code = product_code
        self.share_date = share_date
        self.total_nav_share: Optional[Decimal] = None
        self.total_customer_share: Optional[Decimal] = None
        self.diff_amount: Optional[Decimal] = None
        self.diff_ratio: Optional[Decimal] = None
        self.by_channel: Dict[str, Dict[str, Any]] = {}
        self.by_customer: List[Dict[str, Any]] = []


class FeeCalculationResult:
    def __init__(self, product_code: str, fee_type: str, period_start: date, period_end: date):
        self.product_code = product_code
        self.fee_type = fee_type
        self.period_start = period_start
        self.period_end = period_end
        self.applied_rule: Optional[Dict[str, Any]] = None
        self.share_caliber: str = ""
        self.accrual_method: str = ""
        self.calculation_basis: Decimal = Decimal("0")
        self.applied_rate: Decimal = Decimal("0")
        self.gross_amount: Decimal = Decimal("0")
        self.tax_amount: Decimal = Decimal("0")
        self.net_amount: Decimal = Decimal("0")
        self.calculation_log: List[str] = []
        self.daily_details: List[Dict[str, Any]] = []
        self.channel_allocations: List[Dict[str, Any]] = []
        self.is_manual_adjusted: bool = False
        self.adjustment_reason: Optional[str] = None


class DifferenceExplanation:
    def __init__(self, product_code: str, fee_type: str, period: str):
        self.product_code = product_code
        self.fee_type = fee_type
        self.period = period
        self.expected_amount: Decimal = Decimal("0")
        self.actual_amount: Decimal = Decimal("0")
        self.diff_amount: Decimal = Decimal("0")
        self.diff_ratio: Decimal = Decimal("0")
        self.factors: List[Dict[str, Any]] = []
        self.conclusion: str = ""


class FeeCalculator:
    def __init__(self, db: Optional[Database] = None):
        self.db = db or Database()

    def _get_days_in_period(self, start: date, end: date) -> int:
        return (end - start).days + 1

    def _get_applicable_fee_rule(
        self,
        session,
        product_id: int,
        fee_type: str,
        period_start: date,
        period_end: date
    ) -> Optional[FeeRule]:
        rules = (
            session.query(FeeRule)
            .filter(
                and_(
                    FeeRule.product_id == product_id,
                    FeeRule.fee_type == fee_type,
                    FeeRule.is_active == True,
                    FeeRule.effective_date <= period_end,
                    (FeeRule.expire_date == None) | (FeeRule.expire_date >= period_start)
                )
            )
            .order_by(FeeRule.effective_date)
            .all()
        )

        if not rules:
            return None

        if len(rules) == 1:
            return rules[0]

        for rule in rules:
            rule_end = rule.expire_date or date.max
            if rule.effective_date <= period_start and rule_end >= period_end:
                return rule

        return rules[-1]

    def _calculate_share_basis(
        self,
        session,
        product_id: int,
        share_caliber: str,
        period_start: date,
        period_end: date
    ) -> Tuple[Decimal, List[Dict[str, Any]]]:
        navs = (
            session.query(NavFlow)
            .filter(
                and_(
                    NavFlow.product_id == product_id,
                    NavFlow.nav_date >= period_start,
                    NavFlow.nav_date <= period_end,
                    NavFlow.is_active == True
                )
            )
            .order_by(NavFlow.nav_date)
            .all()
        )

        if not navs:
            return Decimal("0"), []

        daily_details = []
        for nav in navs:
            daily_details.append({
                "date": nav.nav_date,
                "total_share": nav.total_share,
                "unit_nav": nav.unit_nav,
                "total_asset": nav.total_asset,
            })

        total_days = self._get_days_in_period(period_start, period_end)
        nav_days = len(navs)

        if share_caliber == ShareCaliber.BEGINNING.value:
            basis = navs[0].total_share if navs else Decimal("0")
        elif share_caliber == ShareCaliber.ENDING.value:
            basis = navs[-1].total_share if navs else Decimal("0")
        elif share_caliber == ShareCaliber.AVERAGE.value:
            if navs:
                total = sum(n.total_share for n in navs)
                basis = total / Decimal(str(len(navs)))
            else:
                basis = Decimal("0")
        elif share_caliber == ShareCaliber.DAILY.value:
            if nav_days == total_days:
                total = sum(n.total_share for n in navs)
                basis = total / Decimal(str(total_days))
            else:
                total = sum(n.total_share for n in navs)
                basis = total / Decimal(str(nav_days)) if nav_days > 0 else Decimal("0")
        else:
            total = sum(n.total_share for n in navs)
            basis = total / Decimal(str(len(navs))) if navs else Decimal("0")

        return basis, daily_details

    def penetrate_shares(
        self,
        product_code: str,
        share_date: date
    ) -> SharePenetrationResult:
        result = SharePenetrationResult(product_code, share_date)

        with self.db.get_session() as session:
            product = session.query(Product).filter(
                Product.product_code == product_code
            ).first()
            if not product:
                return result

            nav = session.query(NavFlow).filter(
                and_(
                    NavFlow.product_id == product.id,
                    NavFlow.nav_date == share_date,
                    NavFlow.is_active == True
                )
            ).first()

            if nav:
                result.total_nav_share = nav.total_share

            customer_shares = session.query(CustomerShare).filter(
                and_(
                    CustomerShare.product_id == product.id,
                    CustomerShare.share_date == share_date,
                    CustomerShare.is_active == True
                )
            ).all()

            channel_totals: Dict[int, Decimal] = defaultdict(Decimal)
            total_customer = Decimal("0")

            for cs in customer_shares:
                channel = session.query(SalesChannel).filter(
                    SalesChannel.id == cs.channel_id
                ).first()
                channel_code = channel.channel_code if channel else "unknown"
                channel_name = channel.channel_name if channel else "未知渠道"

                if channel_code not in result.by_channel:
                    result.by_channel[channel_code] = {
                        "channel_name": channel_name,
                        "total_share": Decimal("0"),
                        "customer_count": 0,
                        "share_ratio": Decimal("0"),
                    }

                result.by_channel[channel_code]["total_share"] += cs.share_amount
                result.by_channel[channel_code]["customer_count"] += 1
                channel_totals[cs.channel_id] += cs.share_amount
                total_customer += cs.share_amount

                result.by_customer.append({
                    "customer_id": cs.customer_id,
                    "customer_name": cs.customer_name,
                    "channel_code": channel_code,
                    "channel_name": channel_name,
                    "share_amount": cs.share_amount,
                    "share_ratio": cs.share_ratio,
                    "cost_value": cs.cost_value,
                    "profit_amount": cs.profit_amount,
                })

            result.total_customer_share = total_customer

            if result.total_nav_share and result.total_customer_share:
                result.diff_amount = result.total_customer_share - result.total_nav_share
                result.diff_ratio = (
                    result.diff_amount / result.total_nav_share
                    if result.total_nav_share > 0 else Decimal("0")
                )

            for channel_code, data in result.by_channel.items():
                if total_customer > 0:
                    data["share_ratio"] = data["total_share"] / total_customer

            result.by_customer.sort(key=lambda x: x["share_amount"], reverse=True)

        return result

    def calculate_fee(
        self,
        product_code: str,
        fee_type: str,
        period_start: date,
        period_end: date,
        operator: str = "system",
        manual_adjustment: Optional[Decimal] = None,
        adjustment_reason: Optional[str] = None,
        save: bool = True
    ) -> FeeCalculationResult:
        result = FeeCalculationResult(product_code, fee_type, period_start, period_end)

        with self.db.get_session() as session:
            product = session.query(Product).filter(
                Product.product_code == product_code
            ).first()
            if not product:
                result.calculation_log.append(f"错误: 未找到产品 {product_code}")
                return result

            rule = self._get_applicable_fee_rule(
                session, product.id, fee_type, period_start, period_end
            )

            if not rule:
                result.calculation_log.append(
                    f"错误: 产品 {product_code} 在 {period_start}~{period_end} 期间无有效{fee_type}规则"
                )
                return result

            result.applied_rule = {
                "rule_id": rule.id,
                "rate": rule.rate,
                "effective_date": rule.effective_date,
                "expire_date": rule.expire_date,
            }
            result.share_caliber = rule.share_caliber
            result.accrual_method = rule.accrual_method
            result.applied_rate = rule.rate

            result.calculation_log.append(
                f"使用费率规则ID={rule.id}, 费率={rule.rate*100:.6f}%"
            )
            result.calculation_log.append(
                f"份额口径={rule.share_caliber}, 计提方式={rule.accrual_method}"
            )

            basis, daily_details = self._calculate_share_basis(
                session, product.id, rule.share_caliber, period_start, period_end
            )
            result.calculation_basis = basis
            result.daily_details = daily_details

            if daily_details:
                result.calculation_log.append(
                    f"计算基数={basis:.4f}份, 共{len(daily_details)}天净值数据"
                )

            days_in_period = self._get_days_in_period(period_start, period_end)
            if rule.accrual_method == AccrualMethod.DAILY.value:
                daily_rate = rule.rate / Decimal("365")
                result.gross_amount = basis * daily_rate * Decimal(str(days_in_period))
                result.calculation_log.append(
                    f"按日计提: {basis:.4f} * ({rule.rate*100:.6f}%/365) * {days_in_period}天"
                )
            elif rule.accrual_method == AccrualMethod.MONTHLY.value:
                result.gross_amount = basis * rule.rate / Decimal("12")
                result.calculation_log.append(
                    f"按月计提: {basis:.4f} * {rule.rate*100:.6f}% / 12"
                )
            elif rule.accrual_method == AccrualMethod.QUARTERLY.value:
                result.gross_amount = basis * rule.rate / Decimal("4")
                result.calculation_log.append(
                    f"按季计提: {basis:.4f} * {rule.rate*100:.6f}% / 4"
                )
            else:
                result.gross_amount = basis * rule.rate / Decimal("365") * Decimal(str(days_in_period))
                result.calculation_log.append(
                    f"默认按日计提: {basis:.4f} * {rule.rate*100:.6f}% / 365 * {days_in_period}天"
                )

            if rule.min_fee and result.gross_amount < rule.min_fee:
                result.gross_amount = rule.min_fee
                result.calculation_log.append(f"触发最低费用: {rule.min_fee:.2f}")
            if rule.max_fee and result.gross_amount > rule.max_fee:
                result.gross_amount = rule.max_fee
                result.calculation_log.append(f"触发最高费用: {rule.max_fee:.2f}")

            if rule.tax_rate and rule.tax_rate > 0:
                result.tax_amount = result.gross_amount * rule.tax_rate / (Decimal("1") + rule.tax_rate)
                result.calculation_log.append(
                    f"增值税: {result.gross_amount:.2f} * {rule.tax_rate*100:.2f}% / (1+{rule.tax_rate*100:.2f}%) = {result.tax_amount:.2f}"
                )

            result.net_amount = result.gross_amount - result.tax_amount
            result.calculation_log.append(
                f"计算结果: 含税={result.gross_amount:.2f}, 税额={result.tax_amount:.2f}, 净额={result.net_amount:.2f}"
            )

            if manual_adjustment is not None:
                result.gross_amount += manual_adjustment
                result.net_amount = result.gross_amount - result.tax_amount
                result.is_manual_adjusted = True
                result.adjustment_reason = adjustment_reason
                result.calculation_log.append(
                    f"人工调整: {manual_adjustment:.2f}, 调整后净额={result.net_amount:.2f}"
                )

            if save:
                existing = session.query(FeeAccrual).filter(
                    and_(
                        FeeAccrual.product_id == product.id,
                        FeeAccrual.fee_type == fee_type,
                        FeeAccrual.period_start == period_start,
                        FeeAccrual.period_end == period_end
                    )
                ).first()

                if existing:
                    batch = self.db.create_batch(
                        source_type="fee_calculation",
                        operator=operator,
                        remark=f"重新计算费用 {product_code} {fee_type} {period_start}~{period_end}"
                    )
                    changes = []

                    old_fields = {
                        "accrual_amount": existing.accrual_amount,
                        "tax_amount": existing.tax_amount,
                        "net_amount": existing.net_amount,
                        "calculation_basis": existing.calculation_basis,
                        "applied_rate": existing.applied_rate,
                    }
                    new_fields = {
                        "accrual_amount": result.gross_amount,
                        "tax_amount": result.tax_amount,
                        "net_amount": result.net_amount,
                        "calculation_basis": result.calculation_basis,
                        "applied_rate": result.applied_rate,
                        "is_manual_adjusted": result.is_manual_adjusted,
                        "adjustment_reason": result.adjustment_reason,
                        "calculation_log": "\n".join(result.calculation_log),
                    }

                    for field, old_val in old_fields.items():
                        new_val = new_fields.get(field)
                        if old_val != new_val:
                            changes.append((field, old_val, new_val))
                            self.db.log_change(
                                batch_id=batch.id,
                                entity_type="FeeAccrual",
                                entity_id=existing.id,
                                field_name=field,
                                old_value=str(old_val),
                                new_value=str(new_val),
                                change_type="update",
                                operator=operator,
                                reason="重新计算费用"
                            )

                    for field, value in new_fields.items():
                        setattr(existing, field, value)

                else:
                    batch = self.db.create_batch(
                        source_type="fee_calculation",
                        operator=operator,
                        remark=f"新增费用计算 {product_code} {fee_type} {period_start}~{period_end}"
                    )
                    accrual = FeeAccrual(
                        product_id=product.id,
                        fee_type=fee_type,
                        period_start=period_start,
                        period_end=period_end,
                        accrual_amount=result.gross_amount,
                        tax_amount=result.tax_amount,
                        net_amount=result.net_amount,
                        calculation_basis=result.calculation_basis,
                        applied_rate=result.applied_rate,
                        share_caliber=result.share_caliber,
                        accrual_method=result.accrual_method,
                        calculation_log="\n".join(result.calculation_log),
                        is_manual_adjusted=result.is_manual_adjusted,
                        adjustment_reason=result.adjustment_reason,
                        import_batch_id=batch.id,
                    )
                    session.add(accrual)
                    session.flush()

        return result

    def allocate_to_channels(
        self,
        product_code: str,
        fee_type: str,
        period_start: date,
        period_end: date,
        operator: str = "system"
    ) -> List[ChannelAllocation]:
        allocations = []

        with self.db.get_session() as session:
            product = session.query(Product).filter(
                Product.product_code == product_code
            ).first()
            if not product:
                return allocations

            fee_rule = self._get_applicable_fee_rule(
                session, product.id, fee_type, period_start, period_end
            )
            if not fee_rule:
                return allocations

            accrual = session.query(FeeAccrual).filter(
                and_(
                    FeeAccrual.product_id == product.id,
                    FeeAccrual.fee_type == fee_type,
                    FeeAccrual.period_start == period_start,
                    FeeAccrual.period_end == period_end
                )
            ).first()

            if not accrual:
                calc_result = self.calculate_fee(
                    product_code, fee_type, period_start, period_end, operator
                )
                accrual = session.query(FeeAccrual).filter(
                    and_(
                        FeeAccrual.product_id == product.id,
                        FeeAccrual.fee_type == fee_type,
                        FeeAccrual.period_start == period_start,
                        FeeAccrual.period_end == period_end
                    )
                ).first()

            if not accrual:
                return allocations

            share_date = period_end
            customer_shares = session.query(CustomerShare).filter(
                and_(
                    CustomerShare.product_id == product.id,
                    CustomerShare.share_date == share_date,
                    CustomerShare.is_active == True
                )
            ).all()

            if not customer_shares:
                share_date = period_start
                customer_shares = session.query(CustomerShare).filter(
                    and_(
                        CustomerShare.product_id == product.id,
                        CustomerShare.share_date == share_date,
                        CustomerShare.is_active == True
                    )
                ).all()

            if not customer_shares:
                return allocations

            total_share = sum(cs.share_amount for cs in customer_shares)
            channel_totals: Dict[int, Decimal] = defaultdict(Decimal)

            for cs in customer_shares:
                channel_totals[cs.channel_id] += cs.share_amount

            batch = self.db.create_batch(
                source_type="channel_allocation",
                operator=operator,
                remark=f"渠道分摊 {product_code} {fee_type} {period_start}~{period_end}"
            )

            for channel_id, channel_share in channel_totals.items():
                if total_share > 0:
                    ratio = channel_share / total_share
                else:
                    ratio = Decimal("0")

                allocation_amount = accrual.net_amount * ratio

                channel = session.query(SalesChannel).filter(
                    SalesChannel.id == channel_id
                ).first()

                data = {
                    "fee_rule_id": fee_rule.id,
                    "channel_id": channel_id,
                    "period_start": period_start,
                    "period_end": period_end,
                    "allocation_ratio": ratio,
                    "allocation_amount": allocation_amount,
                    "allocation_basis": channel_share,
                    "remark": f"按{share_date}份额分摊，渠道[{channel.channel_code if channel else 'unknown'}]",
                }

                unique_keys = {
                    "fee_rule_id": fee_rule.id,
                    "channel_id": channel_id,
                    "period_start": period_start,
                    "period_end": period_end,
                }

                status, alloc_id, changes = self.db.upsert_entity(
                    session=session,
                    model_class=ChannelAllocation,
                    unique_keys=unique_keys,
                    data=data,
                    batch_id=batch.id,
                    operator=operator,
                    update_mode="force",
                    import_reason="重新计算渠道分摊"
                )

                alloc = session.query(ChannelAllocation).filter(
                    ChannelAllocation.id == alloc_id
                ).first()
                if alloc:
                    allocations.append(alloc)

        return allocations

    def explain_difference(
        self,
        product_code: str,
        fee_type: str,
        period_start: date,
        period_end: date,
        expected_amount: Decimal
    ) -> DifferenceExplanation:
        explanation = DifferenceExplanation(product_code, fee_type, f"{period_start}~{period_end}")
        explanation.expected_amount = expected_amount

        calc_result = self.calculate_fee(
            product_code, fee_type, period_start, period_end, save=False
        )
        explanation.actual_amount = calc_result.net_amount
        explanation.diff_amount = explanation.actual_amount - explanation.expected_amount
        if expected_amount > 0:
            explanation.diff_ratio = explanation.diff_amount / expected_amount

        factors = []

        if calc_result.applied_rule:
            factors.append({
                "factor": "使用费率规则",
                "value": f"费率={calc_result.applied_rule['rate']*100:.6f}%, 生效日={calc_result.applied_rule['effective_date']}",
                "impact": None,
            })

        if calc_result.calculation_basis:
            factors.append({
                "factor": "份额计算基数",
                "value": f"{calc_result.calculation_basis:.4f}份 (口径={calc_result.share_caliber})",
                "impact": None,
            })

        if calc_result.daily_details:
            total_days = self._get_days_in_period(period_start, period_end)
            actual_days = len(calc_result.daily_details)
            if actual_days < total_days:
                factors.append({
                    "factor": "净值数据缺失",
                    "value": f"应{total_days}天，实{actual_days}天，缺失{total_days-actual_days}天",
                    "impact": "可能导致基数偏小",
                })

        if calc_result.is_manual_adjusted:
            factors.append({
                "factor": "人工调整",
                "value": calc_result.adjustment_reason or "未说明原因",
                "impact": "直接影响最终结果",
            })

        if calc_result.tax_amount > 0:
            factors.append({
                "factor": "增值税",
                "value": f"税额={calc_result.tax_amount:.2f}",
                "impact": f"净额减少{calc_result.tax_amount:.2f}",
            })

        explanation.factors = factors

        if abs(explanation.diff_ratio) < Decimal("0.001"):
            explanation.conclusion = "差异在合理范围内（±0.1%），可能为四舍五入误差。"
        elif explanation.diff_amount > 0:
            explanation.conclusion = (
                f"实际计算值高于预期{explanation.diff_amount:.2f}，"
                f"主要原因可能为：份额基数偏高、费率上调、或未考虑增值税。"
            )
        else:
            explanation.conclusion = (
                f"实际计算值低于预期{abs(explanation.diff_amount):.2f}，"
                f"主要原因可能为：份额基数偏低、费率下调、或净值数据缺失。"
            )

        return explanation

    def calculate_monthly_fees(
        self,
        year: int,
        month: int,
        product_code: Optional[str] = None,
        operator: str = "system"
    ) -> List[FeeCalculationResult]:
        from calendar import monthrange

        period_start = date(year, month, 1)
        period_end = date(year, month, monthrange(year, month)[1])

        results = []

        with self.db.get_session() as session:
            query = session.query(Product).filter(Product.is_active == True)
            if product_code:
                query = query.filter(Product.product_code == product_code)
            products = query.all()

            for product in products:
                for fee_type in [FeeType.MANAGEMENT, FeeType.CUSTODIAN, FeeType.SALES_SERVICE]:
                    result = self.calculate_fee(
                        product.product_code,
                        fee_type.value,
                        period_start,
                        period_end,
                        operator,
                        save=True
                    )
                    if result.applied_rule:
                        results.append(result)

                        if fee_type == FeeType.SALES_SERVICE:
                            self.allocate_to_channels(
                                product.product_code,
                                fee_type.value,
                                period_start,
                                period_end,
                                operator
                            )

        return results
