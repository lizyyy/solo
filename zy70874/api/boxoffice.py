from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from typing import List
import pandas as pd
import json
import io
from datetime import datetime

from database import get_db
from models import BoxOfficeRecord, FilmContract
from schemas import BoxOfficeResponse, ImportResponse

router = APIRouter()


@router.post("/import", response_model=ImportResponse)
async def import_boxoffice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="仅支持JSON文件")
    
    content = await file.read()
    
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return ImportResponse(success=False, message="JSON格式错误", imported_count=0, errors=["无效的JSON格式"])
    
    if isinstance(data, dict) and 'records' in data:
        records = data['records']
    elif isinstance(data, list):
        records = data
    else:
        return ImportResponse(success=False, message="JSON格式错误", imported_count=0, errors=["数据格式应为数组或包含records字段的对象"])
    
    imported_count = 0
    errors = []
    
    required_fields = ['session_code', 'film_name', 'film_code', 'show_time']
    
    for idx, record in enumerate(records):
        try:
            for field in required_fields:
                if field not in record:
                    errors.append(f"第{idx+1}条记录: 缺少必需字段 {field}")
                    continue
            
            existing = db.query(BoxOfficeRecord).filter(
                BoxOfficeRecord.session_code == str(record['session_code'])
            ).first()
            
            if existing:
                errors.append(f"第{idx+1}条记录: 场次 {record['session_code']} 的票房记录已存在")
                continue
            
            show_time = pd.to_datetime(record['show_time'])
            
            contract = db.query(FilmContract).filter(
                FilmContract.film_code == str(record['film_code']),
                FilmContract.is_active == True
            ).first()
            
            boxoffice = BoxOfficeRecord(
                session_code=str(record['session_code']),
                film_name=str(record['film_name']),
                film_code=str(record['film_code']),
                show_time=show_time,
                tickets_sold=int(record.get('tickets_sold', 0)),
                tickets_refunded=int(record.get('tickets_refunded', 0)),
                gross_boxoffice=float(record.get('gross_boxoffice', 0)),
                refund_amount=float(record.get('refund_amount', 0)),
                net_boxoffice=float(record.get('net_boxoffice', 0)),
                service_fee=float(record.get('service_fee', 0)),
                contract_id=contract.id if contract else None,
                source_file=file.filename
            )
            db.add(boxoffice)
            imported_count += 1
        except Exception as e:
            errors.append(f"第{idx+1}条记录: {str(e)}")
    
    db.commit()
    
    return ImportResponse(
        success=True,
        message=f"成功导入 {imported_count} 条票房记录",
        imported_count=imported_count,
        errors=errors
    )


@router.get("/", response_model=List[BoxOfficeResponse])
def get_boxoffice_records(
    film_code: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(BoxOfficeRecord)
    if film_code:
        query = query.filter(BoxOfficeRecord.film_code == film_code)
    return query.offset(skip).limit(limit).all()


@router.get("/{record_id}", response_model=BoxOfficeResponse)
def get_boxoffice(record_id: int, db: Session = Depends(get_db)):
    record = db.query(BoxOfficeRecord).filter(BoxOfficeRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="票房记录不存在")
    return record
