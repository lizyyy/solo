from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Device
from schemas import DeviceCreate, DeviceUpdate, DeviceResponse
from exceptions import DuplicateEntryException, NotFoundException

router = APIRouter()


@router.post("/", response_model=DeviceResponse)
def create_device(device: DeviceCreate, db: Session = Depends(get_db)):
    existing_device = db.query(Device).filter(
        Device.serial_number == device.serial_number
    ).first()
    if existing_device:
        raise DuplicateEntryException(f"序列号 {device.serial_number} 已存在")

    db_device = Device(**device.dict())
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    return db_device


@router.get("/", response_model=List[DeviceResponse])
def list_devices(
    skip: int = 0,
    limit: int = 100,
    serial_number: str = None,
    status: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(Device)
    if serial_number:
        query = query.filter(Device.serial_number.contains(serial_number))
    if status:
        query = query.filter(Device.status == status)
    return query.offset(skip).limit(limit).all()


@router.get("/{serial_number}", response_model=DeviceResponse)
def get_device(serial_number: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(
        Device.serial_number == serial_number
    ).first()
    if not device:
        raise NotFoundException("设备")
    return device


@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(
    device_id: int,
    device_update: DeviceUpdate,
    db: Session = Depends(get_db)
):
    db_device = db.query(Device).filter(Device.id == device_id).first()
    if not db_device:
        raise NotFoundException("设备", device_id)

    for key, value in device_update.dict(exclude_unset=True).items():
        setattr(db_device, key, value)

    db.commit()
    db.refresh(db_device)
    return db_device


@router.delete("/{device_id}")
def delete_device(device_id: int, db: Session = Depends(get_db)):
    db_device = db.query(Device).filter(Device.id == device_id).first()
    if not db_device:
        raise NotFoundException("设备", device_id)
    db.delete(db_device)
    db.commit()
    return {"message": "设备已删除"}
