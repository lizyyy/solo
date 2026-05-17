from datetime import datetime, date
from decimal import Decimal
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
import logging

from .models import (
    RentalOrder, DepositTransaction, DamageItem, RenewalApplication,
    AuditResult, DepositStatus, RentalStatus, DamageSeverity
)

logger = logging.getLogger(__name__)


class RuleEngineError(Exception):
    pass


class DepositRuleEngine:
    @staticmethod
    def check_deposit_freeze(order: RentalOrder, 
                            transactions: List[DepositTransaction]) -> Tuple[bool, List[str]]:
        issues = []
        
        if not transactions:
            issues.append(f"订单 {order.order_id} 没有押金流水记录")
            return False, issues
        
        frozen_transactions = [t for t in transactions if t.status == DepositStatus.FROZEN]
        
        total_frozen = sum(t.amount for t in frozen_transactions)
        
        if total_frozen < order.deposit_amount:
            issues.append(
                f"押金冻结金额不足: 应冻结 {order.deposit_amount} CNY, "
                f"实际冻结 {total_frozen} CNY, "
                f"差额 {order.deposit_amount - total_frozen} CNY"
            )
        
        for t in frozen_transactions:
            if t.transaction_date > order.created_at:
                days_diff = (t.transaction_date - order.created_at).days
                if days_diff > 1:
                    issues.append(
                        f"押金冻结延迟: 订单创建于 {order.created_at.date()}, "
                        f"冻结交易 {t.transaction_id} 于 {t.transaction_date.date()} 完成, "
                        f"延迟 {days_diff} 天"
                    )
        
        return len(issues) == 0, issues

    @staticmethod
    def calculate_deductions(order: RentalOrder,
                           transactions: List[DepositTransaction],
                           damages: List[DamageItem]) -> Dict[str, Decimal]:
        overdue_charge = Decimal('0')
        damage_charge = Decimal('0')
        other_charges = Decimal('0')
        
        verified_damages = [d for d in damages if d.is_verified]
        damage_charge = sum(d.repair_cost for d in verified_damages)
        
        result = {
            'overdue_charge': overdue_charge,
            'damage_charge': damage_charge,
            'other_charges': other_charges,
            'total_deductions': overdue_charge + damage_charge + other_charges
        }
        
        return result

    @staticmethod
    def check_settlement_consistency(order: RentalOrder,
                                   transactions: List[DepositTransaction],
                                   expected_deductions: Decimal) -> Tuple[bool, List[str]]:
        issues = []
        
        deducted_transactions = [
            t for t in transactions 
            if t.status in [DepositStatus.PARTIAL_DEDUCTED, DepositStatus.FULLY_DEDUCTED]
        ]
        
        total_deducted = sum(t.amount for t in deducted_transactions)
        
        if abs(total_deducted - expected_deductions) > Decimal('0.01'):
            issues.append(
                f"扣款金额不一致: 应扣款 {expected_deductions} CNY, "
                f"实际扣款 {total_deducted} CNY"
            )
        
        released_transactions = [
            t for t in transactions if t.status == DepositStatus.RELEASED
        ]
        
        total_released = sum(t.amount for t in released_transactions)
        expected_refund = order.deposit_amount - expected_deductions
        
        if abs(total_released - expected_refund) > Decimal('0.01'):
            issues.append(
                f"退款金额不一致: 应退款 {expected_refund} CNY, "
                f"实际退款 {total_released} CNY"
            )
        
        return len(issues) == 0, issues


