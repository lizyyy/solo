from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.models.database import get_db
from app.models.enums import BatchStrategy
from app.schemas import (
    BatchCreate,
    BatchResponse,
    WorkOrderCreate,
    BatchImportResponse,
)
from app.services.batch_service import BatchService

router = APIRouter(prefix="/batches", tags=["批次管理"])


@router.post("", response_model=BatchResponse)
def create_batch(batch_data: BatchCreate, db: Session = Depends(get_db)):
    service = BatchService(db)
    existing = service.get_batch_by_no(batch_data.batch_no)
    if existing:
        raise HTTPException(status_code=400, detail=f"批次号已存在: {batch_data.batch_no}")
    return service.create_batch(batch_data)


@router.get("", response_model=List[BatchResponse])
def list_batches(
    skip: int = 0,
    limit: int = 100,
    source: str = None,
    db: Session = Depends(get_db),
):
    service = BatchService(db)
    return service.list_batches(skip, limit, source)


@router.get("/{batch_id}", response_model=BatchResponse)
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    service = BatchService(db)
    batch = service.get_batch_by_id(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@router.post("/{batch_id}/import", response_model=BatchImportResponse)
def import_work_orders(
    batch_id: str,
    work_orders: List[WorkOrderCreate],
    strategy: BatchStrategy = BatchStrategy.IGNORE,
    db: Session = Depends(get_db),
):
    service = BatchService(db)
    batch = service.get_batch_by_id(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    try:
        result = service.import_work_orders(batch_id, work_orders, strategy)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
