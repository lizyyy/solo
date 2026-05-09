from decimal import Decimal
from typing import Optional, List

from sqlalchemy.orm import Session

from app.models.enums import AcceptanceResult, DeliveryStatus
from app.models.models import AcceptanceReceipt, DeliveryPlan
from app.schemas.schemas import AcceptanceReceiptCreate, AcceptanceReceiptUpdate


class AcceptanceService:
    def __init__(self, db: Session):
        self.db = db

    def create_acceptance(self, data: AcceptanceReceiptCreate) -> Optional[AcceptanceReceipt]:
        delivery_plan = self.db.query(DeliveryPlan).filter(
            DeliveryPlan.id == data.delivery_plan_id
        ).first()
        if not delivery_plan:
            return None

        if delivery_plan.acceptance is not None:
            return None

        acceptance = AcceptanceReceipt(
            delivery_plan_id=data.delivery_plan_id,
            receipt_no=data.receipt_no,
            acceptance_date=data.acceptance_date,
            accepted_quantity=data.accepted_quantity,
            rejected_quantity=data.rejected_quantity,
            accepted_amount=data.accepted_amount,
            rejected_amount=data.rejected_amount,
            result=data.result,
            quality_issue_rate=data.quality_issue_rate,
            rejection_reason=data.rejection_reason,
        )

        self.db.add(acceptance)

        if data.result == AcceptanceResult.ACCEPTED:
            delivery_plan.status = DeliveryStatus.ACCEPTED
        elif data.result == AcceptanceResult.PARTIAL_ACCEPTED:
            delivery_plan.status = DeliveryStatus.PARTIAL_ACCEPTED
        elif data.result == AcceptanceResult.REJECTED:
            delivery_plan.status = DeliveryStatus.REJECTED

        self.db.commit()
        self.db.refresh(acceptance)
        return acceptance

    def get_acceptance(self, acceptance_id: int) -> Optional[AcceptanceReceipt]:
        return self.db.query(AcceptanceReceipt).filter(AcceptanceReceipt.id == acceptance_id).first()

    def get_acceptance_by_delivery(self, delivery_plan_id: int) -> Optional[AcceptanceReceipt]:
        return self.db.query(AcceptanceReceipt).filter(
            AcceptanceReceipt.delivery_plan_id == delivery_plan_id
        ).first()

    def list_acceptances(self, contract_id: Optional[int] = None) -> List[AcceptanceReceipt]:
        query = self.db.query(AcceptanceReceipt)
        if contract_id:
            query = query.join(DeliveryPlan).filter(DeliveryPlan.contract_id == contract_id)
        return query.order_by(AcceptanceReceipt.created_at.desc()).all()

    def update_acceptance(
        self, acceptance_id: int, data: AcceptanceReceiptUpdate
    ) -> Optional[AcceptanceReceipt]:
        acceptance = self.get_acceptance(acceptance_id)
        if not acceptance:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(acceptance, key, value)

        delivery_plan = acceptance.delivery_plan
        if delivery_plan:
            if acceptance.result == AcceptanceResult.ACCEPTED:
                delivery_plan.status = DeliveryStatus.ACCEPTED
            elif acceptance.result == AcceptanceResult.PARTIAL_ACCEPTED:
                delivery_plan.status = DeliveryStatus.PARTIAL_ACCEPTED
            elif acceptance.result == AcceptanceResult.REJECTED:
                delivery_plan.status = DeliveryStatus.REJECTED

        self.db.commit()
        self.db.refresh(acceptance)
        return acceptance

    def get_rejected_acceptances(self) -> List[AcceptanceReceipt]:
        return (
            self.db.query(AcceptanceReceipt)
            .filter(AcceptanceReceipt.result == AcceptanceResult.REJECTED)
            .all()
        )

    def get_quality_issue_acceptances(self, min_rate: Decimal = Decimal("0.05")) -> List[AcceptanceReceipt]:
        return (
            self.db.query(AcceptanceReceipt)
            .filter(AcceptanceReceipt.quality_issue_rate >= min_rate)
            .all()
        )
