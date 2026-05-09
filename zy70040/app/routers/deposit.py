from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app import schemas, services, export

router = APIRouter(prefix="/deposit-orders", tags=["押金单"])


@router.post("", response_model=schemas.DepositOrderResponse)
def create_deposit_order(
    data: schemas.DepositOrderCreate,
    db: Session = Depends(get_db),
):
    try:
        return services.create_deposit_order(db, data.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{order_no}", response_model=schemas.DepositOrderDetailResponse)
def get_deposit_order(
    order_no: str,
    db: Session = Depends(get_db),
):
    order = services.get_deposit_order(db, order_no)
    if not order:
        raise HTTPException(status_code=404, detail="押金单不存在")
    return order


@router.get("", response_model=List[schemas.DepositOrderResponse])
def list_deposit_orders(
    customer_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return services.list_deposit_orders(
        db, customer_id=customer_id, status=status,
        start_date=start_date, end_date=end_date,
        skip=skip, limit=limit
    )


@router.post("/{order_no}/refund", response_model=schemas.RefundOrderResponse)
def create_refund(
    order_no: str,
    operator_id: str = Query(...),
    operator_name: str = Query(...),
    refund_method: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        return services.create_refund_from_order(
            db, order_no, operator_id, operator_name, refund_method
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
