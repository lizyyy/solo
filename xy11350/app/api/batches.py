from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from app.config.database import get_db
from app.utils.security import get_current_active_user
from app.utils.data_masking import mask_sensitive_data
from app.models.models import PrintBatch, BatchHistory, User
from app.schemas.schemas import (
    PrintBatchCreate, PrintBatchUpdate, PrintBatchResponse,
    PrintBatchDetailResponse, BatchHistoryResponse, ImportResult
)
from app.services.import_service import ImportService

router = APIRouter(prefix="/batches", tags=["印刷批次"])


@router.get("/", response_model=List[PrintBatchResponse])
def get_batches(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(PrintBatch)
    if status:
        query = query.filter(PrintBatch.status == status)
    batches = query.offset(skip).limit(limit).all()
    return batches


@router.get("/{batch_id}", response_model=PrintBatchDetailResponse)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    batch = db.query(PrintBatch).filter(PrintBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    result = {
        "id": batch.id,
        "batch_number": batch.batch_number,
        "paper_batch": batch.paper_batch,
        "product_name": batch.product_name,
        "status": batch.status,
        "created_at": batch.created_at,
        "updated_at": batch.updated_at,
        "customer_info": batch.customer_info,
        "operator_id": batch.operator_id,
        "cost_details": batch.cost_details,
        "lab_records": batch.lab_records,
        "orders": batch.orders,
        "rework_records": batch.rework_records
    }
    
    return mask_sensitive_data(result, current_user.role)


@router.post("/", response_model=PrintBatchResponse)
def create_batch(
    batch: PrintBatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_batch = db.query(PrintBatch).filter(PrintBatch.batch_number == batch.batch_number).first()
    if db_batch:
        raise HTTPException(status_code=400, detail="批次号已存在")
    
    db_batch = PrintBatch(**batch.dict())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


@router.put("/{batch_id}", response_model=PrintBatchResponse)
def update_batch(
    batch_id: int,
    batch_update: PrintBatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    batch = db.query(PrintBatch).filter(PrintBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    update_data = batch_update.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        old_value = str(getattr(batch, field, ""))
        if old_value != str(value):
            history = BatchHistory(
                batch_id=batch.id,
                field_name=field,
                old_value=old_value,
                new_value=str(value),
                changed_by=current_user.username
            )
            db.add(history)
            setattr(batch, field, value)
    
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/{batch_id}/history", response_model=List[BatchHistoryResponse])
def get_batch_history(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    batch = db.query(PrintBatch).filter(PrintBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    return batch.history
