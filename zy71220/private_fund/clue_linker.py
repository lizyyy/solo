"""
线索串联查询 - 把认购单、材料、冷静期、回访、流水、报告串起来
"""
from typing import List, Dict, Optional, Any
from collections import defaultdict
from .models import SubscriptionOrder, PaymentFlow, ConfirmReport


class ClueLinker:
    """线索串联器"""

    CLUE_KEYWORDS = {
        "认购单": ["order_no", "subscription_id"],
        "投资者材料": ["material_ids", "investor_id"],
        "冷静期": ["cool_off_id"],
        "回访录音": ["visit_id"],
        "打款流水": ["flow_id"],
        "确认报告": ["report_id"],
    }

    @classmethod
    def link_order(cls, order: SubscriptionOrder) -> Dict[str, Any]:
        """
        串联单个订单的所有线索
        同事交接时说的线索关键词都能在这里找到
        """
        related = order.get_related_ids()

        result = {
            "核心信息": {
                "订单号": order.order_no,
                "认购单ID": order.subscription_id,
                "投资者ID": order.investor_id,
                "投资者姓名": order.investor_name,
                "产品代码": order.product_code,
                "产品名称": order.product_name,
                "认购金额": order.subscription_amount,
                "订单状态": order.status.value,
            },
            "线索关联": {
                "认购单": {
                    "id": order.subscription_id,
                    "order_no": order.order_no,
                },
                "投资者材料": {
                    "investor_id": order.investor_id,
                    "material_ids": related.get("material_ids", []),
                    "material_count": len(order.materials),
                    "material_types": [m.material_type.value for m in order.materials],
                },
                "冷静期": {
                    "id": related.get("cool_off_id"),
                    "status": order.cool_off.status.value if order.cool_off else "无",
                    "is_locked": order.cool_off.is_locked if order.cool_off else False,
                } if order.cool_off else {"id": None, "status": "无冷静期记录"},
                "回访录音": {
                    "id": related.get("visit_id"),
                    "status": order.visit.status.value if order.visit else "无",
                    "record_file": order.visit.record_file_path if order.visit else None,
                } if order.visit else {"id": None, "status": "无回访记录"},
                "打款流水": {
                    "id": related.get("flow_id"),
                    "amount": order.payment.amount if order.payment else None,
                    "is_matched": order.payment.is_matched if order.payment else False,
                } if order.payment else {"id": None, "status": "无打款流水"},
                "确认报告": {
                    "id": related.get("report_id"),
                    "file_path": order.report.file_path if order.report else None,
                    "is_exported": order.report.is_exported if order.report else False,
                } if order.report else {"id": None, "status": "无确认报告"},
            },
            "问题清单": {
                "错误": order.error_details,
                "警告": order.warnings,
            }
        }

        return result

    @classmethod
    def link_by_keyword(cls, orders: List[SubscriptionOrder],
                        keyword: str, value: str) -> List[Dict[str, Any]]:
        """
        通过线索关键词查询关联订单
        支持的关键词：认购单、投资者材料、冷静期、回访录音、打款流水、确认报告
        """
        results = []
        for order in orders:
            linked = cls.link_order(order)
            clues = linked["线索关联"]

            if keyword == "认购单":
                if value in [order.order_no, order.subscription_id]:
                    results.append(linked)
            elif keyword == "投资者材料":
                if value == order.investor_id or value in [m.material_id for m in order.materials]:
                    results.append(linked)
            elif keyword == "冷静期":
                if order.cool_off and value == order.cool_off.cool_off_id:
                    results.append(linked)
            elif keyword == "回访录音":
                if order.visit and value in [order.visit.visit_id, order.visit.record_file_path]:
                    results.append(linked)
            elif keyword == "打款流水":
                if order.payment and value in [order.payment.flow_id, order.payment.pay_account]:
                    results.append(linked)
            elif keyword == "确认报告":
                if order.report and value in [order.report.report_id, order.report.file_path]:
                    results.append(linked)

        return results

    @classmethod
    def link_batch(cls, orders: List[SubscriptionOrder]) -> List[Dict[str, Any]]:
        """批量串联所有订单线索"""
        return [cls.link_order(order) for order in orders]

    @classmethod
    def get_investor_clues(cls, orders: List[SubscriptionOrder],
                           investor_id: str) -> Dict[str, Any]:
        """按投资者维度串联所有线索"""
        investor_orders = [o for o in orders if o.investor_id == investor_id]
        if not investor_orders:
            return {"investor_id": investor_id, "found": False}

        first = investor_orders[0]
        all_materials = []
        all_cool_offs = []
        all_visits = []
        all_payments = []
        all_reports = []

        for order in investor_orders:
            all_materials.extend(order.materials)
            if order.cool_off:
                all_cool_offs.append(order.cool_off)
            if order.visit:
                all_visits.append(order.visit)
            if order.payment:
                all_payments.append(order.payment)
            if order.report:
                all_reports.append(order.report)

        return {
            "investor_id": investor_id,
            "investor_name": first.investor_name,
            "found": True,
            "order_count": len(investor_orders),
            "orders": [o.order_no for o in investor_orders],
            "material_count": len(all_materials),
            "cool_off_count": len(all_cool_offs),
            "visit_count": len(all_visits),
            "payment_count": len(all_payments),
            "report_count": len(all_reports),
            "details": [cls.link_order(o) for o in investor_orders],
        }
