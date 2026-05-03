from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import Anomaly, AnomalyStatus
from app.schemas import AnomalyResponse, AnomalyReview

router = APIRouter(prefix="/anomalies", tags=["异常复核"])


@router.get("/", response_model=List[AnomalyResponse])
def list_anomalies(
    anomaly_type: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(Anomaly)
    
    if anomaly_type:
        query = query.filter(Anomaly.anomaly_type == anomaly_type)
    if status:
        query = query.filter(Anomaly.status == status)
    
    anomalies = query.order_by(Anomaly.detected_at.desc()).offset(skip).limit(limit).all()
    return anomalies


@router.get("/pending", response_model=List[AnomalyResponse])
def get_pending_anomalies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    anomalies = db.query(Anomaly).filter(
        Anomaly.status == AnomalyStatus.PENDING.value
    ).order_by(Anomaly.detected_at.desc()).offset(skip).limit(limit).all()
    return anomalies


@router.get("/stats")
def get_anomaly_stats(
    db: Session = Depends(get_db)
):
    from sqlalchemy import func
    
    total = db.query(func.count(Anomaly.id)).scalar()
    pending = db.query(func.count(Anomaly.id)).filter(
        Anomaly.status == AnomalyStatus.PENDING.value
    ).scalar()
    reviewed = db.query(func.count(Anomaly.id)).filter(
        Anomaly.status == AnomalyStatus.REVIEWED.value
    ).scalar()
    resolved = db.query(func.count(Anomaly.id)).filter(
        Anomaly.status == AnomalyStatus.RESOLVED.value
    ).scalar()
    dismissed = db.query(func.count(Anomaly.id)).filter(
        Anomaly.status == AnomalyStatus.DISMISSED.value
    ).scalar()
    
    type_stats = db.query(
        Anomaly.anomaly_type,
        func.count(Anomaly.id).label('count')
    ).group_by(Anomaly.anomaly_type).all()
    
    return {
        "total": total or 0,
        "by_status": {
            "pending": pending or 0,
            "reviewed": reviewed or 0,
            "resolved": resolved or 0,
            "dismissed": dismissed or 0
        },
        "by_type": {stat.anomaly_type: stat.count for stat in type_stats}
    }


@router.get("/{anomaly_id}", response_model=AnomalyResponse)
def get_anomaly(
    anomaly_id: int,
    db: Session = Depends(get_db)
):
    anomaly = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail=f"未找到异常记录 ID: {anomaly_id}")
    return anomaly


@router.put("/{anomaly_id}/review", response_model=AnomalyResponse)
def review_anomaly(
    anomaly_id: int,
    review_data: AnomalyReview,
    db: Session = Depends(get_db)
):
    anomaly = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail=f"未找到异常记录 ID: {anomaly_id}")
    
    anomaly.status = review_data.status.value
    anomaly.review_notes = review_data.review_notes
    anomaly.reviewed_by = review_data.reviewed_by
    anomaly.reviewed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(anomaly)
    
    return anomaly


@router.put("/batch-review", response_model=dict)
def batch_review_anomalies(
    anomaly_ids: List[int],
    review_data: AnomalyReview,
    db: Session = Depends(get_db)
):
    updated_count = 0
    errors = []
    
    for anomaly_id in anomaly_ids:
        anomaly = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
        if anomaly:
            anomaly.status = review_data.status.value
            anomaly.review_notes = review_data.review_notes
            anomaly.reviewed_by = review_data.reviewed_by
            anomaly.reviewed_at = datetime.utcnow()
            updated_count += 1
        else:
            errors.append(f"未找到异常记录 ID: {anomaly_id}")
    
    db.commit()
    
    return {
        "success": True,
        "updated_count": updated_count,
        "errors": errors
    }


@router.delete("/{anomaly_id}", response_model=dict)
def delete_anomaly(
    anomaly_id: int,
    db: Session = Depends(get_db)
):
    anomaly = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail=f"未找到异常记录 ID: {anomaly_id}")
    
    db.delete(anomaly)
    db.commit()
    
    return {"success": True, "message": f"异常记录 {anomaly_id} 已删除"}
