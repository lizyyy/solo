from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.schemas import (
    AcceptanceReceiptCreate,
    AcceptanceReceiptResponse,
    AcceptanceReceiptUpdate,
)
from app.services.acceptance_service import AcceptanceService
from app.services.penalty_service import PenaltyService

router = APIRouter(prefix="/acceptances", tags=["acceptances"])


@router.post("", response_model=AcceptanceReceiptResponse, status_code=status.HTTP_201_CREATED)
def create_acceptance(data: AcceptanceReceiptCreate, db: Session = Depends(get_db)):
    service = AcceptanceService(db)
    receipt = service.create_acceptance(data)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="创建验收回执失败，检查交付计划是否已存在验收",
        )

    penalty_service = PenaltyService(db)
    penalty_service.process_delivery_penalties(receipt.delivery_plan_id)

    db.refresh(receipt)
    return receipt


@router.get("", response_model=List[AcceptanceReceiptResponse])
def list_acceptances(
    contract_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    service = AcceptanceService(db)
    return service.list_acceptances(contract_id)


@router.get("/{acceptance_id}", response_model=AcceptanceReceiptResponse)
def get_acceptance(acceptance_id: int, db: Session = Depends(get_db)):
    service = AcceptanceService(db)
    receipt = service.get_acceptance(acceptance_id)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"验收回执 {acceptance_id} 不存在",
        )
    return receipt


@router.get("/delivery/{delivery_plan_id}", response_model=Optional[AcceptanceReceiptResponse])
def get_acceptance_by_delivery(delivery_plan_id: int, db: Session = Depends(get_db)):
    service = AcceptanceService(db)
    return service.get_acceptance_by_delivery(delivery_plan_id)


@router.put("/{acceptance_id}", response_model=AcceptanceReceiptResponse)
def update_acceptance(
    acceptance_id: int,
    data: AcceptanceReceiptUpdate,
    db: Session = Depends(get_db),
):
    service = AcceptanceService(db)
    receipt = service.update_acceptance(acceptance_id, data)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"验收回执 {acceptance_id} 不存在",
        )
    return receipt


@router.get("/query/rejected", response_model=List[AcceptanceReceiptResponse])
def get_rejected_acceptances(db: Session = Depends(get_db)):
    service = AcceptanceService(db)
    return service.get_rejected_acceptances()
