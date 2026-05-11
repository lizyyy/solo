from typing import List, Dict, Optional, Tuple
from datetime import datetime
import uuid

from models.data_models import (
    CheckResult, CheckSession, AddOn, Payment, Refund,
    Employee, GroupCheckup, DiscountPolicy
)


class BillingChecker:
    def __init__(self, data_store):
        self.data_store = data_store

    def _get_employee_discount(self, employee: Employee) -> float:
        company = self.data_store.group_checkups.get(employee.company_id)
        base_discount = company.discount_rate if company else 1.0
        
        return base_discount

    def _get_item_discount(self, employee: Employee, item_code: str) -> float:
        base_discount = self._get_employee_discount(employee)
        
        for policy in self.data_store.discount_policies.values():
            if policy.item_code == item_code:
                if policy.company_id is None or policy.company_id == employee.company_id:
                    return min(base_discount, policy.discount_rate)
        
        return base_discount

    def _get_payments_for_add_on(self, add_on: AddOn) -> List[Payment]:
        payments = []
        for payment in self.data_store.payments.values():
            if payment.add_on_id == add_on.add_on_id and payment.status == 'completed':
                payments.append(payment)
        return payments

    def _get_refunds_for_payment(self, payment: Payment) -> List[Refund]:
        refunds = []
        for refund in self.data_store.refunds.values():
            if refund.original_payment_id == payment.payment_id and refund.status == 'completed':
                refunds.append(refund)
        return refunds

    def _get_total_refund_for_add_on(self, add_on: AddOn, payments: List[Payment]) -> float:
        total_refund = 0.0
        for payment in payments:
            refunds = self._get_refunds_for_payment(payment)
            for refund in refunds:
                total_refund += refund.amount
        return total_refund

    def _check_duplicate_add_ons(self) -> List[Tuple[str, str]]:
        seen = {}
        duplicates = []
        
        for add_on in self.data_store.add_ons.values():
            key = (add_on.employee_id, add_on.item_code, add_on.timestamp[:10])
            if key in seen:
                duplicates.append((seen[key], add_on.add_on_id))
            else:
                seen[key] = add_on.add_on_id
        
        return duplicates

    def _check_forbidden_item(self, employee: Employee, add_on: AddOn) -> bool:
        company = self.data_store.group_checkups.get(employee.company_id)
        if not company:
            return False
        
        if company.forbidden_items and add_on.item_code in company.forbidden_items:
            return True
        
        if company.allowed_items and add_on.item_code not in company.allowed_items:
            return True
        
        return False

    def run_check(self) -> CheckSession:
        session_id = str(uuid.uuid4())[:8]
        created_at = datetime.now()
        
        results: List[CheckResult] = []
        duplicate_add_ons = self._check_duplicate_add_ons()
        duplicate_add_on_ids = set()
        for dup1, dup2 in duplicate_add_ons:
            duplicate_add_on_ids.add(dup1)
            duplicate_add_on_ids.add(dup2)

        for add_on in self.data_store.add_ons.values():
            employee = self.data_store.employees.get(add_on.employee_id)
            if not employee:
                continue
            
            company = self.data_store.group_checkups.get(employee.company_id)
            company_name = company.company_name if company else "未知企业"
            
            discount_rate = self._get_item_discount(employee, add_on.item_code)
            expected_amount = round(add_on.unit_price * add_on.quantity * discount_rate, 2)
            
            payments = self._get_payments_for_add_on(add_on)
            total_paid = sum(p.amount for p in payments)
            total_refund = self._get_total_refund_for_add_on(add_on, payments)
            net_paid = total_paid - total_refund
            
            status = "normal"
            issue_type = None
            issue_desc = None
            
            if add_on.add_on_id in duplicate_add_on_ids:
                status = "issue"
                issue_type = "DUPLICATE_ADD_ON"
                issue_desc = "⚠️ 加项重复录入 - 同一员工同一项目在同一天录入多次"
            
            elif self._check_forbidden_item(employee, add_on):
                status = "issue"
                issue_type = "FORBIDDEN_ITEM"
                issue_desc = "⚠️ 企业套餐不允许 - 该项目不在企业允许的加项范围内"
            
            elif not payments:
                status = "pending"
                issue_type = "MISSING_PAYMENT"
                issue_desc = "📋 待收费 - 已有加项记录但无收费流水"
            
            else:
                if total_refund > 0:
                    if abs(net_paid) < 0.01:
                        status = "normal"
                        issue_type = None
                        issue_desc = "✓ 已全额退费"
                    elif net_paid > 0:
                        status = "issue"
                        issue_type = "PARTIAL_REFUND"
                        issue_desc = f"⚠️ 部分退费 - 已退费 {total_refund:.2f} 元，仍欠 {net_paid:.2f} 元"
                    else:
                        status = "issue"
                        issue_type = "OVER_REFUND"
                        issue_desc = f"⚠️ 超额退费 - 已退费 {total_refund:.2f} 元，多退 {abs(net_paid):.2f} 元"
                else:
                    if abs(expected_amount - total_paid) > 0.01:
                        status = "issue"
                        issue_type = "AMOUNT_MISMATCH"
                        issue_desc = f"⚠️ 金额不符 - 应收 {expected_amount:.2f} 元，实收 {total_paid:.2f} 元"
                
                if len(payments) > 1 and status != "normal":
                    status = "issue"
                    issue_type = "DUPLICATE_PAYMENT"
                    issue_desc = f"⚠️ 重复收费 - 同一加项有 {len(payments)} 笔收费记录"

            result = CheckResult(
                employee_id=employee.employee_id,
                employee_name=employee.name,
                company_name=company_name,
                add_on_id=add_on.add_on_id,
                item_code=add_on.item_code,
                item_name=add_on.item_name,
                quantity=add_on.quantity,
                unit_price=add_on.unit_price,
                discount_rate=discount_rate,
                expected_amount=expected_amount,
                paid_amount=total_paid,
                refund_amount=total_refund,
                status=status,
                issue_type=issue_type,
                issue_description=issue_desc
            )
            results.append(result)

        total_pending = sum(1 for r in results if r.status == 'pending')
        total_issues = sum(1 for r in results if r.status == 'issue')
        total_normal = sum(1 for r in results if r.status == 'normal')

        return CheckSession(
            session_id=session_id,
            created_at=created_at,
            status="checked",
            results=results,
            total_pending=total_pending,
            total_issues=total_issues,
            total_normal=total_normal
        )
