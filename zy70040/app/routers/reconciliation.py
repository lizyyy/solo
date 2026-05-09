from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app import schemas, services

router = APIRouter(prefix="/reconciliation", tags=["财务对账"])


@router.post("/batch", response_model=schemas.ReconciliationBatchResponse)
def create_reconciliation(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    operator_id: str = Query(...),
    operator_name: str = Query(...),
    db: Session = Depends(get_db),
):
    try:
        return services.create_reconciliation_batch(
            db, start_date, end_date, operator_id, operator_name
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/batches", response_model=List[schemas.ReconciliationBatchResponse])
def list_reconciliation_batches(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    return services.get_reconciliation_batches(db, skip=skip, limit=limit)


@router.get("/history", response_model=List[schemas.OperationHistoryResponse])
def get_operation_history(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    entity_no: Optional[str] = None,
    operation_type: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return services.get_operation_history(
        db, entity_type=entity_type, entity_id=entity_id,
        entity_no=entity_no, operation_type=operation_type, limit=limit
    )
