from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import csv
import io
import pandas as pd

from database import get_db
from models.flight import FlightPlan
from models.audit import AuditLog
from pydantic import BaseModel

router = APIRouter(prefix="/api/flights", tags=["航班计划"])


class FlightPlanCreate(BaseModel):
    flight_number: str
    aircraft_type: Optional[str] = None
    aircraft_registration: Optional[str] = None
    departure_airport: Optional[str] = None
    arrival_airport: Optional[str] = None
    scheduled_departure: Optional[datetime] = None
    estimated_departure: Optional[datetime] = None
    gate_number: Optional[str] = None
    stand_number: Optional[str] = None
    is_deice_required: bool = False
    deice_priority: int = 3


class FlightPlanUpdate(BaseModel):
    aircraft_type: Optional[str] = None
    aircraft_registration: Optional[str] = None
    departure_airport: Optional[str] = None
    arrival_airport: Optional[str] = None
    scheduled_departure: Optional[datetime] = None
    estimated_departure: Optional[datetime] = None
    gate_number: Optional[str] = None
    stand_number: Optional[str] = None
    is_deice_required: Optional[bool] = None
    deice_priority: Optional[int] = None


@router.post("/", response_model=dict)
def create_flight(flight: FlightPlanCreate, db: Session = Depends(get_db)):
    existing = db.query(FlightPlan).filter(
        FlightPlan.flight_number == flight.flight_number
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"航班 {flight.flight_number} 已存在"
        )
    
    db_flight = FlightPlan(
        flight_number=flight.flight_number,
        aircraft_type=flight.aircraft_type,
        aircraft_registration=flight.aircraft_registration,
        departure_airport=flight.departure_airport,
        arrival_airport=flight.arrival_airport,
        scheduled_departure=flight.scheduled_departure,
        estimated_departure=flight.estimated_departure,
        gate_number=flight.gate_number,
        stand_number=flight.stand_number,
        is_deice_required=flight.is_deice_required,
        deice_priority=flight.deice_priority
    )
    db.add(db_flight)
    
    audit = AuditLog(
        action="CREATE_FLIGHT",
        entity_type="FlightPlan",
        flight_number=flight.flight_number,
        details=f"创建航班 {flight.flight_number}"
    )
    db.add(audit)
    
    db.commit()
    db.refresh(db_flight)
    
    return {"message": "创建成功", "flight": db_flight.to_dict()}


@router.post("/import/csv", response_model=dict)
def import_flights_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="请上传 CSV 文件"
        )
    
    content = file.file.read()
    
    try:
        df = pd.read_csv(io.BytesIO(content), encoding='utf-8')
    except UnicodeDecodeError:
        df = pd.read_csv(io.BytesIO(content), encoding='gbk')
    
    required_columns = ['flight_number']
    for col in required_columns:
        if col not in df.columns:
            raise HTTPException(
                status_code=400,
                detail=f"缺少必要列: {col}"
            )
    
    imported_count = 0
    updated_count = 0
    errors = []
    
    for idx, row in df.iterrows():
        try:
            flight_number = str(row.get('flight_number', '')).strip()
            if not flight_number:
                continue
            
            existing = db.query(FlightPlan).filter(
                FlightPlan.flight_number == flight_number
            ).first()
            
            def parse_datetime(val):
                if pd.isna(val) or val == '':
                    return None
                try:
                    if isinstance(val, str):
                        return datetime.strptime(val, '%Y-%m-%d %H:%M:%S')
                    return val
                except:
                    return None
            
            if existing:
                if row.get('aircraft_type') and not pd.isna(row.get('aircraft_type')):
                    existing.aircraft_type = str(row.get('aircraft_type', '')).strip()
                if row.get('aircraft_registration') and not pd.isna(row.get('aircraft_registration')):
                    existing.aircraft_registration = str(row.get('aircraft_registration', '')).strip()
                if row.get('departure_airport') and not pd.isna(row.get('departure_airport')):
                    existing.departure_airport = str(row.get('departure_airport', '')).strip()
                if row.get('arrival_airport') and not pd.isna(row.get('arrival_airport')):
                    existing.arrival_airport = str(row.get('arrival_airport', '')).strip()
                
                scheduled = parse_datetime(row.get('scheduled_departure'))
                if scheduled:
                    existing.scheduled_departure = scheduled
                
                estimated = parse_datetime(row.get('estimated_departure'))
                if estimated:
                    existing.estimated_departure = estimated
                
                if row.get('gate_number') and not pd.isna(row.get('gate_number')):
                    existing.gate_number = str(row.get('gate_number', '')).strip()
                if row.get('stand_number') and not pd.isna(row.get('stand_number')):
                    existing.stand_number = str(row.get('stand_number', '')).strip()
                
                if row.get('is_deice_required') is not None and not pd.isna(row.get('is_deice_required')):
                    val = row.get('is_deice_required')
                    existing.is_deice_required = bool(val) if isinstance(val, bool) else str(val).lower() in ['true', '1', 'yes', '是']
                
                if row.get('deice_priority') and not pd.isna(row.get('deice_priority')):
                    try:
                        existing.deice_priority = int(row.get('deice_priority'))
                    except:
                        pass
                
                updated_count += 1
                
                audit = AuditLog(
                    action="UPDATE_FLIGHT",
                    entity_type="FlightPlan",
                    flight_number=flight_number,
                    details=f"更新航班 {flight_number} 信息"
                )
                db.add(audit)
                
            else:
                new_flight = FlightPlan(
                    flight_number=flight_number,
                    aircraft_type=str(row.get('aircraft_type', '')).strip() if row.get('aircraft_type') and not pd.isna(row.get('aircraft_type')) else None,
                    aircraft_registration=str(row.get('aircraft_registration', '')).strip() if row.get('aircraft_registration') and not pd.isna(row.get('aircraft_registration')) else None,
                    departure_airport=str(row.get('departure_airport', '')).strip() if row.get('departure_airport') and not pd.isna(row.get('departure_airport')) else None,
                    arrival_airport=str(row.get('arrival_airport', '')).strip() if row.get('arrival_airport') and not pd.isna(row.get('arrival_airport')) else None,
                    scheduled_departure=parse_datetime(row.get('scheduled_departure')),
                    estimated_departure=parse_datetime(row.get('estimated_departure')),
                    gate_number=str(row.get('gate_number', '')).strip() if row.get('gate_number') and not pd.isna(row.get('gate_number')) else None,
                    stand_number=str(row.get('stand_number', '')).strip() if row.get('stand_number') and not pd.isna(row.get('stand_number')) else None,
                    is_deice_required=bool(row.get('is_deice_required')) if row.get('is_deice_required') is not None and not pd.isna(row.get('is_deice_required')) else False,
                    deice_priority=int(row.get('deice_priority')) if row.get('deice_priority') and not pd.isna(row.get('deice_priority')) else 3
                )
                db.add(new_flight)
                
                audit = AuditLog(
                    action="CREATE_FLIGHT",
                    entity_type="FlightPlan",
                    flight_number=flight_number,
                    details=f"导入航班 {flight_number}"
                )
                db.add(audit)
                
                imported_count += 1
            
        except Exception as e:
            errors.append(f"第 {idx+1} 行: {str(e)}")
            continue
    
    db.commit()
    
    return {
        "message": "导入完成",
        "imported": imported_count,
        "updated": updated_count,
        "errors": errors
    }


