from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import io
import pandas as pd

from database import get_db
from models.gate import GateOperationLog
from models.flight import FlightPlan
from models.audit import AuditLog
from pydantic import BaseModel

router = APIRouter(prefix="/api/gate", tags=["机位作业日志"])


class GateLogCreate(BaseModel):
    flight_number: str
    gate_number: Optional[str] = None
    stand_number: Optional[str] = None
    arrival_time: Optional[datetime] = None
    departure_time: Optional[datetime] = None
    gate_available_time: Optional[datetime] = None
    gate_occupied_time: Optional[datetime] = None
    operation_type: Optional[str] = None
    operation_status: Optional[str] = None
    deice_available_time: Optional[datetime] = None
    deice_completed_time: Optional[datetime] = None
    crew_ready_time: Optional[datetime] = None
    boarding_completed_time: Optional[datetime] = None
    baggage_loaded_time: Optional[datetime] = None
    fuel_loaded_time: Optional[datetime] = None


@router.post("/", response_model=dict)
def create_gate_log(log: GateLogCreate, db: Session = Depends(get_db)):
    flight = db.query(FlightPlan).filter(
        FlightPlan.flight_number == log.flight_number
    ).first()
    if not flight:
        raise HTTPException(
            status_code=404,
            detail=f"航班 {log.flight_number} 不存在"
        )
    
    db_log = GateOperationLog(
        flight_number=log.flight_number,
        gate_number=log.gate_number,
        stand_number=log.stand_number,
        arrival_time=log.arrival_time,
        departure_time=log.departure_time,
        gate_available_time=log.gate_available_time,
        gate_occupied_time=log.gate_occupied_time,
        operation_type=log.operation_type,
        operation_status=log.operation_status,
        deice_available_time=log.deice_available_time,
        deice_completed_time=log.deice_completed_time,
        crew_ready_time=log.crew_ready_time,
        boarding_completed_time=log.boarding_completed_time,
        baggage_loaded_time=log.baggage_loaded_time,
        fuel_loaded_time=log.fuel_loaded_time
    )
    db.add(db_log)
    
    audit = AuditLog(
        action="CREATE_GATE_LOG",
        entity_type="GateOperationLog",
        flight_number=log.flight_number,
        details=f"创建机位作业日志"
    )
    db.add(audit)
    
    db.commit()
    db.refresh(db_log)
    
    return {"message": "创建成功", "log": db_log.to_dict()}


@router.post("/import/csv", response_model=dict)
def import_gate_csv(
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
    errors = []
    
    for idx, row in df.iterrows():
        try:
            flight_number = str(row.get('flight_number', '')).strip()
            if not flight_number:
                continue
            
            flight = db.query(FlightPlan).filter(
                FlightPlan.flight_number == flight_number
            ).first()
            if not flight:
                errors.append(f"第 {idx+1} 行: 航班 {flight_number} 不存在")
                continue
            
            def parse_datetime(val):
                if pd.isna(val) or val == '':
                    return None
                try:
                    if isinstance(val, str):
                        return datetime.strptime(val, '%Y-%m-%d %H:%M:%S')
                    return val
                except:
                    return None
            
            new_log = GateOperationLog(
                flight_number=flight_number,
                gate_number=str(row.get('gate_number', '')).strip() if row.get('gate_number') and not pd.isna(row.get('gate_number')) else None,
                stand_number=str(row.get('stand_number', '')).strip() if row.get('stand_number') and not pd.isna(row.get('stand_number')) else None,
                arrival_time=parse_datetime(row.get('arrival_time')),
                departure_time=parse_datetime(row.get('departure_time')),
                gate_available_time=parse_datetime(row.get('gate_available_time')),
                gate_occupied_time=parse_datetime(row.get('gate_occupied_time')),
                operation_type=str(row.get('operation_type', '')).strip() if row.get('operation_type') and not pd.isna(row.get('operation_type')) else None,
                operation_status=str(row.get('operation_status', '')).strip() if row.get('operation_status') and not pd.isna(row.get('operation_status')) else None,
                deice_available_time=parse_datetime(row.get('deice_available_time')),
                deice_completed_time=parse_datetime(row.get('deice_completed_time')),
                crew_ready_time=parse_datetime(row.get('crew_ready_time')),
                boarding_completed_time=parse_datetime(row.get('boarding_completed_time')),
                baggage_loaded_time=parse_datetime(row.get('baggage_loaded_time')),
                fuel_loaded_time=parse_datetime(row.get('fuel_loaded_time'))
            )
            db.add(new_log)
            
            audit = AuditLog(
                action="IMPORT_GATE_LOG",
                entity_type="GateOperationLog",
                flight_number=flight_number,
                details=f"导入机位作业日志"
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
        "errors": errors
    }


@router.get("/", response_model=dict)
def get_gate_logs(
    skip: int = 0,
    limit: int = 100,
    flight_number: Optional[str] = None,
    gate_number: Optional[str] = None,
    operation_status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(GateOperationLog)
    
    if flight_number:
        query = query.filter(GateOperationLog.flight_number.contains(flight_number))
    if gate_number:
        query = query.filter(GateOperationLog.gate_number == gate_number)
    if operation_status:
        query = query.filter(GateOperationLog.operation_status == operation_status)
    
    total = query.count()
    logs = query.order_by(GateOperationLog.arrival_time.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "logs": [l.to_dict() for l in logs]
    }


@router.get("/flight/{flight_number}", response_model=dict)
def get_gate_by_flight(flight_number: str, db: Session = Depends(get_db)):
    logs = db.query(GateOperationLog).filter(
        GateOperationLog.flight_number == flight_number
    ).order_by(GateOperationLog.arrival_time.asc()).all()
    
    return {
        "flight_number": flight_number,
        "total": len(logs),
        "logs": [l.to_dict() for l in logs]
    }


@router.get("/{log_id}", response_model=dict)
def get_gate_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(GateOperationLog).filter(
        GateOperationLog.id == log_id
    ).first()
    
    if not log:
        raise HTTPException(status_code=404, detail=f"机位日志 {log_id} 不存在")
    
    return {"log": log.to_dict()}


@router.put("/{log_id}", response_model=dict)
def update_gate_log(
    log_id: int,
    update: GateLogCreate,
    db: Session = Depends(get_db)
):
    log = db.query(GateOperationLog).filter(
        GateOperationLog.id == log_id
    ).first()
    
    if not log:
        raise HTTPException(status_code=404, detail=f"机位日志 {log_id} 不存在")
    
    update_data = update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(log, key, value)
    
    audit = AuditLog(
        action="UPDATE_GATE_LOG",
        entity_type="GateOperationLog",
        flight_number=log.flight_number,
        details=f"更新机位作业日志 ID: {log_id}"
    )
    db.add(audit)
    
    db.commit()
    db.refresh(log)
    
    return {"message": "更新成功", "log": log.to_dict()}


@router.delete("/{log_id}", response_model=dict)
def delete_gate_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(GateOperationLog).filter(
        GateOperationLog.id == log_id
    ).first()
    
    if not log:
        raise HTTPException(status_code=404, detail=f"机位日志 {log_id} 不存在")
    
    flight_number = log.flight_number
    db.delete(log)
    
    audit = AuditLog(
        action="DELETE_GATE_LOG",
        entity_type="GateOperationLog",
        flight_number=flight_number,
        details=f"删除机位作业日志 ID: {log_id}"
    )
    db.add(audit)
    
    db.commit()
    
    return {"message": "删除成功"}
