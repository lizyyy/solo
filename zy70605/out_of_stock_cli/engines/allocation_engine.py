from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Tuple

from ..models import (
    OrderItem,
    OutOfStockItem,
    CompensationPlan,
    CompensationType,
    CompensationStatus,
)
from ..utils import stable_hash


@dataclass
class AllocationResult:
    plans: List[CompensationPlan]
    summary: Dict[str, int]


class AllocationEngine:
    def __init__(
        self,
        orders: List[OrderItem],
        out_of_stocks: List[OutOfStockItem],
    ):
        self.orders = sorted(orders, key=lambda x: (x.batch_id, x.order_time, x.order_id))
        self.out_of_stocks = out_of_stocks
        self.oos_map: Dict[Tuple[str, str], OutOfStockItem] = {
            (oos.batch_id, oos.sku_id): oos for oos in out_of_stocks
        }

    def allocate(
        self,
        default_compensation_type: CompensationType = CompensationType.REFUND,
    ) -> AllocationResult:
        plans: List[CompensationPlan] = []

        grouped_orders = self._group_orders_by_batch_sku()

        for (batch_id, sku_id), orders in grouped_orders.items():
            oos_item = self.oos_map.get((batch_id, sku_id))
            if not oos_item or oos_item.shortage_quantity <= 0:
                continue

            shortage_allocations = self._calculate_allocation(orders, oos_item)

            for order in orders:
                shortage_qty = shortage_allocations.get(order.order_id, 0)
                if shortage_qty <= 0:
                    continue

                plan = self._create_compensation_plan(
                    order=order,
                    oos_item=oos_item,
                    quantity=shortage_qty,
                    compensation_type=default_compensation_type,
                )
                plans.append(plan)

        summary = self._generate_summary(plans)
        return AllocationResult(plans=plans, summary=summary)

    def _group_orders_by_batch_sku(self) -> Dict[Tuple[str, str], List[OrderItem]]:
        grouped: Dict[Tuple[str, str], List[OrderItem]] = {}
        for order in self.orders:
            key = (order.batch_id, order.sku_id)
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(order)
        return grouped

    def _calculate_allocation(
        self, orders: List[OrderItem], oos_item: OutOfStockItem
    ) -> Dict[str, int]:
        result: Dict[str, int] = {order.order_id: 0 for order in orders}

        total_ordered = sum(o.quantity for o in orders)
        if total_ordered <= oos_item.available_quantity:
            return result

        shortage_remaining = oos_item.shortage_quantity
        shortage_ratio = shortage_remaining / total_ordered

        order_with_share = []
        for order in orders:
            exact_share = order.quantity * shortage_ratio
            base_allocation = int(exact_share)
            fractional_part = exact_share - base_allocation

            result[order.order_id] = min(base_allocation, order.quantity)
            shortage_remaining -= result[order.order_id]

            if result[order.order_id] < order.quantity:
                order_with_share.append((order.order_id, fractional_part))

        order_with_share.sort(key=lambda x: -x[1])

        for order_id, _ in order_with_share:
            if shortage_remaining <= 0:
                break
            order = next(o for o in orders if o.order_id == order_id)
            if result[order_id] < order.quantity:
                result[order_id] += 1
                shortage_remaining -= 1

        return result

    def _create_compensation_plan(
        self,
        order: OrderItem,
        oos_item: OutOfStockItem,
        quantity: int,
        compensation_type: CompensationType,
    ) -> CompensationPlan:
        refund_amount = None
        exchange_sku_id = None
        exchange_sku_name = None
        points_amount = None

        if compensation_type == CompensationType.REFUND:
            refund_amount = round(order.unit_price * quantity, 2)
        elif compensation_type == CompensationType.POINTS:
            points_amount = int(order.unit_price * quantity * 100)

        plan_id_data = {
            "batch_id": order.batch_id,
            "order_id": order.order_id,
            "sku_id": order.sku_id,
            "quantity": quantity,
            "timestamp": oos_item.source_file,
        }
        plan_id = f"PLAN_{stable_hash(plan_id_data)}"

        return CompensationPlan(
            plan_id=plan_id,
            batch_id=order.batch_id,
            sku_id=order.sku_id,
            order_id=order.order_id,
            user_id=order.user_id,
            compensation_type=compensation_type,
            quantity=quantity,
            refund_amount=refund_amount,
            exchange_sku_id=exchange_sku_id,
            exchange_sku_name=exchange_sku_name,
            points_amount=points_amount,
            source_file=oos_item.source_file,
            source_row=oos_item.source_row,
            status=CompensationStatus.PENDING,
        )

    def _generate_summary(self, plans: List[CompensationPlan]) -> Dict[str, int]:
        summary: Dict[str, int] = {
            "total_plans": len(plans),
            "refund_count": 0,
            "exchange_count": 0,
            "points_count": 0,
            "total_quantity": 0,
        }

        for plan in plans:
            summary["total_quantity"] += plan.quantity
            if plan.compensation_type == CompensationType.REFUND:
                summary["refund_count"] += 1
            elif plan.compensation_type == CompensationType.EXCHANGE:
                summary["exchange_count"] += 1
            elif plan.compensation_type == CompensationType.POINTS:
                summary["points_count"] += 1

        return summary
