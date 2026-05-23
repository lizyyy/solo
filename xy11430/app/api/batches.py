from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.models.models import Batch, User, UserRole, ReceiptStatus
from app.schemas.schemas import (
    BatchCreate,
    BatchResponse,
    BatchSummary,
    StatusChangeRequest
)
from app.utils.security import get_current_active_user, require_role
from app.services.state_machine import StateMachine, StateTransitionError, PermissionError

router = APIRouter(prefix="/batches", tags=["批次管理"])


@router.post("/", response_model=BatchResponse)
async def create_batch(
    batch_data: BatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY]))
):
    existing = db.query(Batch).filter(Batch.batch_no == batch_data.batch_no).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"批次号 {batch_data.batch_no} 已存在"
        )

    batch = Batch(
        **batch_data.model_dump(),
        created_by=current_user.id
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/", response_model=List[BatchResponse])
async def list_batches(
    college: Optional[str] = None,
    is_frozen: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Batch)

    if current_user.role == UserRole.COLLEGE_SECRETARY:
        query = query.filter(Batch.college == current_user.college)
    elif college:
        query = query.filter(Batch.college == college)

    if is_frozen is not None:
        query = query.filter(Batch.is_frozen == is_frozen)

    return query.order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{batch_id}", response_model=BatchResponse)
async def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if current_user.role == UserRole.COLLEGE_SECRETARY and batch.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权访问其他学院的批次")

    return batch


@router.get("/{batch_id}/summary", response_model=BatchSummary)
async def get_batch_summary(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.services.report_service import ReportService

    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if current_user.role == UserRole.COLLEGE_SECRETARY and batch.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权访问其他学院的批次")

    summary = ReportService.get_batch_summary(db, batch_id)
    if not summary:
        raise HTTPException(status_code=404, detail="无法获取批次汇总")

    return summary


@router.post("/{batch_id}/freeze")
async def freeze_batch(
    batch_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY, UserRole.AUDITOR]))
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if current_user.role == UserRole.COLLEGE_SECRETARY and batch.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权操作其他学院的批次")

    if batch.is_frozen:
        raise HTTPException(status_code=400, detail="批次已冻结")

    batch.is_frozen = True
    batch.frozen_by = current_user.id
    batch.frozen_at = datetime.utcnow()
    batch.frozen_reason = reason
    db.commit()

    return {"message": "批次已冻结", "batch_id": batch_id, "frozen_at": batch.frozen_at}


@router.post("/{batch_id}/unfreeze")
async def unfreeze_batch(
    batch_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.COLLEGE_SECRETARY]))
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if current_user.role == UserRole.COLLEGE_SECRETARY and batch.college != current_user.college:
        raise HTTPException(status_code=403, detail="无权操作其他学院的批次")

    if not batch.is_frozen:
        raise HTTPException(status_code=400, detail="批次未冻结")

    batch.is_frozen = False
    db.commit()

    return {"message": "批次已解冻", "batch_id": batch_id}
