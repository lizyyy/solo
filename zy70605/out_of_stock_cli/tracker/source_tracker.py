from dataclasses import dataclass
from typing import Dict, List, Any, Optional
from datetime import datetime

from ..models import (
    Batch,
    OrderItem,
    OutOfStockItem,
    CompensationPlan,
    UserConfirmation,
    SettlementRecord,
)


@dataclass
class SourceTrail:
    batch_id: str
    order_id: str
    sku_id: str
    user_id: str
    batch_source: Dict[str, Any]
    order_source: Dict[str, Any]
    oos_source: Dict[str, Any]
    plan_source: Dict[str, Any]
    confirmation_source: Optional[Dict[str, Any]]
    created_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "order_id": self.order_id,
            "sku_id": self.sku_id,
            "user_id": self.user_id,
            "batch_source_file": self.batch_source.get("file", ""),
            "batch_source_row": self.batch_source.get("row", 0),
            "order_source_file": self.order_source.get("file", ""),
            "order_source_row": self.order_source.get("row", 0),
            "oos_source_file": self.oos_source.get("file", ""),
            "oos_source_row": self.oos_source.get("row", 0),
            "plan_source_file": self.plan_source.get("file", ""),
            "plan_source_row": self.plan_source.get("row", 0),
            "confirmation_source_file": self.confirmation_source.get("file", "")
            if self.confirmation_source
            else "",
            "confirmation_source_row": self.confirmation_source.get("row", 0)
            if self.confirmation_source
            else 0,
            "created_at": self.created_at.isoformat(),
        }


class SourceTracker:
    def __init__(
        self,
        batches: List[Batch],
        orders: List[OrderItem],
        out_of_stocks: List[OutOfStockItem],
    ):
        self.batches = batches
        self.orders = orders
        self.out_of_stocks = out_of_stocks
        self.trails: List[SourceTrail] = []

        self.batch_map = {b.batch_id: b for b in batches}
        self.order_map = {o.order_id: o for o in orders}
        self.oos_map = {(o.batch_id, o.sku_id): o for o in out_of_stocks}

    def create_trail(
        self,
        plan: CompensationPlan,
        confirmation: Optional[UserConfirmation] = None,
    ) -> SourceTrail:
        batch = self.batch_map.get(plan.batch_id)
        order = self.order_map.get(plan.order_id)
        oos = self.oos_map.get((plan.batch_id, plan.sku_id))

        trail = SourceTrail(
            batch_id=plan.batch_id,
            order_id=plan.order_id,
            sku_id=plan.sku_id,
            user_id=plan.user_id,
            batch_source={
                "file": batch.source_file if batch else "",
                "row": batch.source_row if batch else 0,
            },
            order_source={
                "file": order.source_file if order else "",
                "row": order.source_row if order else 0,
            },
            oos_source={
                "file": oos.source_file if oos else "",
                "row": oos.source_row if oos else 0,
            },
            plan_source={
                "file": plan.source_file,
                "row": plan.source_row,
                "plan_id": plan.plan_id,
            },
            confirmation_source={
                "file": confirmation.source_file if confirmation else "",
                "row": confirmation.source_row if confirmation else 0,
                "confirmation_id": confirmation.confirmation_id if confirmation else "",
            }
            if confirmation
            else None,
            created_at=datetime.now(),
        )

        self.trails.append(trail)
        return trail

    def get_trails_for_order(self, order_id: str) -> List[SourceTrail]:
        return [t for t in self.trails if t.order_id == order_id]

    def get_trails_for_sku(self, batch_id: str, sku_id: str) -> List[SourceTrail]:
        return [t for t in self.trails if t.batch_id == batch_id and t.sku_id == sku_id]

    def get_all_trails(self) -> List[Dict[str, Any]]:
        sorted_trails = sorted(
            self.trails, key=lambda t: (t.batch_id, t.order_id, t.sku_id)
        )
        return [trail.to_dict() for trail in sorted_trails]
