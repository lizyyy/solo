from typing import Tuple
from app.models import Order, ItemStatus, SuggestedAction


def reconcile_deposit_refund(
    order: Order,
    utility_cost: float,
    damage_cost: float,
    other_deductions: float = 0
) -> Tuple[ItemStatus, SuggestedAction, str, float, float]:
    total_deductions = utility_cost + damage_cost + other_deductions
    expected_refund = max(0.0, order.deposit_amount - total_deductions)
    actual_refund = order.actual_deposit_refund if order.actual_deposit_refund is not None else expected_refund
    difference = round(actual_refund - expected_refund, 2)
    
    reasons = []
    status = ItemStatus.NORMAL
    action = SuggestedAction.APPROVE
    
    if abs(difference) > 0.01:
        if difference > 0:
            reasons.append(f"退款冲正: 多退了{difference:.2f}元(应退{expected_refund:.2f}元，实退{actual_refund:.2f}元)")
            status = ItemStatus.PENDING
            action = SuggestedAction.RECALCULATE
        else:
            reasons.append(f"退款冲正: 少退了{abs(difference):.2f}元(应退{expected_refund:.2f}元，实退{actual_refund:.2f}元)")
            status = ItemStatus.FAILED
            action = SuggestedAction.RECALCULATE
    
    if expected_refund < 0:
        reasons.append(f"扣款超出押金{abs(expected_refund):.2f}元，需向客人追缴")
        status = ItemStatus.PENDING
        action = SuggestedAction.MANUAL_REVIEW
    
    if not reasons:
        reasons.append(f"退款计算正确: 押金{order.deposit_amount:.2f}元 - 扣款{total_deductions:.2f}元 = 应退{expected_refund:.2f}元")
    
    return status, action, "; ".join(reasons), expected_refund, actual_refund
