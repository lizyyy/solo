from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models import BatteryPack
from app.schemas import (
    BatteryPackCreate,
    BatteryPackUpdate,
    BatteryPackResponse
)

router = APIRouter(prefix="/batteries", tags=["电池包管理"])


@router.post("/", response_model=BatteryPackResponse, status_code=201)
def create_battery(battery: BatteryPackCreate, db: Session = Depends(get_db)):
    existing = db.query(BatteryPack).filter(
        BatteryPack.battery_id == battery.battery_id.upper()
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"电池编号 {battery.battery_id} 已存在"
        )
    
    db_battery = BatteryPack(
        battery_id=battery.battery_id.upper(),
        name=battery.name,
        purchase_date=battery.purchase_date,
        initial_cycles=battery.initial_cycles,
        cell_count=battery.cell_count,
        capacity_mah=battery.capacity_mah,
        status=battery.status
    )
    
    db.add(db_battery)
    db.commit()
    db.refresh(db_battery)
    
    return db_battery


@router.get("/", response_model=List[BatteryPackResponse])
def list_batteries(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(BatteryPack)
    
    if status:
        query = query.filter(BatteryPack.status == status)
    
    return query.order_by(BatteryPack.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{battery_id}", response_model=BatteryPackResponse)
def get_battery(battery_id: str, db: Session = Depends(get_db)):
    battery = db.query(BatteryPack).filter(
        BatteryPack.battery_id == battery_id.upper()
    ).first()
    
    if not battery:
        raise HTTPException(
            status_code=404,
            detail=f"电池编号 {battery_id} 不存在"
        )
    
    return battery


@router.put("/{battery_id}", response_model=BatteryPackResponse)
def update_battery(
    battery_id: str,
    battery_update: BatteryPackUpdate,
    db: Session = Depends(get_db)
):
    battery = db.query(BatteryPack).filter(
        BatteryPack.battery_id == battery_id.upper()
    ).first()
    
    if not battery:
        raise HTTPException(
            status_code=404,
            detail=f"电池编号 {battery_id} 不存在"
        )
    
    update_data = battery_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(battery, key, value)
    
    db.commit()
    db.refresh(battery)
    
    return battery


@router.delete("/{battery_id}", status_code=204)
def delete_battery(battery_id: str, db: Session = Depends(get_db)):
    battery = db.query(BatteryPack).filter(
        BatteryPack.battery_id == battery_id.upper()
    ).first()
    
    if not battery:
        raise HTTPException(
            status_code=404,
            detail=f"电池编号 {battery_id} 不存在"
        )
    
    db.delete(battery)
    db.commit()
