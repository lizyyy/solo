from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from typing import List, Optional
from app.models import ReplenishmentOrder, Material
from app.schemas import (
    ReplenishmentOrderCreate,
    ReplenishmentOrderUpdate,
    ReplenishmentStatusUpdate,
)
from app.utils.common import generate_order_no


class ReplenishmentService:
    VALID_STATUSES = ["pending", "approved", "processing", "shipped", "received", "cancelled"]
    STATUS_TRANSITIONS = {
        "pending": ["approved", "cancelled"],
        "approved": ["processing", "cancelled"],
        "processing": ["shipped", "cancelled"],
        "shipped": ["received", "cancelled"],
        "received": [],
        "cancelled": []
    }

    def __init__(self, db: Session):
        self.db = db

    def can_transition_status(self, current_status: str, new_status: str) -> bool:
        if current_status not in self.STATUS_TRANSITIONS:
            return False
        return new_status in self.STATUS_TRANSITIONS[current_status]

    def get_allowed_statuses(self, current_status: str) -> List[str]:
        return self.STATUS_TRANSITIONS.get(current_status, [])

    def create_order(self, order_data: ReplenishmentOrderCreate) -> ReplenishmentOrder:
        order_no = generate_order_no("RO")

        db_order = ReplenishmentOrder(
            order_no=order_no,
            store_id=order_data.store_id,
            material_id=order_data.material_id,
            quantity=order_data.quantity,
            status="pending",
            priority=order_data.priority,
            estimated_arrival=order_data.estimated_arrival,
            remarks=order_data.remarks,
            created_by=order_data.created_by
        )

        self.db.add(db_order)
        self.db.commit()
        self.db.refresh(db_order)
        return db_order

    def update_order(self, order_id: int, update_data: ReplenishmentOrderUpdate) -> Optional[ReplenishmentOrder]:
        order = self.db.query(ReplenishmentOrder).filter(ReplenishmentOrder.id == order_id).first()
        if not order:
            return None

        if order.status not in ["pending", "approved"]:
            raise ValueError(f"无法修改状态为 {order.status} 的订单")

        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(order, field, value)

        order.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(order)
        return order

    def update_status(self, order_id: int, status_data: ReplenishmentStatusUpdate) -> Optional[ReplenishmentOrder]:
        order = self.db.query(ReplenishmentOrder).filter(ReplenishmentOrder.id == order_id).first()
        if not order:
            return None

        new_status = status_data.status.lower()

        if new_status not in self.VALID_STATUSES:
            raise ValueError(f"无效的状态: {new_status}")

        if not self.can_transition_status(order.status, new_status):
            allowed = self.get_allowed_statuses(order.status)
            raise ValueError(f"状态 {order.status} 无法转换为 {new_status}, 允许的状态: {allowed}")

        if order.need_manual_review == 1 and order.status == "pending" and new_status != "cancelled":
            raise ValueError("该订单需要人工复核，无法直接处理")

        order.status = new_status
        if status_data.actual_arrival:
            order.actual_arrival = status_data.actual_arrival
        order.updated_at = datetime.utcnow()

        if new_status == "received":
            material = self.db.query(Material).filter(Material.id == order.material_id).first()
            if material:
                material.current_stock += order.quantity

        self.db.commit()
        self.db.refresh(order)
        return order

    def mark_for_review(self, order_id: int, review_reason: str) -> Optional[ReplenishmentOrder]:
        order = self.db.query(ReplenishmentOrder).filter(ReplenishmentOrder.id == order_id).first()
        if not order:
            return None

        order.need_manual_review = 1
        order.review_reason = review_reason
        order.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(order)
        return order

    def approve_after_review(self, order_id: int, approved_by: str) -> Optional[ReplenishmentOrder]:
        order = self.db.query(ReplenishmentOrder).filter(ReplenishmentOrder.id == order_id).first()
        if not order:
            return None

        if order.need_manual_review != 1:
            raise ValueError("该订单不需要复核")

        order.need_manual_review = 0
        order.status = "approved"
        order.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(order)
        return order

    def get_order(self, order_id: int) -> Optional[ReplenishmentOrder]:
        return self.db.query(ReplenishmentOrder).filter(ReplenishmentOrder.id == order_id).first()

    def get_orders_by_store(self, store_id: int, status: Optional[str] = None) -> List[ReplenishmentOrder]:
        query = self.db.query(ReplenishmentOrder).filter(ReplenishmentOrder.store_id == store_id)
        if status:
            query = query.filter(ReplenishmentOrder.status == status)
        return query.order_by(ReplenishmentOrder.created_at.desc()).all()
