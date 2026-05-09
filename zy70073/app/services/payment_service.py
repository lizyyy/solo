from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, List

from sqlalchemy.orm import Session

from app.models.enums import PaymentStatus
from app.models.models import Contract, PaymentNode
from app.schemas.schemas import PaymentNodeCreate, PaymentNodeUpdate


class PaymentService:
    def __init__(self, db: Session):
        self.db = db

    def create_payment_node(self, data: PaymentNodeCreate) -> Optional[PaymentNode]:
        contract = self.db.query(Contract).filter(Contract.id == data.contract_id).first()
        if not contract:
            return None

        payment_node = PaymentNode(
            contract_id=data.contract_id,
            node_name=data.node_name,
            plan_payment_date=data.plan_payment_date,
            plan_amount=data.plan_amount,
            payment_ratio=data.payment_ratio,
            status=PaymentStatus.PENDING,
            remarks=data.remarks,
        )
        self.db.add(payment_node)
        self.db.commit()
        self.db.refresh(payment_node)
        return payment_node

    def get_payment_node(self, node_id: int) -> Optional[PaymentNode]:
        return self.db.query(PaymentNode).filter(PaymentNode.id == node_id).first()

    def list_payment_nodes(self, contract_id: Optional[int] = None) -> List[PaymentNode]:
        query = self.db.query(PaymentNode)
        if contract_id:
            query = query.filter(PaymentNode.contract_id == contract_id)
        return query.order_by(PaymentNode.plan_payment_date).all()

    def update_payment_node(self, node_id: int, data: PaymentNodeUpdate) -> Optional[PaymentNode]:
        node = self.get_payment_node(node_id)
        if not node:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(node, key, value)

        self.db.commit()
        self.db.refresh(node)
        return node

    def record_payment(
        self, node_id: int, actual_payment_date: date, actual_amount: Decimal
    ) -> Optional[PaymentNode]:
        node = self.get_payment_node(node_id)
        if not node:
            return None

        node.actual_payment_date = actual_payment_date
        node.actual_amount = actual_amount

        if actual_amount >= node.plan_amount:
            node.status = PaymentStatus.PAID
        elif actual_amount > Decimal("0"):
            node.status = PaymentStatus.PARTIALLY_PAID

        self.db.commit()
        self.db.refresh(node)
        return node

    def update_status(self, node_id: int, new_status: PaymentStatus) -> Optional[PaymentNode]:
        node = self.get_payment_node(node_id)
        if not node:
            return None
        node.status = new_status
        self.db.commit()
        self.db.refresh(node)
        return node

    def refresh_payment_statuses(self, reference_date: Optional[date] = None) -> int:
        ref_date = reference_date or date.today()
        count = 0

        pending_nodes = self.db.query(PaymentNode).filter(
            PaymentNode.status.in_([PaymentStatus.PENDING, PaymentStatus.DUE])
        ).all()

        for node in pending_nodes:
            if node.plan_payment_date < ref_date:
                node.status = PaymentStatus.OVERDUE
                count += 1
            elif (node.plan_payment_date - ref_date).days <= 7:
                node.status = PaymentStatus.DUE
                count += 1

        self.db.commit()
        return count

    def get_overdue_payments(self, reference_date: Optional[date] = None) -> List[PaymentNode]:
        ref_date = reference_date or date.today()
        return (
            self.db.query(PaymentNode)
            .filter(
                PaymentNode.status == PaymentStatus.OVERDUE,
            )
            .all()
        )

    def get_upcoming_payments(
        self, days_before: int = 7, reference_date: Optional[date] = None
    ) -> List[PaymentNode]:
        ref_date = reference_date or date.today()
        end_date = ref_date + timedelta(days=days_before)

        return (
            self.db.query(PaymentNode)
            .filter(
                PaymentNode.status.in_([PaymentStatus.PENDING, PaymentStatus.DUE]),
                PaymentNode.plan_payment_date >= ref_date,
                PaymentNode.plan_payment_date <= end_date,
            )
            .all()
        )
