from datetime import date
from decimal import Decimal
from typing import Optional, List

from sqlalchemy.orm import Session

from app.models.enums import DeliveryStatus
from app.models.models import Contract, DeliveryPlan
from app.schemas.schemas import DeliveryPlanCreate, DeliveryPlanUpdate, FulfillmentRecordCreate


class DeliveryService:
    def __init__(self, db: Session):
        self.db = db

    def create_delivery_plan(self, data: DeliveryPlanCreate) -> Optional[DeliveryPlan]:
        contract = self.db.query(Contract).filter(Contract.id == data.contract_id).first()
        if not contract:
            return None

        delivery_plan = DeliveryPlan(
            contract_id=data.contract_id,
            batch_no=data.batch_no,
            plan_delivery_date=data.plan_delivery_date,
            plan_quantity=data.plan_quantity,
            plan_amount=data.plan_amount,
            status=DeliveryStatus.PENDING,
            remarks=data.remarks,
        )
        self.db.add(delivery_plan)
        self.db.commit()
        self.db.refresh(delivery_plan)
        return delivery_plan

    def get_delivery_plan(self, plan_id: int) -> Optional[DeliveryPlan]:
        return self.db.query(DeliveryPlan).filter(DeliveryPlan.id == plan_id).first()

    def list_delivery_plans(self, contract_id: Optional[int] = None) -> List[DeliveryPlan]:
        query = self.db.query(DeliveryPlan)
        if contract_id:
            query = query.filter(DeliveryPlan.contract_id == contract_id)
        return query.order_by(DeliveryPlan.plan_delivery_date).all()

    def update_delivery_plan(self, plan_id: int, data: DeliveryPlanUpdate) -> Optional[DeliveryPlan]:
        plan = self.get_delivery_plan(plan_id)
        if not plan:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(plan, key, value)

        self.db.commit()
        self.db.refresh(plan)
        return plan

    def record_delivery(self, data: FulfillmentRecordCreate) -> Optional[DeliveryPlan]:
        plan = self.get_delivery_plan(data.delivery_plan_id)
        if not plan or plan.status not in [DeliveryStatus.PENDING, DeliveryStatus.LATE]:
            return None

        plan.actual_delivery_date = data.actual_delivery_date
        plan.actual_quantity = data.actual_quantity
        plan.actual_amount = data.actual_amount

        if data.actual_delivery_date > plan.plan_delivery_date:
            plan.status = DeliveryStatus.LATE
        else:
            plan.status = DeliveryStatus.DELIVERED

        self.db.commit()
        self.db.refresh(plan)
        return plan

    def update_status(self, plan_id: int, new_status: DeliveryStatus) -> Optional[DeliveryPlan]:
        plan = self.get_delivery_plan(plan_id)
        if not plan:
            return None
        plan.status = new_status
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def get_late_delivery_plans(self, reference_date: Optional[date] = None) -> List[DeliveryPlan]:
        ref_date = reference_date or date.today()
        return (
            self.db.query(DeliveryPlan)
            .filter(
                DeliveryPlan.status.in_([DeliveryStatus.PENDING, DeliveryStatus.LATE]),
                DeliveryPlan.plan_delivery_date < ref_date,
            )
            .all()
        )

    def get_upcoming_deliveries(
        self, days_before: int = 3, reference_date: Optional[date] = None
    ) -> List[DeliveryPlan]:
        from datetime import timedelta

        ref_date = reference_date or date.today()
        end_date = ref_date + timedelta(days=days_before)

        return (
            self.db.query(DeliveryPlan)
            .filter(
                DeliveryPlan.status == DeliveryStatus.PENDING,
                DeliveryPlan.plan_delivery_date >= ref_date,
                DeliveryPlan.plan_delivery_date <= end_date,
            )
            .all()
        )
