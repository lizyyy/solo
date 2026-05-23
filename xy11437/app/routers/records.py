from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.auth import get_current_active_user, require_roles
from app import models, schemas, services

router = APIRouter(prefix="/records", tags=["记录管理"])


@router.post("", response_model=schemas.CleaningRecordResponse)
async def create_record(
    record_in: schemas.CleaningRecordCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(
        models.UserRole.DATA_ENTRY,
        models.UserRole.REVIEWER,
        models.UserRole.SUPERVISOR
    ))
):
    record = services.create_cleaning_record(db, record_in, current_user.id)
    return record


@router.get("", response_model=List[schemas.CleaningRecordResponse])
async def list_records(
    source: Optional[models.RecordSource] = None,
    status: Optional[models.RecordStatus] = None,
    room_no: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    query = db.query(models.CleaningRecord)
    if source:
        query = query.filter(models.CleaningRecord.source == source)
    if status:
        query = query.filter(models.CleaningRecord.status == status)
    if room_no:
        query = query.filter(models.CleaningRecord.room_no == room_no)
    
    records = query.order_by(models.CleaningRecord.created_at.desc()).offset(skip).limit(limit).all()
    return records


@router.get("/failed", response_model=List[schemas.FailedRecordResponse])
async def list_failed_records(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    records = services.get_failed_records(db, skip, limit)
    return records


@router.get("/{record_id}", response_model=schemas.CleaningRecordDetail)
async def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    record = db.query(models.CleaningRecord).filter(models.CleaningRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@router.put("/{record_id}/status", response_model=schemas.CleaningRecordResponse)
async def update_status(
    record_id: int,
    status_update: schemas.StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(
        models.UserRole.REVIEWER,
        models.UserRole.SUPERVISOR
    ))
):
    record = services.update_record_status(
        db, record_id, status_update.status, current_user.id,
        status_update.comment, status_update.retry_category
    )
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@router.post("/{record_id}/retry", response_model=schemas.RetryQueueResponse)
async def enqueue_retry(
    record_id: int,
    scheduled_at: Optional[datetime] = None,
    error_message: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(
        models.UserRole.REVIEWER,
        models.UserRole.SUPERVISOR
    ))
):
    retry_item = services.enqueue_retry(db, record_id, current_user.id, scheduled_at, error_message)
    if not retry_item:
        raise HTTPException(status_code=404, detail="记录不存在")
    return retry_item


@router.post("/{record_id}/review", response_model=schemas.CleaningRecordResponse)
async def manual_review(
    record_id: int,
    review_in: schemas.ManualReviewRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(
        models.UserRole.REVIEWER,
        models.UserRole.SUPERVISOR
    ))
):
    record = services.manual_review(db, record_id, current_user.id, review_in)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@router.post("/{record_id}/compensate", response_model=schemas.CompensationResponse)
async def compensate_record(
    record_id: int,
    comp_in: schemas.CompensationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(
        models.UserRole.SUPERVISOR
    ))
):
    compensation = services.create_compensation(db, record_id, comp_in, current_user.id)
    if not compensation:
        raise HTTPException(status_code=404, detail="记录不存在")
    return compensation


@router.post("/{record_id}/close", response_model=schemas.CleaningRecordResponse)
async def close_record(
    record_id: int,
    comment: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(
        models.UserRole.SUPERVISOR
    ))
):
    record = services.close_record(db, record_id, current_user.id, comment)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@router.post("/{record_id}/revive", response_model=schemas.CleaningRecordResponse)
async def revive_dead_letter(
    record_id: int,
    reset_retries: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(
        models.UserRole.SUPERVISOR
    ))
):
    record = services.revive_dead_letter(db, record_id, current_user.id, reset_retries)
    if not record:
        raise HTTPException(status_code=404, detail="死信记录不存在")
    return record
