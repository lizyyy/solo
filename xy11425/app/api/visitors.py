from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import (
    VisitorRecordUpdate,
    VisitorRecordResponse,
    VisitorRecordListResponse,
    AuditLogResponse,
)
from ..services import VisitorService

router = APIRouter(prefix="/api/visitors", tags=["visitors"])


@router.get("", response_model=VisitorRecordListResponse)
def list_visitor_records(
    batch_id: Optional[int] = None,
    is_overstay: Optional[bool] = None,
    review_status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    skip = (page - 1) * page_size
    records, total = VisitorService.list_visitor_records(
        db,
        batch_id=batch_id,
        is_overstay=is_overstay,
        review_status=review_status,
        skip=skip,
        limit=page_size,
    )
    return {
        "total": total,
        "items": [VisitorRecordResponse.model_validate(r) for r in records],
        "page": page,
        "page_size": page_size,
    }


@router.get("/{record_id}", response_model=VisitorRecordResponse)
def get_visitor_record(record_id: int, db: Session = Depends(get_db)):
    record = VisitorService.get_visitor_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Visitor record not found")
    return VisitorRecordResponse.model_validate(record)


@router.patch("/{record_id}", response_model=VisitorRecordResponse)
def update_visitor_record(
    record_id: int,
    update_data: VisitorRecordUpdate,
    updated_by: str = Query(...),
    db: Session = Depends(get_db),
):
    record = VisitorService.update_visitor_record(
        db, record_id, update_data, updated_by
    )
    if not record:
        raise HTTPException(status_code=404, detail="Visitor record not found")
    return VisitorRecordResponse.model_validate(record)


@router.get("/{record_id}/audit-logs", response_model=list)
def get_record_audit_logs(
    record_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    skip = (page - 1) * page_size
    logs, total = VisitorService.get_audit_logs(
        db, record_id=record_id, skip=skip, limit=page_size
    )
    return {
        "total": total,
        "items": [AuditLogResponse.model_validate(l) for l in logs],
    }


@router.get("/batch/{batch_id}/statistics")
def get_batch_statistics(batch_id: int, db: Session = Depends(get_db)):
    stats = VisitorService.get_batch_statistics(db, batch_id)
    return stats


@router.get("/batch/{batch_id}/audit-logs", response_model=list)
def get_batch_audit_logs(
    batch_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    skip = (page - 1) * page_size
    logs, total = VisitorService.get_audit_logs(
        db, batch_id=batch_id, skip=skip, limit=page_size
    )
    return {
        "total": total,
        "items": [AuditLogResponse.model_validate(l) for l in logs],
    }
