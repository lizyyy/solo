from datetime import datetime
from typing import List

from .models import (
    RefundRequest, OrderPayment, BlacklistItem, ApprovalRecord,
    HistoricalRefund, CheckResult, RefundStatus, ApprovalStatus
)


class BaseRule:
    name: str
    description: str
    
    def check(self, request: RefundRequest, context: dict) -> CheckResult:
        raise NotImplementedError


class DuplicateRefundRule(BaseRule):
    name = "duplicate_refund_check"
    description = "检查是否存在重复退款申请"
    
    def check(self, request: RefundRequest, context: dict) -> CheckResult:
        all_requests: List[RefundRequest] = context.get('all_requests', [])
        historical_refunds: List[HistoricalRefund] = context.get('historical_refunds', [])
        payment: OrderPayment = context.get('payment')
        
        duplicates = []
        
        for r in all_requests:
            if r.request_id == request.request_id:
                continue
            if r.order_id == request.order_id and r.status in [
                RefundStatus.PENDING, RefundStatus.APPROVED, RefundStatus.PROCESSED
            ]:
                duplicates.append({
                    "type": "pending_request",
                    "request_id": r.request_id,
                    "status": r.status,
                    "amount": r.amount,
                    "requested_at": r.requested_at.isoformat()
                })
        
        if payment:
            order_historical = [h for h in historical_refunds if h.order_id == request.order_id and h.status == "success"]
            historical_total = sum(h.amount for h in order_historical)
            
            if historical_total >= payment.amount:
                for h in order_historical:
                    duplicates.append({
                        "type": "historical_full_refund",
                        "refund_id": h.refund_id,
                        "processed_at": h.processed_at.isoformat(),
                        "amount": h.amount
                    })
        
        if duplicates:
            return CheckResult(
                rule_name=self.name,
                passed=False,
                message=f"检测到 {len(duplicates)} 个重复退款记录",
                checked_at=datetime.now(),
                details={"duplicates": duplicates}
            )
        
        return CheckResult(
            rule_name=self.name,
            passed=True,
            message="未发现重复退款",
            checked_at=datetime.now()
        )


class AmountInsufficientRule(BaseRule):
    name = "amount_insufficient_check"
    description = "检查退款金额是否超过实付金额"
    
    def check(self, request: RefundRequest, context: dict) -> CheckResult:
        payment: OrderPayment = context.get('payment')
        
        if not payment:
            return CheckResult(
                rule_name=self.name,
                passed=False,
                message=f"未找到订单 {request.order_id} 的支付记录",
                checked_at=datetime.now()
            )
        
        if request.amount <= 0:
            return CheckResult(
                rule_name=self.name,
                passed=False,
                message=f"退款金额必须大于 0，当前金额: {request.amount}",
                checked_at=datetime.now()
            )
        
        if request.amount > payment.amount:
            return CheckResult(
                rule_name=self.name,
                passed=False,
                message=f"退款金额 {request.amount} 超过实付金额 {payment.amount}",
                checked_at=datetime.now(),
                details={
                    "requested_amount": request.amount,
                    "paid_amount": payment.amount
                }
            )
        
        return CheckResult(
            rule_name=self.name,
            passed=True,
            message="退款金额未超过实付金额",
            checked_at=datetime.now()
        )


class BlacklistRule(BaseRule):
    name = "blacklist_check"
    description = "检查账户是否在黑名单中"
    
    def check(self, request: RefundRequest, context: dict) -> CheckResult:
        blacklist_item: BlacklistItem = context.get('blacklist_item')
        
        if blacklist_item:
            return CheckResult(
                rule_name=self.name,
                passed=False,
                message=f"账户 {request.user_account} 在黑名单中",
                checked_at=datetime.now(),
                details={
                    "account": request.user_account,
                    "reason": blacklist_item.reason,
                    "added_at": blacklist_item.added_at.isoformat(),
                    "added_by": blacklist_item.added_by
                }
            )
        
        return CheckResult(
            rule_name=self.name,
            passed=True,
            message="账户不在黑名单中",
            checked_at=datetime.now()
        )


