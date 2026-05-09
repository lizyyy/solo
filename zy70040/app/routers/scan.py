from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import schemas, services

router = APIRouter(prefix="/scan-records", tags=["扫码归还"])


@router.post("", response_model=schemas.ScanRecordResponse)
def scan_package(
    data: schemas.ScanRecordCreate,
    db: Session = Depends(get_db),
):
    try:
        return services.scan_package(db, data.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[schemas.ScanRecordResponse])
def list_scan_records(
    deposit_order_id: int = None,
    is_reversed: bool = None,
    db: Session = Depends(get_db),
):
    return services.get_scan_records(db, deposit_order_id=deposit_order_id, is_reversed=is_reversed)


@router.post("/{scan_id}/reverse", response_model=schemas.ScanRecordResponse)
def reverse_scan(
    scan_id: int,
    data: schemas.ReverseOperation,
    db: Session = Depends(get_db),
):
    try:
        return services.reverse_scan_record(
            db, scan_id, data.reason, data.operator_id, data.operator_name
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
