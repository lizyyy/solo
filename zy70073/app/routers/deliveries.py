from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import DeliveryStatus
from app.schemas.schemas import (
    DeliveryPlanCreate,
    DeliveryPlanResponse,
    DeliveryPlanUpdate,
    FulfillmentRecordCreate,
)
from app.services.delivery_service import DeliveryService
from app.services.penalty_service import PenaltyService

router = APIRouter(prefix="/deliveries", tags=["deliveries"])


@router.post("", response_model=DeliveryPlanResponse, status_code=status.HTTP_201_CREATED)
def create_delivery_plan(data: DeliveryPlanCreate, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    plan = service.create_delivery_plan(data)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="创建交付计划失败，检查合同是否存在",
        )
    return plan


@router.get("", response_model=List[DeliveryPlanResponse])
def list_delivery_plans(
    contract_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    service = DeliveryService(db)
    return service.list_delivery_plans(contract_id)


@router.get("/{plan_id}", response_model=DeliveryPlanResponse)
def get_delivery_plan(plan_id: int, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    plan = service.get_delivery_plan(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"交付计划 {plan_id} 不存在",
        )
    return plan


@router.put("/{plan_id}", response_model=DeliveryPlanResponse)
def update_delivery_plan(
    plan_id: int,
    data: DeliveryPlanUpdate,
    db: Session = Depends(get_db),
):
    service = DeliveryService(db)
    plan = service.update_delivery_plan(plan_id, data)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"交付计划 {plan_id} 不存在",
        )
    return plan


@router.post("/record-delivery", response_model=DeliveryPlanResponse)
def record_delivery(data: FulfillmentRecordCreate, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    plan = service.record_delivery(data)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="交付记录失败，检查交付计划状态",
        )

    penalty_service = PenaltyService(db)
    penalty_service.process_delivery_penalties(plan.id)

    db.refresh(plan)
    return plan


@router.post("/{plan_id}/status/{new_status}", response_model=DeliveryPlanResponse)
def update_status(
    plan_id: int,
    new_status: DeliveryStatus,
    db: Session = Depends(get_db),
):
    service = DeliveryService(db)
    plan = service.update_status(plan_id, new_status)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"交付计划 {plan_id} 不存在",
        )
    return plan


@router.get("/query/late", response_model=List[DeliveryPlanResponse])
def get_late_deliveries(db: Session = Depends(get_db)):
    service = DeliveryService(db)
    return service.get_late_delivery_plans()


@router.get("/query/upcoming", response_model=List[DeliveryPlanResponse])
def get_upcoming_deliveries(days_before: int = 3, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    return service.get_upcoming_deliveries(days_before)