class OverdueRuleEngine:
    @staticmethod
    def calculate_overdue_days(order: RentalOrder, 
                               renewals: List[RenewalApplication]) -> int:
        effective_end_date = order.rental_end_date
        
        approved_renewals = [r for r in renewals if r.approved is True]
        approved_renewals.sort(key=lambda x: x.new_end_date)
        
        for renewal in approved_renewals:
            if renewal.original_end_date == effective_end_date:
                if renewal.new_end_date > effective_end_date:
                    effective_end_date = renewal.new_end_date
        
        return_date = order.actual_return_date or date.today()
        
        if return_date <= effective_end_date:
            return 0
        
        overdue_days = (return_date - effective_end_date).days
        return overdue_days

    @staticmethod
    def calculate_overdue_charge(order: RentalOrder, 
                                overdue_days: int,
                                penalty_rate: Optional[Decimal] = None) -> Decimal:
        if overdue_days <= 0:
            return Decimal('0')
        
        rate = penalty_rate or Decimal('1.5')
        daily_charge = order.daily_rate * rate
        
        total_charge = daily_charge * Decimal(str(overdue_days))
        return total_charge.quantize(Decimal('0.01'))

    @staticmethod
    def check_overdue_status(order: RentalOrder,
                            renewals: List[RenewalApplication]) -> Tuple[bool, List[str]]:
        issues = []
        
        overdue_days = OverdueRuleEngine.calculate_overdue_days(order, renewals)
        
        if overdue_days > 0:
            if order.status not in [RentalStatus.OVERDUE, RentalStatus.SETTLED]:
                issues.append(
                    f"订单状态异常: 逾期 {overdue_days} 天, "
                    f"但状态为 {order.status.value}"
                )
        
        effective_end_date = order.rental_end_date
        approved_renewals = [r for r in renewals if r.approved is True]
        
        for renewal in approved_renewals:
            if renewal.original_end_date != effective_end_date:
                issues.append(
                    f"续租时间不连续: 续租 {renewal.renewal_id} "
                    f"原始结束日期 {renewal.original_end_date} 与 "
                    f"当前生效结束日期 {effective_end_date} 不符"
                )
            effective_end_date = renewal.new_end_date
        
        return len(issues) == 0, issues


class DamageRuleEngine:
    @staticmethod
    def check_damage_validity(damage: DamageItem, order: RentalOrder) -> Tuple[bool, List[str]]:
        issues = []
        
        if damage.equipment_id != order.equipment_id:
            issues.append(
                f"设备ID不匹配: 损坏记录 {damage.damage_id} 设备 {damage.equipment_id}, "
                f"订单设备 {order.equipment_id}"
            )
        
        if damage.reported_date.date() < order.rental_start_date:
            issues.append(
                f"损坏报告时间异常: 损坏记录 {damage.damage_id} "
                f"报告时间 {damage.reported_date.date()} 早于租赁开始时间"
            )
        
        if not damage.is_verified:
            issues.append(
                f"损坏记录未验证: 损坏记录 {damage.damage_id} 未经过验证"
            )
        
        if not damage.photos_attached:
            issues.append(
                f"损坏记录缺少照片证据: 损坏记录 {damage.damage_id} "
                f"没有附带照片"
            )
        
        return len(issues) == 0, issues

    @staticmethod
    def calculate_damage_cost(damages: List[DamageItem],
                            verify_only: bool = True) -> Dict[str, Decimal]:
        if verify_only:
            damages = [d for d in damages if d.is_verified]
        
        total_cost = sum(d.repair_cost for d in damages)
        
        cost_by_severity = defaultdict(Decimal)
        for d in damages:
            cost_by_severity[d.severity.value] += d.repair_cost
        
        result = {
            'total_cost': total_cost,
            'count': len(damages),
            **dict(cost_by_severity)
        }
        
        return result

    @staticmethod
    def check_damage_deduction_consistency(damages: List[DamageItem],
                                         transactions: List[DepositTransaction],
                                         order: RentalOrder) -> Tuple[bool, List[str]]:
        issues = []
        
        verified_damages = [d for d in damages if d.is_verified]
        expected_damage_cost = sum(d.repair_cost for d in verified_damages)
        
        if expected_damage_cost == Decimal('0'):
            return len(issues) == 0, issues
        
        deducted_transactions = [
            t for t in transactions
            if t.status in [DepositStatus.PARTIAL_DEDUCTED, DepositStatus.FULLY_DEDUCTED]
            and 'damage' in t.transaction_type.lower()
        ]
        
        total_deducted = sum(t.amount for t in deducted_transactions)
        
        if abs(total_deducted - expected_damage_cost) > Decimal('0.01'):
            issues.append(
                f"损坏扣款不一致: 应扣损坏费用 {expected_damage_cost} CNY, "
                f"实际扣款 {total_deducted} CNY"
            )
        
        return len(issues) == 0, issues


