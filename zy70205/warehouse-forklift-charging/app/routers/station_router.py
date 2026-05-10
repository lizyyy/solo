from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.models import ChargingStation, ChargingStationStatus
from app.schemas.schemas import (
    ChargingStationCreate, ChargingStationUpdate, 
    ChargingStationResponse, APIResponse
)

router = APIRouter(prefix="/api/stations", tags=["充电位管理"])

@router.post("", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
def create_station(data: ChargingStationCreate, db: Session = Depends(get_db)):
    existing = db.query(ChargingStation).filter(
        ChargingStation.station_code == data.station_code
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"充电位编号 {data.station_code} 已存在"
        )
    
    station = ChargingStation(
        station_code=data.station_code,
        name=data.name,
        charging_power=data.charging_power
    )
    db.add(station)
    db.commit()
    db.refresh(station)
    
    return APIResponse(
        success=True,
        code="CREATED",
        message="充电位创建成功",
        data={"station": ChargingStationResponse.from_orm(station).dict()}
    )

@router.get("/{station_code}", response_model=APIResponse)
def get_station(station_code: str, db: Session = Depends(get_db)):
    station = db.query(ChargingStation).filter(
        ChargingStation.station_code == station_code
    ).first()
    
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"充电位 {station_code} 不存在"
        )
    
    return APIResponse(
        success=True,
        code="OK",
        message="查询成功",
        data={"station": ChargingStationResponse.from_orm(station).dict()}
    )

@router.get("", response_model=APIResponse)
def list_stations(
    status_filter: ChargingStationStatus = None,
    db: Session = Depends(get_db)
):
    query = db.query(ChargingStation)
    if status_filter:
        query = query.filter(ChargingStation.status == status_filter)
    
    stations = query.all()
    
    return APIResponse(
        success=True,
        code="OK",
        message="查询成功",
        data={
            "stations": [ChargingStationResponse.from_orm(s).dict() for s in stations],
            "total": len(stations)
        }
    )

@router.patch("/{station_code}", response_model=APIResponse)
def update_station(
    station_code: str,
    data: ChargingStationUpdate,
    db: Session = Depends(get_db)
):
    station = db.query(ChargingStation).filter(
        ChargingStation.station_code == station_code
    ).first()
    
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"充电位 {station_code} 不存在"
        )
    
    update_data = data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(station, field, value)
    
    db.commit()
    db.refresh(station)
    
    return APIResponse(
        success=True,
        code="UPDATED",
        message="充电位更新成功",
        data={"station": ChargingStationResponse.from_orm(station).dict()}
    )
