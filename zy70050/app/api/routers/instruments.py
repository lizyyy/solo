from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.instrument import InstrumentStatus
from app.schemas.instrument import InstrumentCreate, InstrumentUpdate, InstrumentResponse, InstrumentStatusUpdate
from app.services.instrument_service import InstrumentService
from app.services.history_service import HistoryService

router = APIRouter(prefix="/instruments", tags=["instruments"])


@router.post("", response_model=InstrumentResponse, status_code=201)
def create_instrument(data: InstrumentCreate, db: Session = Depends(get_db)):
    try:
        return InstrumentService.create(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[InstrumentResponse])
def list_instruments(
    status: Optional[InstrumentStatus] = None,
    keyword: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    return InstrumentService.list(db, status=status, keyword=keyword, skip=skip, limit=limit)


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    return InstrumentService.get_stats(db)


@router.get("/due-calibration", response_model=List[InstrumentResponse])
def get_due_calibration(days: int = Query(30, ge=1), db: Session = Depends(get_db)):
    return InstrumentService.get_due_calibration(db, days=days)


@router.get("/overdue-calibration", response_model=List[InstrumentResponse])
def get_overdue_calibration(db: Session = Depends(get_db)):
    return InstrumentService.get_overdue_calibration(db)


@router.get("/{instrument_id}", response_model=InstrumentResponse)
def get_instrument(instrument_id: int, db: Session = Depends(get_db)):
    instrument = InstrumentService.get_by_id(db, instrument_id)
    if not instrument:
        raise HTTPException(status_code=404, detail="器具不存在")
    return instrument


@router.get("/{instrument_id}/history")
def get_history(instrument_id: int, limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    histories = HistoryService.get_history_by_instrument(db, instrument_id, limit=limit)
    return [
        {
            "id": h.id,
            "action": h.action.value if hasattr(h.action, "value") else h.action,
            "action_description": h.action_description,
            "old_status": h.old_status,
            "new_status": h.new_status,
            "old_values": h.old_values,
            "new_values": h.new_values,
            "created_by": h.created_by,
            "created_by_name": h.created_by_name,
            "created_at": h.created_at,
            "remark": h.remark,
        }
        for h in histories
    ]


@router.put("/{instrument_id}", response_model=InstrumentResponse)
def update_instrument(
    instrument_id: int,
    data: InstrumentUpdate,
    is_rectify: bool = Query(False, description="是否为补录/修正操作"),
    db: Session = Depends(get_db),
):
    try:
        return InstrumentService.update(db, instrument_id, data, is_rectify=is_rectify)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{instrument_id}/status", response_model=InstrumentResponse)
def update_status(
    instrument_id: int,
    data: InstrumentStatusUpdate,
    db: Session = Depends(get_db),
):
    try:
        return InstrumentService.update_status(db, instrument_id, data.new_status, remark=data.remark)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
