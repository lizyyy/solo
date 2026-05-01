from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import QuarantineRecord
from app.schemas import QuarantineRecordResponse
from app.services import QuarantineService

router = APIRouter(prefix="/quarantine", tags=["隔离区管理"])


@router.get("/", response_model=List[QuarantineRecordResponse])
def list_quarantine_records(
    import_session_id: Optional[str] = Query(None),
    battery_id: Optional[str] = Query(None),
    error_type: Optional[str] = Query(None),
    is_resolved: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    records = QuarantineService.get_quarantine_records(
        db=db,
        import_session_id=import_session_id,
        battery_id=battery_id.upper() if battery_id else None,
        error_type=error_type,
        is_resolved=is_resolved,
        skip=skip,
        limit=limit
    )
    
    return records


@router.get("/count")
def count_quarantine_records(
    import_session_id: Optional[str] = Query(None),
    battery_id: Optional[str] = Query(None),
    error_type: Optional[str] = Query(None),
    is_resolved: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    count = QuarantineService.count_quarantine_records(
        db=db,
        import_session_id=import_session_id,
        battery_id=battery_id.upper() if battery_id else None,
        error_type=error_type,
        is_resolved=is_resolved
    )
    
    return {"count": count}


@router.get("/{record_id}", response_model=QuarantineRecordResponse)
def get_quarantine_record(
    record_id: int,
    db: Session = Depends(get_db)
):
    record = QuarantineService.get_quarantine_record(db, record_id)
    
    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"隔离记录 {record_id} 不存在"
        )
    
    return record


@router.post("/{record_id}/resolve", response_model=QuarantineRecordResponse)
def resolve_quarantine_record(
    record_id: int,
    resolution_note: Optional[str] = None,
    db: Session = Depends(get_db)
):
    record = QuarantineService.resolve_quarantine_record(
        db=db,
        record_id=record_id,
        resolution_note=resolution_note
    )
    
    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"隔离记录 {record_id} 不存在"
        )
    
    return record
