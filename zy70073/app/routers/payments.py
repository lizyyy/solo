from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.schemas import (
    PaymentNodeCreate,
    PaymentNodeResponse,
    PaymentNodeUpdate,
)
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["payments"])


class PaymentRecordRequest(BaseModel):
    actual_payment_date: date
    actual_amount: Decimal


@router.post("", response_model=PaymentNodeResponse, status_code=status.HTTP_201_CREATED)
def create_payment_node(data: PaymentNodeCreate, db: Session = Depends(get_db)):
    service = PaymentService(db)
    node = service.create_payment_node(data)
    if not node:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="创建付款节点失败，检查合同是否存在",
        )
    return node


@router.get("", response_model=List[PaymentNodeResponse])
def list_payment_nodes(
    contract_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    service = PaymentService(db)
    return service.list_payment_nodes(contract_id)


@router.get("/{node_id}", response_model=PaymentNodeResponse)
def get_payment_node(node_id: int, db: Session = Depends(get_db)):
    service = PaymentService(db)
    node = service.get_payment_node(node_id)
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"付款节点 {node_id} 不存在",
        )
    return node


@router.put("/{node_id}", response_model=PaymentNodeResponse)
def update_payment_node(
    node_id: int,
    data: PaymentNodeUpdate,
    db: Session = Depends(get_db),
):
    service = PaymentService(db)
    node = service.update_payment_node(node_id, data)
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"付款节点 {node_id} 不存在",
        )
    return node


@router.post("/{node_id}/record", response_model=PaymentNodeResponse)
def record_payment(
    node_id: int,
    data: PaymentRecordRequest,
    db: Session = Depends(get_db),
):
    service = PaymentService(db)
    node = service.record_payment(node_id, data.actual_payment_date, data.actual_amount)
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"付款节点 {node_id} 不存在",
        )
    return node


@router.post("/refresh-statuses")
def refresh_payment_statuses(db: Session = Depends(get_db)):
    service = PaymentService(db)
    updated = service.refresh_payment_statuses()
    return {"updated_count": updated}


@router.get("/query/overdue", response_model=List[PaymentNodeResponse])
def get_overdue_payments(db: Session = Depends(get_db)):
    service = PaymentService(db)
    return service.get_overdue_payments()


@router.get("/query/upcoming", response_model=List[PaymentNodeResponse])
def get_upcoming_payments(days_before: int = 7, db: Session = Depends(get_db)):
    service = PaymentService(db)
    return service.get_upcoming_payments(days_before)