@router.get("/", response_model=dict)
def get_flights(
    skip: int = 0,
    limit: int = 100,
    flight_number: Optional[str] = None,
    gate_number: Optional[str] = None,
    is_deice_required: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(FlightPlan)
    
    if flight_number:
        query = query.filter(FlightPlan.flight_number.contains(flight_number))
    if gate_number:
        query = query.filter(FlightPlan.gate_number == gate_number)
    if is_deice_required is not None:
        query = query.filter(FlightPlan.is_deice_required == is_deice_required)
    
    total = query.count()
    flights = query.order_by(FlightPlan.scheduled_departure.asc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "flights": [f.to_dict() for f in flights]
    }


@router.get("/{flight_number}", response_model=dict)
def get_flight(flight_number: str, db: Session = Depends(get_db)):
    flight = db.query(FlightPlan).filter(
        FlightPlan.flight_number == flight_number
    ).first()
    
    if not flight:
        raise HTTPException(status_code=404, detail=f"航班 {flight_number} 不存在")
    
    return {"flight": flight.to_dict()}


@router.put("/{flight_number}", response_model=dict)
def update_flight(
    flight_number: str,
    update: FlightPlanUpdate,
    db: Session = Depends(get_db)
):
    flight = db.query(FlightPlan).filter(
        FlightPlan.flight_number == flight_number
    ).first()
    
    if not flight:
        raise HTTPException(status_code=404, detail=f"航班 {flight_number} 不存在")
    
    update_data = update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(flight, key, value)
    
    audit = AuditLog(
        action="UPDATE_FLIGHT",
        entity_type="FlightPlan",
        flight_number=flight_number,
        details=f"更新航班 {flight_number} 信息"
    )
    db.add(audit)
    
    db.commit()
    db.refresh(flight)
    
    return {"message": "更新成功", "flight": flight.to_dict()}


@router.delete("/{flight_number}", response_model=dict)
def delete_flight(flight_number: str, db: Session = Depends(get_db)):
    flight = db.query(FlightPlan).filter(
        FlightPlan.flight_number == flight_number
    ).first()
    
    if not flight:
        raise HTTPException(status_code=404, detail=f"航班 {flight_number} 不存在")
    
    db.delete(flight)
    
    audit = AuditLog(
        action="DELETE_FLIGHT",
        entity_type="FlightPlan",
        flight_number=flight_number,
        details=f"删除航班 {flight_number}"
    )
    db.add(audit)
    
    db.commit()
    
    return {"message": "删除成功"}