class RenewalIdempotencyEngine:
    @staticmethod
    def check_idempotency(renewals: List[RenewalApplication]) -> Tuple[bool, List[str], Dict]:
        issues = []
        idempotency_groups = defaultdict(list)
        
        for renewal in renewals:
            idempotency_groups[renewal.idempotency_key].append(renewal)
        
        duplicates = []
        for key, group in idempotency_groups.items():
            if len(group) > 1:
                duplicates.append({
                    'key': key,
                    'count': len(group),
                    'renewal_ids': [r.renewal_id for r in group]
                })
                
                approved_count = sum(1 for r in group if r.approved is True)
                if approved_count > 1:
                    issues.append(
                        f"幂等冲突: 同一请求 {key} 有 {approved_count} 个已批准的续租, "
                        f"涉及续租ID: {[r.renewal_id for r in group]}"
                    )
                
                first_approved = None
                for r in sorted(group, key=lambda x: x.application_date):
                    if r.approved is True:
                        first_approved = r
                        break
                
                if first_approved:
                    for r in group:
                        if r != first_approved and r.approved is True:
                            if r.new_end_date != first_approved.new_end_date:
                                issues.append(
                                    f"续租内容不一致: 幂等键 {key} 下的续租 "
                                    f"{r.renewal_id} 与 {first_approved.renewal_id} "
                                    f"新结束日期不一致"
                                )
        
        result = {
            'total_renewals': len(renewals),
            'unique_idempotency_keys': len(idempotency_groups),
            'duplicates': duplicates
        }
        
        return len(issues) == 0, issues, result

    @staticmethod
    def check_renewal_timeline(renewals: List[RenewalApplication],
                              order: RentalOrder) -> Tuple[bool, List[str]]:
        issues = []
        
        approved_renewals = [r for r in renewals if r.approved is True]
        approved_renewals.sort(key=lambda x: x.application_date)
        
        current_end = order.rental_end_date
        
        for renewal in approved_renewals:
            if renewal.original_end_date != current_end:
                issues.append(
                    f"续租时间不连续: 续租 {renewal.renewal_id} "
                    f"原始结束日期 {renewal.original_end_date} 与 "
                    f"预期结束日期 {current_end} 不符"
                )
            
            if renewal.new_end_date <= renewal.original_end_date:
                issues.append(
                    f"续租时间无效: 续租 {renewal.renewal_id} "
                    f"新结束日期 {renewal.new_end_date} 不晚于原始结束日期"
                )
            
            if renewal.approved_date:
                if renewal.approved_date.date() > renewal.original_end_date:
                    issues.append(
                        f"续租审批延迟: 续租 {renewal.renewal_id} "
                        f"审批日期 {renewal.approved_date.date()} 晚于原始结束日期"
                    )
            
            current_end = renewal.new_end_date
        
        return len(issues) == 0, issues


