from abc import ABC, abstractmethod
from typing import List, Dict, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import Order, ReviewLog


class RuleResult:
    def __init__(self, is_pass: bool, reason: str, detail: str = ""):
        self.is_pass = is_pass
        self.reason = reason
        self.detail = detail


class BaseRule(ABC):
    name: str
    rule_type: str

    @abstractmethod
    def validate(self, order: Order, db: Session) -> RuleResult:
        pass


class PartialStockoutRule(BaseRule):
    name = "部分缺货校验"
    rule_type = "stockout"

    def validate(self, order: Order, db: Session) -> RuleResult:
        if order.actual_quantity is None:
            return RuleResult(
                is_pass=False,
                reason="实际发货数量缺失",
                detail=f"订单号: {order.order_no}，必须填写实际发货数量才能进行缺货校验"
            )

        if order.actual_quantity > order.order_quantity:
            return RuleResult(
                is_pass=False,
                reason="实际发货数量超过订购数量",
                detail=f"订单号: {order.order_no}，订购数量: {order.order_quantity}，实际发货: {order.actual_quantity}"
            )

        shortage_qty = order.order_quantity - order.actual_quantity

        if shortage_qty == 0:
            return RuleResult(
                is_pass=True,
                reason="无缺货情况",
                detail=f"订单号: {order.order_no}，订购数量与实际发货一致"
            )

        if shortage_qty > 0:
            if order.compensation_type is None:
                return RuleResult(
                    is_pass=False,
                    reason="存在缺货但未选择补偿方式",
                    detail=f"订单号: {order.order_no}，缺货数量: {shortage_qty}，必须选择退款/换货/补券中的一种补偿方式"
                )

            if order.compensation_amount is None or order.compensation_amount <= 0:
                return RuleResult(
                    is_pass=False,
                    reason="补偿金额缺失或无效",
                    detail=f"订单号: {order.order_no}，缺货数量: {shortage_qty}，补偿方式: {order.compensation_type}，但补偿金额无效"
                )

            shortage_amount = (order.order_amount / order.order_quantity) * shortage_qty
            if order.compensation_amount > shortage_amount * 1.5:
                return RuleResult(
                    is_pass=False,
                    reason="补偿金额异常偏高",
                    detail=f"订单号: {order.order_no}，缺货金额约: {shortage_amount:.2f}，补偿金额: {order.compensation_amount}，超过缺货金额的150%，需人工复核"
                )

            return RuleResult(
                is_pass=True,
                reason=f"部分缺货处理合规",
                detail=f"订单号: {order.order_no}，缺货数量: {shortage_qty}，补偿方式: {order.compensation_type}，补偿金额: {order.compensation_amount}"
            )

        return RuleResult(is_pass=True, reason="校验通过", detail="")


class DuplicateCompensationRule(BaseRule):
    name = "重复补偿校验"
    rule_type = "duplicate"

    def validate(self, order: Order, db: Session) -> RuleResult:
        if order.compensation_type is None or order.compensation_amount is None:
            return RuleResult(
                is_pass=True,
                reason="无补偿记录",
                detail="该订单没有补偿记录，跳过重复补偿校验"
            )

        duplicate_orders = db.query(Order).filter(
            Order.customer_phone == order.customer_phone,
            Order.product_sku == order.product_sku,
            Order.id != order.id,
            Order.compensation_type.isnot(None),
            Order.created_at >= (datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0))
        ).all()

        if duplicate_orders:
            duplicate_nos = [o.order_no for o in duplicate_orders]
            return RuleResult(
                is_pass=False,
                reason="疑似重复补偿",
                detail=f"同一客户({order.customer_phone})同一商品({order.product_sku})今日内已有补偿记录，订单号: {', '.join(duplicate_nos)}"
            )

        return RuleResult(
            is_pass=True,
            reason="无重复补偿",
            detail=f"客户 {order.customer_phone} 商品 {order.product_sku} 今日内无重复补偿记录"
        )


