from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import RefundStatus
from app.schemas import (
    RefundCreate,
    RefundOut,
    RefundProcess,
)
from app.services.refund_service import RefundService

router = APIRouter(prefix="/refunds", tags=["退款"])

service = RefundService()


@router.post("", response_model=RefundOut, status_code=201)
def create_refund(data: RefundCreate, db: Session = Depends(get_db)):
    return service.create(db, data)


@router.get("", response_model=List[RefundOut])
def list_refunds(
    status: Optional[RefundStatus] = Query(None),
    receipt_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    return service.list(db, status=status, receipt_id=receipt_id)


@router.get("/{refund_id}", response_model=RefundOut)
def get_refund(refund_id: int, db: Session = Depends(get_db)):
    return service.get(db, refund_id)


@router.post("/{refund_id}/process", response_model=RefundOut)
def process_refund(refund_id: int, data: RefundProcess, db: Session = Depends(get_db)):
    return service.process(db, refund_id, data)


@router.post("/{refund_id}/retry", response_model=RefundOut)
def retry_refund(refund_id: int, operator: str, db: Session = Depends(get_db)):
    return service.retry(db, refund_id, operator)