class AuditEngine:
    def __init__(self):
        self.deposit_engine = DepositRuleEngine()
        self.overdue_engine = OverdueRuleEngine()
        self.damage_engine = DamageRuleEngine()
        self.renewal_engine = RenewalIdempotencyEngine()

    def audit_order(self,
                   order: RentalOrder,
                   transactions: List[DepositTransaction],
                   damages: List[DamageItem],
                   renewals: List[RenewalApplication]) -> AuditResult:
        
        deposit_passed, deposit_issues = self.deposit_engine.check_deposit_freeze(order, transactions)
        
        overdue_passed, overdue_issues = self.overdue_engine.check_overdue_status(order, renewals)
        
        damage_issues_all = []
        for damage in damages:
            passed, issues = self.damage_engine.check_damage_validity(damage, order)
            damage_issues_all.extend(issues)
        damage_passed = len(damage_issues_all) == 0
        
        renewal_passed, renewal_issues, _ = self.renewal_engine.check_idempotency(renewals)
        timeline_passed, timeline_issues = self.renewal_engine.check_renewal_timeline(renewals, order)
        renewal_issues.extend(timeline_issues)
        renewal_passed = renewal_passed and timeline_passed

        if damages:
            damage_deduction_passed, damage_deduction_issues = \
                self.damage_engine.check_damage_deduction_consistency(damages, transactions, order)
            damage_issues_all.extend(damage_deduction_issues)
            damage_passed = damage_passed and damage_deduction_passed

        all_issues = deposit_issues + overdue_issues + damage_issues_all + renewal_issues
        risk_level = self._calculate_risk_level(all_issues, order)
        
        recommended_actions = self._generate_recommendations(
            deposit_issues, overdue_issues, damage_issues_all, renewal_issues, order
        )

        overall_passed = deposit_passed and overdue_passed and damage_passed and renewal_passed

        return AuditResult(
            order_id=order.order_id,
            check_timestamp=datetime.now(),
            deposit_check_passed=deposit_passed,
            deposit_issues=deposit_issues,
            overdue_check_passed=overdue_passed,
            overdue_issues=overdue_issues,
            damage_check_passed=damage_passed,
            damage_issues=damage_issues_all,
            renewal_check_passed=renewal_passed,
            renewal_issues=renewal_issues,
            overall_passed=overall_passed,
            risk_level=risk_level,
            recommended_actions=recommended_actions
        )

    def _calculate_risk_level(self, issues: List[str], order: RentalOrder) -> str:
        issue_count = len(issues)
        
        if issue_count == 0:
            return "LOW"
        elif issue_count <= 2:
            return "MEDIUM"
        elif issue_count <= 5:
            return "HIGH"
        else:
            return "CRITICAL"

    def _generate_recommendations(self,
                                  deposit_issues: List[str],
                                  overdue_issues: List[str],
                                  damage_issues: List[str],
                                  renewal_issues: List[str],
                                  order: RentalOrder) -> List[str]:
        actions = []
        
        if deposit_issues:
            actions.append("核对押金冻结状态，补充缺失的押金流水")
            actions.append("检查押金冻结时间是否符合规定")
        
        if overdue_issues:
            actions.append("联系客户确认逾期情况，计算逾期费用")
            actions.append("更新订单状态为逾期")
        
        if damage_issues:
            actions.append("核实所有损坏记录的真实性和完整性")
            actions.append("确保损坏扣款已正确执行")
        
        if renewal_issues:
            actions.append("检查续租申请的幂等性冲突")
            actions.append("核实续租时间线的连续性")
        
        if order.status == RentalStatus.OVERDUE:
            actions.append("优先处理逾期订单，安排设备回收")
        
        if order.status not in [RentalStatus.SETTLED, RentalStatus.RETURNED]:
            if not actions:
                actions.append("正常跟进订单状态")
        
        return actions

    def calculate_settlement(self,
                            order: RentalOrder,
                            transactions: List[DepositTransaction],
                            damages: List[DamageItem],
                            renewals: List[RenewalApplication],
                            penalty_rate: Optional[Decimal] = None) -> Dict:
        overdue_days = self.overdue_engine.calculate_overdue_days(order, renewals)
        overdue_charge = self.overdue_engine.calculate_overdue_charge(order, overdue_days, penalty_rate)
        
        verified_damages = [d for d in damages if d.is_verified]
        damage_charge = sum(d.repair_cost for d in verified_damages)
        
        other_charges = Decimal('0')
        total_deductions = overdue_charge + damage_charge + other_charges
        
        net_refund = order.deposit_amount - total_deductions
        if net_refund < Decimal('0'):
            net_refund = Decimal('0')
        
        approved_renewals = [r for r in renewals if r.approved is True]
        
        result = {
            'order_id': order.order_id,
            'customer_name': order.customer_name,
            'equipment_name': order.equipment_name,
            'original_deposit': order.deposit_amount,
            'overdue_days': overdue_days,
            'overdue_charge': overdue_charge,
            'damage_count': len(verified_damages),
            'damage_charge': damage_charge,
            'other_charges': other_charges,
            'total_deductions': total_deductions,
            'net_refund': net_refund,
            'renewal_count': len(approved_renewals)
        }
        
        return result
