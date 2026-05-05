from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import io
import pandas as pd

from database import get_db
from models.deice import DeiceFluidRecord
from models.flight import FlightPlan
from models.audit import AuditLog
from pydantic import BaseModel

router = APIRouter(prefix="/api/deice", tags=["除冰液记录"])


class DeiceRecordCreate(BaseModel):
    flight_number: str
    batch_number: str
    fluid_type: Optional[str] = None
    measured_concentration: float
    target_concentration: Optional[float] = None
    temperature_applied: Optional[float] = None
    application_start_time: Optional[datetime] = None
    application_end_time: Optional[datetime] = None
    total_volume_used: Optional[float] = None
    technician_name: Optional[str] = None
    is_second_deicing: int = 0
    previous_deice_id: Optional[int] = None


@router.post("/", response_model=dict)
def create_deice_record(record: DeiceRecordCreate, db: Session = Depends(get_db)):
    flight = db.query(FlightPlan).filter(
        FlightPlan.flight_number == record.flight_number
    ).first()
    if not flight:
        raise HTTPException(
            status_code=404,
            detail=f"航班 {record.flight_number} 不存在"
        )
    
    db_record = DeiceFluidRecord(
        flight_number=record.flight_number,
        batch_number=record.batch_number,
        fluid_type=record.fluid_type,
        measured_concentration=record.measured_concentration,
        target_concentration=record.target_concentration,
        temperature_applied=record.temperature_applied,
        application_start_time=record.application_start_time,
        application_end_time=record.application_end_time,
        total_volume_used=record.total_volume_used,
        technician_name=record.technician_name,
        is_second_deicing=record.is_second_deicing,
        previous_deice_id=record.previous_deice_id
    )
    db.add(db_record)
    
    audit = AuditLog(
        action="CREATE_DEICE_RECORD",
        entity_type="DeiceFluidRecord",
        flight_number=record.flight_number,
        details=f"创建除冰液记录，批次号: {record.batch_number}"
    )
    db.add(audit)
    
    db.commit()
    db.refresh(db_record)
    
    return {"message": "创建成功", "record": db_record.to_dict()}


@router.post("/import/csv", response_model=dict)
def import_deice_csv(
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
    
    required_columns = ['flight_number', 'batch_number', 'measured_concentration']
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
            batch_number = str(row.get('batch_number', '')).strip()
            
            if not flight_number or not batch_number:
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
            
            def parse_float(val):
                if pd.isna(val) or val == '':
                    return None
                try:
                    return float(val)
                except:
                    return None
            
            def parse_int(val):
                if pd.isna(val) or val == '':
                    return 0
                try:
                    return int(val)
                except:
                    return 0
            
            new_record = DeiceFluidRecord(
                flight_number=flight_number,
                batch_number=batch_number,
                fluid_type=str(row.get('fluid_type', '')).strip() if row.get('fluid_type') and not pd.isna(row.get('fluid_type')) else None,
                measured_concentration=parse_float(row.get('measured_concentration', 0)) or 0,
                target_concentration=parse_float(row.get('target_concentration')),
                temperature_applied=parse_float(row.get('temperature_applied')),
                application_start_time=parse_datetime(row.get('application_start_time')),
                application_end_time=parse_datetime(row.get('application_end_time')),
                total_volume_used=parse_float(row.get('total_volume_used')),
                technician_name=str(row.get('technician_name', '')).strip() if row.get('technician_name') and not pd.isna(row.get('technician_name')) else None,
                is_second_deicing=parse_int(row.get('is_second_deicing', 0)),
                previous_deice_id=parse_int(row.get('previous_deice_id')) if row.get('previous_deice_id') and not pd.isna(row.get('previous_deice_id')) else None
            )
            db.add(new_record)
            
            audit = AuditLog(
                action="IMPORT_DEICE_RECORD",
                entity_type="DeiceFluidRecord",
                flight_number=flight_number,
                details=f"导入除冰液记录，批次号: {batch_number}"
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
def get_deice_records(
    skip: int = 0,
    limit: int = 100,
    flight_number: Optional[str] = None,
    batch_number: Optional[str] = None,
    is_second_deicing: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(DeiceFluidRecord)
    
    if flight_number:
        query = query.filter(DeiceFluidRecord.flight_number.contains(flight_number))
    if batch_number:
        query = query.filter(DeiceFluidRecord.batch_number.contains(batch_number))
    if is_second_deicing is not None:
        query = query.filter(DeiceFluidRecord.is_second_deicing == is_second_deicing)
    
    total = query.count()
    records = query.order_by(DeiceFluidRecord.application_start_time.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "records": [r.to_dict() for r in records]
    }


@router.get("/flight/{flight_number}", response_model=dict)
def get_deice_by_flight(flight_number: str, db: Session = Depends(get_db)):
    records = db.query(DeiceFluidRecord).filter(
        DeiceFluidRecord.flight_number == flight_number
    ).order_by(DeiceFluidRecord.application_start_time.asc()).all()
    
    return {
        "flight_number": flight_number,
        "total": len(records),
        "records": [r.to_dict() for r in records]
    }


@router.get("/{record_id}", response_model=dict)
def get_deice_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(DeiceFluidRecord).filter(
        DeiceFluidRecord.id == record_id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail=f"除冰液记录 {record_id} 不存在")
    
    return {"record": record.to_dict()}


@router.delete("/{record_id}", response_model=dict)
def delete_deice_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(DeiceFluidRecord).filter(
        DeiceFluidRecord.id == record_id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail=f"除冰液记录 {record_id} 不存在")
    
    flight_number = record.flight_number
    db.delete(record)
    
    audit = AuditLog(
        action="DELETE_DEICE_RECORD",
        entity_type="DeiceFluidRecord",
        flight_number=flight_number,
        details=f"删除除冰液记录 ID: {record_id}"
    )
    db.add(audit)
    
    db.commit()
    
    return {"message": "删除成功"}
