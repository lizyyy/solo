"""
重复认购拦截 - 同投资者多单检测
"""
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Any
from collections import defaultdict
from .models import SubscriptionOrder, SubscriptionStatus, CoolOffStatus


class DuplicateSubscriptionGuard:
    """重复认购拦截器"""

    def __init__(self, check_window_days: int = 30):
        self.check_window_days = check_window_days

    def check_duplicate(self, new_order: SubscriptionOrder,
                        existing_orders: List[SubscriptionOrder]) -> Tuple[bool, List[str], List[SubscriptionOrder]]:
        """
        检查重复认购
        返回: (是否重复, 错误详情列表, 重复的订单列表)
        """
        errors: List[str] = []
        duplicates: List[SubscriptionOrder] = []

        if not new_order.investor_id:
            errors.append("投资者ID为空，无法进行重复认购校验")
            return bool(errors), errors, duplicates

        cutoff_time = datetime.now() - timedelta(days=self.check_window_days)

        for existing in existing_orders:
            if existing.subscription_id == new_order.subscription_id:
                continue

            if existing.investor_id != new_order.investor_id:
                continue

            if existing.product_code != new_order.product_code:
                continue

            if existing.submit_time and existing.submit_time < cutoff_time:
                continue

            if existing.status in [SubscriptionStatus.REJECTED]:
                continue

            duplicates.append(existing)
            status_desc = self._format_duplicate_error(new_order, existing)
            errors.append(status_desc)

        return bool(errors), errors, duplicates

    def _format_duplicate_error(self, new_order: SubscriptionOrder,
                                existing: SubscriptionOrder) -> str:
        """格式化重复认购错误信息"""
        submit_str = existing.submit_time.strftime('%Y-%m-%d %H:%M:%S') if existing.submit_time else "未知"
        amount_str = f"{existing.subscription_amount:,.2f}元" if existing.subscription_amount else "未知金额"

        cool_off_status = ""
        if existing.cool_off:
            cool_off_status = f"，冷静期状态：{existing.cool_off.status.value}"

        return (
            f"发现重复认购：投资者[{existing.investor_name}](ID:{existing.investor_id}) "
            f"在产品[{existing.product_code}]下已有认购单 "
            f"[订单号:{existing.order_no}, 金额:{amount_str}, 提交时间:{submit_str}, "
            f"状态:{existing.status.value}{cool_off_status}]"
        )

    def batch_check(self, orders: List[SubscriptionOrder]) -> Dict[str, Any]:
        """
        批量检查重复认购
        返回按投资者分组的重复检测结果
        """
        investor_orders: Dict[str, List[SubscriptionOrder]] = defaultdict(list)
        for order in orders:
            if order.investor_id:
                investor_orders[order.investor_id].append(order)

        result = {
            "clean": [],
            "has_duplicate": [],
            "duplicate_groups": []
        }

        for investor_id, order_list in investor_orders.items():
            if len(order_list) == 1:
                result["clean"].extend(order_list)
                continue

            product_groups: Dict[str, List[SubscriptionOrder]] = defaultdict(list)
            for order in order_list:
                product_groups[order.product_code].append(order)

            for product_code, product_orders in product_groups.items():
                if len(product_orders) > 1:
                    result["has_duplicate"].extend(product_orders)
                    result["duplicate_groups"].append({
                        "investor_id": investor_id,
                        "investor_name": product_orders[0].investor_name,
                        "product_code": product_code,
                        "count": len(product_orders),
                        "orders": [self._order_summary(o) for o in product_orders]
                    })
                else:
                    result["clean"].extend(product_orders)

        return result

    def _order_summary(self, order: SubscriptionOrder) -> Dict[str, Any]:
        """订单摘要信息"""
        return {
            "subscription_id": order.subscription_id,
            "order_no": order.order_no,
            "subscription_amount": order.subscription_amount,
            "submit_time": order.submit_time.strftime('%Y-%m-%d %H:%M:%S') if order.submit_time else None,
            "status": order.status.value,
            "cool_off_status": order.cool_off.status.value if order.cool_off else None,
            "errors": order.error_details,
        }
