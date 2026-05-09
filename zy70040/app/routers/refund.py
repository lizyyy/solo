from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app import schemas, services

router = APIRouter(prefix="/refund-orders", tags=["退款管理"])


@router.get("/pending", response_model=List[schemas.RefundOrderResponse])
def list_pending_refunds(db: Session = Depends(get_db)):
    return services.list_pending_refunds(db)


@router.post("/{refund_id}/process", response_model=schemas.RefundOrderResponse)
def process_refund(
    refund_id: int,
    transaction_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return services.process_refund(db, refund_id, transaction_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batch-process", response_model=List[schemas.RefundOrderResponse])
def batch_process_refunds(db: Session = Depends(get_db)):
    pending = services.list_pending_refunds(db)
    results = []
    for refund in pending:
        try:
            result = services.process_refund(db, refund.id, None)
            results.append(result)
        except Exception:
            pass
    return results


@router.get("", response_model=List[schemas.RefundOrderResponse])
def list_refund_orders(
    deposit_order_id: int = None,
    status: str = None,
    db: Session = Depends(get_db),
):
    return services.list_refund_orders(db, deposit_order_id=deposit_order_id, status=status)
