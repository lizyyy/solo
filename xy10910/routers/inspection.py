from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import InspectionCreate, InspectionResponse
from services import create_inspection, log_exception
from models import Inspection

router = APIRouter()


@router.post("/", response_model=InspectionResponse)
def create_new_inspection(inspection: InspectionCreate, db: Session = Depends(get_db)):
    try:
        return create_inspection(db, inspection)
    except ValueError as e:
        log_exception(db, inspection.serial_number, "/inspections/", inspection.model_dump(), str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log_exception(db, inspection.serial_number, "/inspections/", inspection.model_dump(), str(e))
        raise HTTPException(status_code=500, detail="服务器内部错误")


@router.get("/", response_model=List[InspectionResponse])
def list_inspections(serial_number: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(Inspection)
    if serial_number:
        from services import get_device_by_serial
        device = get_device_by_serial(db, serial_number)
        if device:
            query = query.filter(Inspection.device_id == device.id)
    return query.offset(skip).limit(limit).all()