class ApprovalExpiredRule(BaseRule):
    name = "approval_expired_check"
    description = "检查审批是否存在且未过期"
    
    def check(self, request: RefundRequest, context: dict) -> CheckResult:
        approval: ApprovalRecord = context.get('approval')
        now = datetime.now()
        
        if not approval:
            return CheckResult(
                rule_name=self.name,
                passed=False,
                message=f"未找到退款申请 {request.request_id} 的审批记录",
                checked_at=datetime.now()
            )
        
        if approval.status != ApprovalStatus.APPROVED:
            status_desc = {
                ApprovalStatus.PENDING: "待审批",
                ApprovalStatus.REJECTED: "已拒绝",
                ApprovalStatus.EXPIRED: "已过期"
            }.get(approval.status, approval.status)
            
            return CheckResult(
                rule_name=self.name,
                passed=False,
                message=f"审批状态为: {status_desc}",
                checked_at=datetime.now(),
                details={
                    "approval_id": approval.approval_id,
                    "status": approval.status,
                    "reason": approval.reason
                }
            )
        
        if approval.expires_at and now > approval.expires_at:
            return CheckResult(
                rule_name=self.name,
                passed=False,
                message=f"审批已于 {approval.expires_at} 过期",
                checked_at=datetime.now(),
                details={
                    "approval_id": approval.approval_id,
                    "expires_at": approval.expires_at.isoformat(),
                    "now": now.isoformat()
                }
            )
        
        if approval.amount < request.amount:
            return CheckResult(
                rule_name=self.name,
                passed=False,
                message=f"审批金额 {approval.amount} 小于申请退款金额 {request.amount}",
                checked_at=datetime.now(),
                details={
                    "approval_amount": approval.amount,
                    "requested_amount": request.amount
                }
            )
        
        return CheckResult(
            rule_name=self.name,
            passed=True,
            message="审批有效且未过期",
            checked_at=datetime.now()
        )


class PartialRefundExceededRule(BaseRule):
    name = "partial_refund_exceeded_check"
    description = "检查部分退款累计是否超额"
    
    def check(self, request: RefundRequest, context: dict) -> CheckResult:
        payment: OrderPayment = context.get('payment')
        historical_refunds: List[HistoricalRefund] = context.get('historical_refunds', [])
        
        if not payment:
            return CheckResult(
                rule_name=self.name,
                passed=False,
                message=f"未找到订单 {request.order_id} 的支付记录",
                checked_at=datetime.now()
            )
        
        historical_total = sum(
            h.amount for h in historical_refunds 
            if h.order_id == request.order_id and h.status == "success"
        )
        
        new_total = historical_total + request.amount
        
        if new_total > payment.amount:
            return CheckResult(
                rule_name=self.name,
                passed=False,
                message=f"部分退款累计 {new_total} 超过实付金额 {payment.amount}",
                checked_at=datetime.now(),
                details={
                    "historical_total": historical_total,
                    "requested_amount": request.amount,
                    "new_total": new_total,
                    "paid_amount": payment.amount,
                    "exceeded": new_total - payment.amount
                }
            )
        
        return CheckResult(
            rule_name=self.name,
            passed=True,
            message=f"部分退款累计 {new_total} 未超过实付金额 {payment.amount}",
            checked_at=datetime.now()
        )


class RulesEngine:
    def __init__(self):
        self.rules: List[BaseRule] = [
            DuplicateRefundRule(),
            AmountInsufficientRule(),
            BlacklistRule(),
            ApprovalExpiredRule(),
            PartialRefundExceededRule(),
        ]
    
    def get_rules(self) -> List[BaseRule]:
        return self.rules
    
    def execute(self, request: RefundRequest, context: dict) -> List[CheckResult]:
        results = []
        for rule in self.rules:
            result = rule.check(request, context)
            results.append(result)
        return results
    
    def determine_status(self, results: List[CheckResult]) -> RefundStatus:
        failed_results = [r for r in results if not r.passed]
        
        if not failed_results:
            return RefundStatus.APPROVED
        
        critical_rules = [
            "duplicate_refund_check",
            "blacklist_check",
            "amount_insufficient_check",
        ]
        
        has_critical_fail = any(
            r.rule_name in critical_rules 
            for r in failed_results
        )
        
        if has_critical_fail:
            return RefundStatus.BLOCKED
        
        return RefundStatus.REVIEW_REQUIRED
