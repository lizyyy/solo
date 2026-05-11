from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import io
import pandas as pd

from app.database import get_db
from app.models import Filter
from app.schemas import FilterCreate, FilterUpdate, FilterResponse, ImportResult
from app.data_processor import DataImporter

router = APIRouter()

@router.post("/", response_model=FilterResponse)
def create_filter(filter_data: FilterCreate, db: Session = Depends(get_db)):
    existing = db.query(Filter).filter(Filter.filter_id == filter_data.filter_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="滤芯ID已存在")
    
    db_filter = Filter(**filter_data.dict())
    db.add(db_filter)
    db.commit()
    db.refresh(db_filter)
    return db_filter

@router.get("/", response_model=List[FilterResponse])
def list_filters(
    status: Optional[str] = None,
    station_name: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Filter)
    if status:
        query = query.filter(Filter.status == status)
    if station_name:
        query = query.filter(Filter.station_name.contains(station_name))
    
    return query.offset(skip).limit(limit).all()

@router.get("/{filter_id}", response_model=FilterResponse)
def get_filter(filter_id: str, db: Session = Depends(get_db)):
    filter_obj = db.query(Filter).filter(Filter.filter_id == filter_id).first()
    if not filter_obj:
        raise HTTPException(status_code=404, detail="滤芯不存在")
    return filter_obj

@router.put("/{filter_id}", response_model=FilterResponse)
def update_filter(filter_id: str, update_data: FilterUpdate, db: Session = Depends(get_db)):
    filter_obj = db.query(Filter).filter(Filter.filter_id == filter_id).first()
    if not filter_obj:
        raise HTTPException(status_code=404, detail="滤芯不存在")
    
    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(filter_obj, key, value)
    
    db.commit()
    db.refresh(filter_obj)
    return filter_obj

@router.delete("/{filter_id}")
def delete_filter(filter_id: str, db: Session = Depends(get_db)):
    filter_obj = db.query(Filter).filter(Filter.filter_id == filter_id).first()
    if not filter_obj:
        raise HTTPException(status_code=404, detail="滤芯不存在")
    
    db.delete(filter_obj)
    db.commit()
    return {"message": "滤芯已删除"}

@router.post("/import", response_model=ImportResult)
async def import_filters(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    file_type = file.filename.split('.')[-1].lower()
    
    importer = DataImporter()
    
    try:
        if file_type == 'csv':
            df = pd.read_csv(io.BytesIO(content))
        elif file_type in ['xlsx', 'xls']:
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="不支持的文件格式")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件读取失败: {str(e)}")
    
    total_records = len(df)
    valid_count = 0
    invalid_count = 0
    warnings = []
    errors = []
    
    required_cols = ['filter_id', 'station_name', 'filter_type', 'install_date', 'max_lifespan_days', 'max_lifespan_liters']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        raise HTTPException(status_code=400, detail=f"缺少必需列: {', '.join(missing_cols)}")
    
    for _, row in df.iterrows():
        try:
            existing = db.query(Filter).filter(Filter.filter_id == str(row['filter_id'])).first()
            if existing:
                warnings.append(f"滤芯ID {row['filter_id']} 已存在，跳过")
                invalid_count += 1
                continue
            
            install_date = pd.to_datetime(row['install_date']).to_pydatetime()
            
            db_filter = Filter(
                filter_id=str(row['filter_id']),
                station_name=str(row['station_name']),
                filter_type=str(row['filter_type']),
                install_date=install_date,
                max_lifespan_days=int(row['max_lifespan_days']),
                max_lifespan_liters=float(row['max_lifespan_liters']),
                status=str(row.get('status', 'active'))
            )
            db.add(db_filter)
            valid_count += 1
        except Exception as e:
            errors.append(f"记录错误: {str(e)}")
            invalid_count += 1
    
    db.commit()
    
    return ImportResult(
        total_records=total_records,
        valid_records=valid_count,
        invalid_records=invalid_count,
        warnings=warnings,
        errors=errors
    )
