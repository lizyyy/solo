from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import DeviceCreate, DeviceResponse, DeviceDetailResponse, StatusTransition, ManualCorrection
from services import create_device, get_device_by_serial, transition_status, apply_manual_correction, log_exception
from models import Device

router = APIRouter()


@router.post("/", response_model=DeviceResponse)
def create_new_device(device: DeviceCreate, db: Session = Depends(get_db)):
    try:
        return create_device(db, device)
    except ValueError as e:
        log_exception(db, device.serial_number, "/devices/", device.model_dump(), str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log_exception(db, device.serial_number, "/devices/", device.model_dump(), str(e))
        raise HTTPException(status_code=500, detail="服务器内部错误")


@router.get("/{serial_number}", response_model=DeviceDetailResponse)
def get_device(serial_number: str, db: Session = Depends(get_db)):
    device = get_device_by_serial(db, serial_number)
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    return device


@router.get("/", response_model=List[DeviceResponse])
def list_devices(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    devices = db.query(Device).offset(skip).limit(limit).all()
    return devices


@router.post("/transition", response_model=DeviceResponse)
def transition_device_status(transition: StatusTransition, db: Session = Depends(get_db)):
    try:
        return transition_status(db, transition)
    except ValueError as e:
        log_exception(db, transition.serial_number, "/devices/transition", transition.model_dump(), str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/correct", response_model=DeviceResponse)
def manual_correction(correction: ManualCorrection, db: Session = Depends(get_db)):
    try:
        return apply_manual_correction(db, correction)
    except ValueError as e:
        log_exception(db, correction.serial_number, "/devices/correct", correction.model_dump(), str(e))
        raise HTTPException(status_code=400, detail=str(e))
