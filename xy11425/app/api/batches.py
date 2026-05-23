from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import BatchStatus
from ..schemas import (
    BatchCreate,
    BatchUpdate,
    BatchStateChange,
    BatchResponse,
    BatchDetailResponse,
    BatchListResponse,
)
from ..services import BatchService

router = APIRouter(prefix="/api/batches", tags=["batches"])


@router.post("", response_model=dict)
def create_batch(batch_data: BatchCreate, db: Session = Depends(get_db)):
    batch, action = BatchService.create_batch(db, batch_data)
    return {
        "batch": BatchResponse.model_validate(batch),
        "action": action,
    }


@router.get("", response_model=BatchListResponse)
def list_batches(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[BatchStatus] = None,
    created_by: Optional[str] = None,
    db: Session = Depends(get_db),
):
    skip = (page - 1) * page_size
    batches, total = BatchService.list_batches(
        db, skip=skip, limit=page_size, status=status, created_by=created_by
    )
    return {
        "total": total,
        "items": [BatchResponse.model_validate(b) for b in batches],
        "page": page,
        "page_size": page_size,
    }


@router.get("/{batch_id}", response_model=BatchDetailResponse)
def get_batch_detail(batch_id: int, db: Session = Depends(get_db)):
    detail = BatchService.get_batch_detail(db, batch_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Batch not found")
    return detail


@router.get("/number/{batch_number}", response_model=BatchResponse)
def get_batch_by_number(batch_number: str, db: Session = Depends(get_db)):
    batch = BatchService.get_batch_by_number(db, batch_number)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return BatchResponse.model_validate(batch)


@router.patch("/{batch_id}", response_model=BatchResponse)
def update_batch(
    batch_id: int,
    update_data: BatchUpdate,
    updated_by: str = Query(...),
    db: Session = Depends(get_db),
):
    batch = BatchService.update_batch(db, batch_id, update_data, updated_by)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return BatchResponse.model_validate(batch)


@router.post("/{batch_id}/state", response_model=dict)
def change_state(
    batch_id: int,
    state_data: BatchStateChange,
    db: Session = Depends(get_db),
):
    batch, state_change, error = BatchService.change_state(
        db,
        batch_id,
        state_data.to_status,
        state_data.changed_by,
        state_data.reason,
        state_data.metadata,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {
        "batch": BatchResponse.model_validate(batch),
        "state_change": {
            "from_status": state_change.from_status,
            "to_status": state_change.to_status,
            "changed_by": state_change.changed_by,
            "changed_at": state_change.changed_at,
            "reason": state_change.reason,
        },
    }


@router.delete("/{batch_id}")
def delete_batch(
    batch_id: int,
    deleted_by: str = Query(...),
    db: Session = Depends(get_db),
):
    success = BatchService.delete_batch(db, batch_id, deleted_by)
    if not success:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"message": "Batch deleted successfully"}