class CouponExpireRule(BaseRule):
    name = "券过期校验"
    rule_type = "coupon"

    def validate(self, order: Order, db: Session) -> RuleResult:
        if order.compensation_type != "coupon":
            return RuleResult(
                is_pass=True,
                reason="非券补偿",
                detail="补偿方式不是优惠券，跳过券过期校验"
            )

        if not order.coupon_code:
            return RuleResult(
                is_pass=False,
                reason="券补偿但无券码",
                detail=f"订单号: {order.order_no}，选择了券补偿但未填写优惠券代码"
            )

        if order.coupon_expire_date is None:
            return RuleResult(
                is_pass=False,
                reason="券补偿但无过期时间",
                detail=f"订单号: {order.order_no}，优惠券 {order.coupon_code} 缺少过期时间"
            )

        if order.coupon_expire_date < datetime.utcnow():
            return RuleResult(
                is_pass=False,
                reason="优惠券已过期",
                detail=f"订单号: {order.order_no}，优惠券 {order.coupon_code} 过期时间: {order.coupon_expire_date.strftime('%Y-%m-%d')}，当前已过期"
            )

        days_until_expire = (order.coupon_expire_date - datetime.utcnow()).days
        if days_until_expire < 7:
            return RuleResult(
                is_pass=False,
                reason="优惠券即将过期",
                detail=f"订单号: {order.order_no}，优惠券 {order.coupon_code} 将在 {days_until_expire} 天后过期，有效期不足7天，建议更换"
            )

        return RuleResult(
            is_pass=True,
            reason="优惠券有效",
            detail=f"订单号: {order.order_no}，优惠券 {order.coupon_code} 有效期至 {order.coupon_expire_date.strftime('%Y-%m-%d')}，剩余 {days_until_expire} 天"
        )


class BillConsistencyRule(BaseRule):
    name = "账单一致性校验"
    rule_type = "consistency"

    def validate(self, order: Order, db: Session) -> RuleResult:
        if order.actual_quantity is None or order.actual_amount is None:
            return RuleResult(
                is_pass=True,
                reason="缺少实际数据",
                detail="缺少实际发货数量或金额，跳过账单一致性校验"
            )

        if order.actual_quantity == 0 and order.actual_amount > 0:
            return RuleResult(
                is_pass=False,
                reason="账单不一致：零发货有金额",
                detail=f"订单号: {order.order_no}，实际发货数量为0，但实际金额为 {order.actual_amount}，数据异常"
            )

        if order.actual_quantity > 0 and order.actual_amount == 0:
            return RuleResult(
                is_pass=False,
                reason="账单不一致：有发货零金额",
                detail=f"订单号: {order.order_no}，实际发货数量为 {order.actual_quantity}，但实际金额为0，数据异常"
            )

        unit_price = order.order_amount / order.order_quantity
        expected_actual_amount = unit_price * order.actual_quantity
        diff = abs(order.actual_amount - expected_actual_amount)

        if diff > expected_actual_amount * 0.1:
            return RuleResult(
                is_pass=False,
                reason="账单金额偏差过大",
                detail=f"订单号: {order.order_no}，按单价计算期望金额: {expected_actual_amount:.2f}，实际金额: {order.actual_amount}，偏差超过10%"
            )

        return RuleResult(
            is_pass=True,
            reason="账单数据一致",
            detail=f"订单号: {order.order_no}，实际发货与金额匹配，偏差在允许范围内"
        )


class RuleEngine:
    def __init__(self):
        self.rules: List[BaseRule] = [
            PartialStockoutRule(),
            DuplicateCompensationRule(),
            CouponExpireRule(),
            BillConsistencyRule()
        ]

    def add_rule(self, rule: BaseRule):
        self.rules.append(rule)

    def process_order(self, order: Order, db: Session, operator: str = None) -> Tuple[bool, List[ReviewLog]]:
        all_pass = True
        review_logs = []

        for rule in self.rules:
            result = rule.validate(order, db)

            if not result.is_pass:
                all_pass = False

            log = ReviewLog(
                order_id=order.id,
                rule_name=rule.name,
                rule_type=rule.rule_type,
                is_pass=result.is_pass,
                reason=result.reason,
                detail=result.detail,
                operator=operator
            )
            review_logs.append(log)

        return all_pass, review_logs

    def get_rule_types(self) -> List[str]:
        return list(set([rule.rule_type for rule in self.rules]))


rule_engine = RuleEngine()
