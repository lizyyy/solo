from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.models import Forklift, ForkliftStatus, BatteryStatus
from app.schemas.schemas import (
    ForkliftCreate, ForkliftUpdate, ForkliftResponse, 
    BatteryStatusResponse, APIResponse
)

router = APIRouter(prefix="/api/forklifts", tags=["叉车档案"])

@router.post("", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
def create_forklift(data: ForkliftCreate, db: Session = Depends(get_db)):
    existing = db.query(Forklift).filter(
        Forklift.forklift_code == data.forklift_code
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"叉车编号 {data.forklift_code} 已存在"
        )
    
    forklift = Forklift(
        forklift_code=data.forklift_code,
        name=data.name,
        battery_capacity=data.battery_capacity,
        min_operating_percent=data.min_operating_percent,
        charging_rate=data.charging_rate
    )
    db.add(forklift)
    db.flush()
    
    battery = BatteryStatus(
        forklift_id=forklift.id,
        current_percent=80.0
    )
    db.add(battery)
    db.commit()
    db.refresh(forklift)
    
    return APIResponse(
        success=True,
        code="CREATED",
        message="叉车档案创建成功",
        data={"forklift": ForkliftResponse.from_orm(forklift).dict()}
    )

@router.get("/{forklift_code}", response_model=APIResponse)
def get_forklift(forklift_code: str, db: Session = Depends(get_db)):
    forklift = db.query(Forklift).filter(
        Forklift.forklift_code == forklift_code,
        Forklift.is_deleted == False
    ).first()
    
    if not forklift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"叉车 {forklift_code} 不存在"
        )
    
    battery = db.query(BatteryStatus).filter(
        BatteryStatus.forklift_id == forklift.id
    ).first()
    
    return APIResponse(
        success=True,
        code="OK",
        message="查询成功",
        data={
            "forklift": ForkliftResponse.from_orm(forklift).dict(),
            "battery": BatteryStatusResponse.from_orm(battery).dict() if battery else None
        }
    )

@router.get("", response_model=APIResponse)
def list_forklifts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    forklifts = db.query(Forklift).filter(
        Forklift.is_deleted == False
    ).offset(skip).limit(limit).all()
    
    return APIResponse(
        success=True,
        code="OK",
        message="查询成功",
        data={
            "forklifts": [ForkliftResponse.from_orm(f).dict() for f in forklifts],
            "total": len(forklifts)
        }
    )

@router.patch("/{forklift_code}", response_model=APIResponse)
def update_forklift(
    forklift_code: str,
    data: ForkliftUpdate,
    db: Session = Depends(get_db)
):
    forklift = db.query(Forklift).filter(
        Forklift.forklift_code == forklift_code,
        Forklift.is_deleted == False
    ).first()
    
    if not forklift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"叉车 {forklift_code} 不存在"
        )
    
    update_data = data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(forklift, field, value)
    
    db.commit()
    db.refresh(forklift)
    
    return APIResponse(
        success=True,
        code="UPDATED",
        message="叉车档案更新成功",
        data={"forklift": ForkliftResponse.from_orm(forklift).dict()}
    )

@router.delete("/{forklift_code}", response_model=APIResponse)
def delete_forklift(forklift_code: str, db: Session = Depends(get_db)):
    forklift = db.query(Forklift).filter(
        Forklift.forklift_code == forklift_code
    ).first()
    
    if not forklift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"叉车 {forklift_code} 不存在"
        )
    
    forklift.is_deleted = True
    forklift.status = ForkliftStatus.DECOMMISSIONED
    db.commit()
    
    return APIResponse(
        success=True,
        code="DELETED",
        message="叉车档案已停用"
    )
