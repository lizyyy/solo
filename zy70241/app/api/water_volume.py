from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import io
import pandas as pd

from app.database import get_db
from app.models import WaterVolumeRecord, Filter
from app.schemas import WaterVolumeCreate, WaterVolumeResponse, ImportResult
from app.data_processor import DataImporter

router = APIRouter()

@router.post("/", response_model=WaterVolumeResponse)
def create_water_volume(data: WaterVolumeCreate, db: Session = Depends(get_db)):
    filter_obj = db.query(Filter).filter(Filter.filter_id == data.filter_id).first()
    if not filter_obj:
        raise HTTPException(status_code=404, detail="滤芯不存在")
    
    db_record = WaterVolumeRecord(**data.dict())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

@router.get("/", response_model=List[WaterVolumeResponse])
def list_water_volume(
    filter_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    is_valid: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(WaterVolumeRecord)
    
    if filter_id:
        query = query.filter(WaterVolumeRecord.filter_id == filter_id)
    if start_date:
        query = query.filter(WaterVolumeRecord.record_date >= start_date)
    if end_date:
        query = query.filter(WaterVolumeRecord.record_date <= end_date)
    if is_valid is not None:
        query = query.filter(WaterVolumeRecord.is_valid == is_valid)
    
    return query.order_by(WaterVolumeRecord.record_date.desc()).offset(skip).limit(limit).all()

@router.get("/{record_id}", response_model=WaterVolumeResponse)
def get_water_volume(record_id: int, db: Session = Depends(get_db)):
    record = db.query(WaterVolumeRecord).filter(WaterVolumeRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record

@router.delete("/{record_id}")
def delete_water_volume(record_id: int, db: Session = Depends(get_db)):
    record = db.query(WaterVolumeRecord).filter(WaterVolumeRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    db.delete(record)
    db.commit()
    return {"message": "记录已删除"}

@router.post("/import", response_model=ImportResult)
async def import_water_volume(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    file_type = file.filename.split('.')[-1].lower()
    
    importer = DataImporter()
    
    result = importer.import_from_file(content, file_type, 'water_volume')
    
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
            
            db_record = WaterVolumeRecord(
                filter_id=filter_id,
                record_date=pd.to_datetime(row['record_date']).to_pydatetime(),
                daily_volume_liters=float(row['daily_volume_liters']),
                cumulative_volume_liters=float(row['cumulative_volume_liters']),
                peak_hour=str(row['peak_hour']) if pd.notna(row.get('peak_hour')) else None,
                avg_flow_rate=float(row['avg_flow_rate']) if pd.notna(row.get('avg_flow_rate')) else None,
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
def get_water_volume_summary(filter_id: str, days: int = 30, db: Session = Depends(get_db)):
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    records = db.query(WaterVolumeRecord).filter(
        WaterVolumeRecord.filter_id == filter_id,
        WaterVolumeRecord.record_date >= cutoff_date,
        WaterVolumeRecord.is_valid == True
    ).order_by(WaterVolumeRecord.record_date.asc()).all()
    
    if not records:
        return {"message": "无数据", "record_count": 0}
    
    daily_volumes = [r.daily_volume_liters for r in records]
    
    summary = {
        "record_count": len(records),
        "time_range_days": days,
        "total_volume": sum(daily_volumes),
        "avg_daily_volume": sum(daily_volumes) / len(daily_volumes),
        "max_daily_volume": max(daily_volumes),
        "min_daily_volume": min(daily_volumes),
        "latest_cumulative": records[-1].cumulative_volume_liters if records else 0
    }
    
    return summary
