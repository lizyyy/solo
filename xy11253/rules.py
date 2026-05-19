from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from models import ShortageRecord, CompensationRecord, Coupon, ShortageStatus, CompensationStatus, CouponStatus
from schemas import RuleCheckResult, Role


class RuleEngine:
    def __init__(self, db: Session):
        self.db = db
        self.rules = {
            "partial_shortage": self._check_partial_shortage,
            "duplicate_compensation": self._check_duplicate_compensation,
            "coupon_expiry": self._check_coupon_expiry,
            "amount_consistency": self._check_amount_consistency,
            "status_transition": self._check_status_transition,
            "role_permission": self._check_role_permission,
        }

    def _check_partial_shortage(self, context: Dict[str, Any]) -> RuleCheckResult:
        shortage = context.get("shortage")
        if not shortage:
            return RuleCheckResult(
                passed=True,
                rule_code="partial_shortage",
                rule_name="部分缺货校验",
                reason="无缺货记录需校验"
            )

        if shortage.shortage_quantity < 0:
            return RuleCheckResult(
                passed=False,
                rule_code="partial_shortage",
                rule_name="部分缺货校验",
                reason="缺货数量不能为负数"
            )

        order_item = context.get("order_item")
        if order_item and shortage.shortage_quantity > order_item.quantity:
            return RuleCheckResult(
                passed=False,
                rule_code="partial_shortage",
                rule_name="部分缺货校验",
                reason=f"缺货数量({shortage.shortage_quantity})不能大于订购数量({order_item.quantity})"
            )

        return RuleCheckResult(
            passed=True,
            rule_code="partial_shortage",
            rule_name="部分缺货校验",
            reason="部分缺货校验通过"
        )

    def _check_duplicate_compensation(self, context: Dict[str, Any]) -> RuleCheckResult:
        shortage = context.get("shortage")
        if not shortage:
            return RuleCheckResult(
                passed=True,
                rule_code="duplicate_compensation",
                rule_name="重复补偿校验",
                reason="无缺货记录需校验"
            )

        compensation_type = context.get("compensation_type")
        if not compensation_type:
            return RuleCheckResult(
                passed=True,
                rule_code="duplicate_compensation",
                rule_name="重复补偿校验",
                reason="无补偿类型需校验"
            )

        existing = self.db.query(CompensationRecord).filter(
            CompensationRecord.shortage_id == shortage.id,
            CompensationRecord.compensation_type == compensation_type,
            CompensationRecord.status.in_([
                CompensationStatus.PENDING,
                CompensationStatus.APPROVED,
                CompensationStatus.PROCESSED
            ])
        ).first()

        if existing:
            return RuleCheckResult(
                passed=False,
                rule_code="duplicate_compensation",
                rule_name="重复补偿校验",
                reason=f"该缺货记录已存在相同类型的补偿(单号:{existing.compensation_no})，禁止重复补偿"
            )

        return RuleCheckResult(
            passed=True,
            rule_code="duplicate_compensation",
            rule_name="重复补偿校验",
            reason="重复补偿校验通过"
        )

    def _check_coupon_expiry(self, context: Dict[str, Any]) -> RuleCheckResult:
        coupon = context.get("coupon")
        if not coupon:
            return RuleCheckResult(
                passed=True,
                rule_code="coupon_expiry",
                rule_name="券过期校验",
                reason="无券需校验"
            )

        if coupon.status == CouponStatus.EXPIRED:
            return RuleCheckResult(
                passed=False,
                rule_code="coupon_expiry",
                rule_name="券过期校验",
                reason=f"券({coupon.coupon_no})已过期，过期时间:{coupon.expiry_date}"
            )

        if coupon.expiry_date < datetime.utcnow():
            return RuleCheckResult(
                passed=False,
                rule_code="coupon_expiry",
                rule_name="券过期校验",
                reason=f"券({coupon.coupon_no})已过期，过期时间:{coupon.expiry_date}"
            )

        return RuleCheckResult(
            passed=True,
            rule_code="coupon_expiry",
            rule_name="券过期校验",
            reason="券过期校验通过"
        )

    def _check_amount_consistency(self, context: Dict[str, Any]) -> RuleCheckResult:
        shortage = context.get("shortage")
        compensation = context.get("compensation")

        if not shortage or not compensation:
            return RuleCheckResult(
                passed=True,
                rule_code="amount_consistency",
                rule_name="金额一致性校验",
                reason="无需校验的数据"
            )

        if compensation.compensation_type in ["refund", "partial_refund"]:
            if compensation.amount > shortage.shortage_amount:
                return RuleCheckResult(
                    passed=False,
                    rule_code="amount_consistency",
                    rule_name="金额一致性校验",
                    reason=f"退款金额({compensation.amount})不能大于缺货金额({shortage.shortage_amount})"
                )
            if compensation.amount < 0:
                return RuleCheckResult(
                    passed=False,
                    rule_code="amount_consistency",
                    rule_name="金额一致性校验",
                    reason="退款金额不能为负数"
                )

        return RuleCheckResult(
            passed=True,
            rule_code="amount_consistency",
            rule_name="金额一致性校验",
            reason="金额一致性校验通过"
        )

    def _check_status_transition(self, context: Dict[str, Any]) -> RuleCheckResult:
        current_status = context.get("current_status")
        target_status = context.get("target_status")
        record_type = context.get("record_type", "shortage")

        if not current_status or not target_status:
            return RuleCheckResult(
                passed=True,
                rule_code="status_transition",
                rule_name="状态流转校验",
                reason="无需校验状态"
            )

        transitions = {
            "shortage": {
                ShortageStatus.IDENTIFIED: [ShortageStatus.CONFIRMED, ShortageStatus.CANCELLED],
                ShortageStatus.CONFIRMED: [ShortageStatus.COMPENSATED, ShortageStatus.CANCELLED],
                ShortageStatus.COMPENSATED: [ShortageStatus.SETTLED],
                ShortageStatus.CANCELLED: [],
                ShortageStatus.SETTLED: [],
            },
            "compensation": {
                CompensationStatus.PENDING: [CompensationStatus.APPROVED, CompensationStatus.FAILED],
                CompensationStatus.APPROVED: [CompensationStatus.PROCESSED, CompensationStatus.ROLLED_BACK],
                CompensationStatus.PROCESSED: [CompensationStatus.ROLLED_BACK],
                CompensationStatus.FAILED: [],
                CompensationStatus.ROLLED_BACK: [],
            }
        }

        allowed_transitions = transitions.get(record_type, {})
        allowed_targets = allowed_transitions.get(current_status, [])

        if target_status not in allowed_targets:
            return RuleCheckResult(
                passed=False,
                rule_code="status_transition",
                rule_name="状态流转校验",
                reason=f"状态流转不允许: {current_status.value} -> {target_status.value}"
            )

        return RuleCheckResult(
            passed=True,
            rule_code="status_transition",
            rule_name="状态流转校验",
            reason="状态流转校验通过"
        )

    def _check_role_permission(self, context: Dict[str, Any]) -> RuleCheckResult:
        role = context.get("operator_role")
        operation = context.get("operation")

        if not role or not operation:
            return RuleCheckResult(
                passed=True,
                rule_code="role_permission",
                rule_name="角色权限校验",
                reason="无需校验权限"
            )

        permissions = {
            Role.VIEWER: ["query", "export"],
            Role.CUSTOMER_SERVICE: ["query", "identify", "export"],
            Role.OPERATOR: ["query", "identify", "confirm", "compensate", "export", "import"],
            Role.FINANCE: ["query", "identify", "confirm", "compensate", "rollback", "settle", "export", "import"],
            Role.ADMIN: ["query", "identify", "confirm", "compensate", "rollback", "settle", "export", "import", "config"],
        }

        allowed_operations = permissions.get(role, [])
        if operation not in allowed_operations:
            return RuleCheckResult(
                passed=False,
                rule_code="role_permission",
                rule_name="角色权限校验",
                reason=f"角色{role.value}不允许执行{operation}操作"
            )

        return RuleCheckResult(
            passed=True,
            rule_code="role_permission",
            rule_name="角色权限校验",
            reason="角色权限校验通过"
        )

    def validate(self, context: Dict[str, Any], rule_codes: List[str] = None) -> List[RuleCheckResult]:
        results = []
        rules_to_run = rule_codes or list(self.rules.keys())

        for rule_code in rules_to_run:
            rule_func = self.rules.get(rule_code)
            if rule_func:
                results.append(rule_func(context))

        return results

    def has_blocking_rule(self, results: List[RuleCheckResult]) -> bool:
        return any(not r.passed for r in results)

    def get_blocking_reasons(self, results: List[RuleCheckResult]) -> List[str]:
        return [r.reason for r in results if not r.passed]
