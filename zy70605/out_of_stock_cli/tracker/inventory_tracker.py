from dataclasses import dataclass
from typing import Dict, List, Tuple

from ..models import (
    CompensationPlan,
    OrderItem,
    CompensationType,
    CompensationStatus,
)


@dataclass
class InventoryWriteBack:
    sku_id: str
    batch_id: str
    quantity: int
    order_id: str
    user_id: str
    compensation_type: CompensationType
    written: bool = False


class InventoryTracker:
    def __init__(self, orders: List[OrderItem]):
        self.orders = orders
        self.write_backs: List[InventoryWriteBack] = []
        self.inventory_changes: Dict[Tuple[str, str], int] = {}

    def calculate_write_backs(self, plans: List[CompensationPlan]) -> List[InventoryWriteBack]:
        self.write_backs = []
        self.inventory_changes.clear()

        sorted_plans = sorted(
            plans, key=lambda p: (p.batch_id, p.sku_id, p.order_id)
        )

        for plan in sorted_plans:
            if plan.status != CompensationStatus.PROCESSED:
                continue

            if plan.compensation_type in [
                CompensationType.REFUND,
                CompensationType.POINTS,
            ]:
                wb = InventoryWriteBack(
                    sku_id=plan.sku_id,
                    batch_id=plan.batch_id,
                    quantity=plan.quantity,
                    order_id=plan.order_id,
                    user_id=plan.user_id,
                    compensation_type=plan.compensation_type,
                    written=True,
                )
                self.write_backs.append(wb)

                key = (plan.batch_id, plan.sku_id)
                self.inventory_changes[key] = (
                    self.inventory_changes.get(key, 0) + plan.quantity
                )

        return self.write_backs

    def get_inventory_summary(self) -> Dict[str, int]:
        summary: Dict[str, int] = {
            "total_write_back": 0,
            "refund_write_back": 0,
            "points_write_back": 0,
            "affected_skus": len(self.inventory_changes),
        }

        for wb in self.write_backs:
            summary["total_write_back"] += wb.quantity
            if wb.compensation_type == CompensationType.REFUND:
                summary["refund_write_back"] += wb.quantity
            elif wb.compensation_type == CompensationType.POINTS:
                summary["points_write_back"] += wb.quantity

        return summary

    def get_sku_write_back_quantity(self, batch_id: str, sku_id: str) -> int:
        key = (batch_id, sku_id)
        return self.inventory_changes.get(key, 0)
