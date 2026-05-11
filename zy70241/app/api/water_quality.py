from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import io
import pandas as pd

from app.database import get_db
from app.models import WaterQualityRecord, Filter
from app.schemas import WaterQualityCreate, WaterQualityResponse, ImportResult
from app.data_processor import DataImporter

router = APIRouter()

@router.post("/", response_model=WaterQualityResponse)
def create_water_quality(data: WaterQualityCreate, db: Session = Depends(get_db)):
    filter_obj = db.query(Filter).filter(Filter.filter_id == data.filter_id).first()
    if not filter_obj:
        raise HTTPException(status_code=404, detail="滤芯不存在")
    
    db_record = WaterQualityRecord(**data.dict())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

@router.get("/", response_model=List[WaterQualityResponse])
def list_water_quality(
    filter_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    is_valid: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(WaterQualityRecord)
    
    if filter_id:
        query = query.filter(WaterQualityRecord.filter_id == filter_id)
    if start_date:
        query = query.filter(WaterQualityRecord.record_date >= start_date)
    if end_date:
        query = query.filter(WaterQualityRecord.record_date <= end_date)
    if is_valid is not None:
        query = query.filter(WaterQualityRecord.is_valid == is_valid)
    
    return query.order_by(WaterQualityRecord.record_date.desc()).offset(skip).limit(limit).all()

@router.get("/{record_id}", response_model=WaterQualityResponse)
def get_water_quality(record_id: int, db: Session = Depends(get_db)):
    record = db.query(WaterQualityRecord).filter(WaterQualityRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record

@router.delete("/{record_id}")
def delete_water_quality(record_id: int, db: Session = Depends(get_db)):
    record = db.query(WaterQualityRecord).filter(WaterQualityRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    db.delete(record)
    db.commit()
    return {"message": "记录已删除"}

@router.post("/import", response_model=ImportResult)
async def import_water_quality(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    file_type = file.filename.split('.')[-1].lower()
    
    importer = DataImporter()
    
    result = importer.import_from_file(content, file_type, 'water_quality')
    
    if not result['success']:
        raise HTTPException(status_code=400, detail=result.get('error', '导入失败'))
    
    df = result['cleaned_data']
    total_records = result['total_records']
    valid_count = 0
    invalid_count = 0
    
    for _, row in df.iterrows():
        try:
            filter_id = str(row.get('filter_id', ''))
            filter_obj = db.query(Filter).filter(Filter.filter_id == filter_id).first()
            if not filter_obj:
                invalid_count += 1
                continue
            
            is_valid = bool(row.get('is_valid', True))
            
            db_record = WaterQualityRecord(
                filter_id=filter_id,
                record_date=pd.to_datetime(row['record_date']).to_pydatetime(),
                turbidity=float(row['turbidity']) if pd.notna(row.get('turbidity')) else None,
                ph=float(row['ph']) if pd.notna(row.get('ph')) else None,
                residual_chlorine=float(row['residual_chlorine']) if pd.notna(row.get('residual_chlorine')) else None,
                conductivity=float(row['conductivity']) if pd.notna(row.get('conductivity')) else None,
                total_dissolved_solids=float(row['total_dissolved_solids']) if pd.notna(row.get('total_dissolved_solids')) else None,
                color=float(row['color']) if pd.notna(row.get('color')) else None,
                odor=str(row['odor']) if pd.notna(row.get('odor')) else None,
                is_valid=is_valid
            )
            db.add(db_record)
            
            if is_valid:
                valid_count += 1
            else:
                invalid_count += 1
        except Exception:
            invalid_count += 1
    
    db.commit()
    
    return ImportResult(
        total_records=total_records,
        valid_records=valid_count,
        invalid_records=invalid_count,
        warnings=result.get('warnings', []),
        errors=result.get('errors', [])
    )

@router.get("/filter/{filter_id}/summary")
def get_water_quality_summary(filter_id: str, days: int = 30, db: Session = Depends(get_db)):
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    records = db.query(WaterQualityRecord).filter(
        WaterQualityRecord.filter_id == filter_id,
        WaterQualityRecord.record_date >= cutoff_date,
        WaterQualityRecord.is_valid == True
    ).all()
    
    if not records:
        return {"message": "无数据", "record_count": 0}
    
    summary = {
        "record_count": len(records),
        "time_range_days": days,
        "parameters": {}
    }
    
    params = ['turbidity', 'ph', 'residual_chlorine', 'conductivity', 'total_dissolved_solids', 'color']
    
    for param in params:
        values = [getattr(r, param) for r in records if getattr(r, param) is not None]
        if values:
            summary["parameters"][param] = {
                "count": len(values),
                "min": min(values),
                "max": max(values),
                "avg": sum(values) / len(values)
            }
    
    return summary
