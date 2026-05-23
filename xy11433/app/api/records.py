from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import ConsumableRecord, ConsumableStatus
from app.schemas import (
    ConsumableRecordCreate, ConsumableRecordResponse,
    ConsumableRecordUpdate, StatusChangeRequest,
    StatusHistoryResponse, ImportEvidenceResponse,
    PaginatedResponse
)
from app.services import ImportService, ReplayService

router = APIRouter(prefix="/records", tags=["耗材记录"])


@router.get("", response_model=PaginatedResponse)
def get_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    data_source: Optional[str] = None,
    current_status: Optional[str] = None,
    is_duplicate: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ConsumableRecord)
    
    if data_source:
        query = query.filter(ConsumableRecord.data_source == data_source)
    if current_status:
        query = query.filter(ConsumableRecord.current_status == current_status)
    if is_duplicate is not None:
        query = query.filter(ConsumableRecord.is_duplicate == is_duplicate)
    
    total = query.count()
    records = query.order_by(ConsumableRecord.created_at.desc()) \
        .offset((page - 1) * page_size) \
        .limit(page_size) \
        .all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": records
    }


@router.get("/{record_id}", response_model=ConsumableRecordResponse)
def get_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(ConsumableRecord).filter(
        ConsumableRecord.id == record_id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    return record


@router.post("", response_model=ConsumableRecordResponse)
def create_record(
    record_data: ConsumableRecordCreate,
    db: Session = Depends(get_db)
):
    import_service = ImportService(db)
    record, is_duplicate = import_service.import_single_record(
        record_data.model_dump(),
        record_data.data_source,
        record_data.created_by,
        record_data.original_file_name,
        record_data.original_row_number
    )
    return record


@router.put("/{record_id}", response_model=ConsumableRecordResponse)
def update_record(
    record_id: int,
    update_data: ConsumableRecordUpdate,
    db: Session = Depends(get_db)
):
    record = db.query(ConsumableRecord).filter(
        ConsumableRecord.id == record_id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(record, key, value)
    
    db.commit()
    db.refresh(record)
    
    return record


@router.post("/{record_id}/change-status", response_model=StatusHistoryResponse)
def change_status(
    record_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db)
):
    replay_service = ReplayService(db)
    
    try:
        history = replay_service.change_status(
            record_id=record_id,
            new_status=request.new_status,
            change_reason=request.change_reason,
            operator=request.operator,
            remark=request.remark
        )
        return history
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{record_id}/history")
def get_record_history(record_id: int, db: Session = Depends(get_db)):
    replay_service = ReplayService(db)
    
    try:
        history = replay_service.get_record_history(record_id)
        return history
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{record_id}/status-history", response_model=List[StatusHistoryResponse])
def get_status_history(record_id: int, db: Session = Depends(get_db)):
    record = db.query(ConsumableRecord).filter(
        ConsumableRecord.id == record_id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    return sorted(record.status_history, key=lambda x: x.change_time, reverse=True)


@router.get("/{record_id}/import-evidence", response_model=Optional[ImportEvidenceResponse])
def get_import_evidence(record_id: int, db: Session = Depends(get_db)):
    record = db.query(ConsumableRecord).filter(
        ConsumableRecord.id == record_id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    return record.import_evidence
