from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.calibration import CalibrationStatus
from app.schemas.calibration import CalibrationCreate, CalibrationResult, CalibrationResponse
from app.services.calibration_service import CalibrationService

router = APIRouter(prefix="/calibrations", tags=["calibrations"])


@router.post("", response_model=CalibrationResponse, status_code=201)
def create_calibration(data: CalibrationCreate, db: Session = Depends(get_db)):
    try:
        return CalibrationService.create(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[CalibrationResponse])
def list_calibrations(
    status: Optional[CalibrationStatus] = None,
    instrument_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    return CalibrationService.list(db, status=status, instrument_id=instrument_id, skip=skip, limit=limit)


@router.get("/overdue-scheduled", response_model=List[CalibrationResponse])
def get_overdue_scheduled(db: Session = Depends(get_db)):
    return CalibrationService.get_overdue_scheduled(db)


@router.get("/{calibration_id}", response_model=CalibrationResponse)
def get_calibration(calibration_id: int, db: Session = Depends(get_db)):
    cal = CalibrationService.get_by_id(db, calibration_id)
    if not cal:
        raise HTTPException(status_code=404, detail="校准记录不存在")
    return cal


@router.post("/{calibration_id}/start", response_model=CalibrationResponse)
def start_calibration(calibration_id: int, db: Session = Depends(get_db)):
    try:
        return CalibrationService.start_calibration(db, calibration_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{calibration_id}/complete", response_model=CalibrationResponse)
def complete_calibration(calibration_id: int, data: CalibrationResult, db: Session = Depends(get_db)):
    try:
        return CalibrationService.complete_calibration(db, calibration_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
