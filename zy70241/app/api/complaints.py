from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import io
import pandas as pd

from app.database import get_db
from app.models import Complaint, Filter
from app.schemas import ComplaintCreate, ComplaintUpdate, ComplaintResponse, ImportResult
from app.data_processor import DataImporter

router = APIRouter()

@router.post("/", response_model=ComplaintResponse)
def create_complaint(data: ComplaintCreate, db: Session = Depends(get_db)):
    filter_obj = db.query(Filter).filter(Filter.filter_id == data.filter_id).first()
    if not filter_obj:
        raise HTTPException(status_code=404, detail="滤芯不存在")
    
    valid_severities = ['low', 'medium', 'high', 'critical']
    if data.severity.lower() not in valid_severities:
        raise HTTPException(status_code=400, detail=f"严重程度必须是: {', '.join(valid_severities)}")
    
    db_record = Complaint(**data.dict())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

@router.get("/", response_model=List[ComplaintResponse])
def list_complaints(
    filter_id: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Complaint)
    
    if filter_id:
        query = query.filter(Complaint.filter_id == filter_id)
    if status:
        query = query.filter(Complaint.status == status)
    if severity:
        query = query.filter(Complaint.severity == severity)
    if start_date:
        query = query.filter(Complaint.complaint_date >= start_date)
    if end_date:
        query = query.filter(Complaint.complaint_date <= end_date)
    
    return query.order_by(Complaint.complaint_date.desc()).offset(skip).limit(limit).all()

@router.get("/{complaint_id}", response_model=ComplaintResponse)
def get_complaint(complaint_id: int, db: Session = Depends(get_db)):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="投诉不存在")
    return complaint

@router.put("/{complaint_id}", response_model=ComplaintResponse)
def update_complaint(complaint_id: int, update_data: ComplaintUpdate, db: Session = Depends(get_db)):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="投诉不存在")
    
    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(complaint, key, value)
    
    if update_data.status == 'resolved' and not complaint.resolved_date:
        complaint.resolved_date = datetime.utcnow()
    
    db.commit()
    db.refresh(complaint)
    return complaint

@router.delete("/{complaint_id}")
def delete_complaint(complaint_id: int, db: Session = Depends(get_db)):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="投诉不存在")
    
    db.delete(complaint)
    db.commit()
    return {"message": "投诉已删除"}

@router.post("/import", response_model=ImportResult)
async def import_complaints(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    file_type = file.filename.split('.')[-1].lower()
    
    importer = DataImporter()
    
    result = importer.import_from_file(content, file_type, 'complaints')
    
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
            
            db_record = Complaint(
                filter_id=filter_id,
                complaint_date=pd.to_datetime(row['complaint_date']).to_pydatetime(),
                complaint_type=str(row['complaint_type']),
                description=str(row['description']),
                severity=str(row.get('severity', 'medium')).lower(),
                reporter=str(row['reporter']) if pd.notna(row.get('reporter')) else None,
                status=str(row.get('status', 'open'))
            )
            db.add(db_record)
            valid_count += 1
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

@router.get("/filter/{filter_id}/stats")
def get_complaint_stats(filter_id: str, days: int = 90, db: Session = Depends(get_db)):
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    complaints = db.query(Complaint).filter(
        Complaint.filter_id == filter_id,
        Complaint.complaint_date >= cutoff_date
    ).all()
    
    if not complaints:
        return {"message": "无投诉记录", "total_count": 0}
    
    stats = {
        "total_count": len(complaints),
        "open_count": sum(1 for c in complaints if c.status == 'open'),
        "resolved_count": sum(1 for c in complaints if c.status == 'resolved'),
        "severity_distribution": {},
        "type_distribution": {}
    }
    
    for complaint in complaints:
        severity = complaint.severity.lower()
        stats["severity_distribution"][severity] = stats["severity_distribution"].get(severity, 0) + 1
        
        ctype = complaint.complaint_type
        stats["type_distribution"][ctype] = stats["type_distribution"].get(ctype, 0) + 1
    
    return stats
