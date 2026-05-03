from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List
import json

from app.database import get_db, RiskAnomaly
from app.risk_detection import RiskDetector
from app.schemas import (
    RiskCheckResponse, RiskAnomalyResponse, AnomalyConfirmRequest
)

router = APIRouter(prefix="/api/risk", tags=["风险检测"])


@router.post("/check", response_model=RiskCheckResponse)
async def run_risk_check(
    start_time: Optional[datetime] = Query(None, description="检查起始时间"),
    end_time: Optional[datetime] = Query(None, description="检查结束时间"),
    clear_existing: bool = Query(False, description="是否清除未确认的现有异常"),
    db: Session = Depends(get_db)
):
    result = RiskDetector.run_all_checks(
        db,
        start_time=start_time,
        end_time=end_time,
        clear_existing=clear_existing
    )
    
    return RiskCheckResponse(**result)


@router.get("/anomalies", response_model=List[RiskAnomalyResponse])
async def get_anomalies(
    anomaly_type: Optional[str] = Query(None, description="风险类型过滤"),
    severity: Optional[str] = Query(None, description="风险等级过滤"),
    is_confirmed: Optional[bool] = Query(None, description="是否已确认"),
    cabin_code: Optional[str] = Query(None, description="舱室代码过滤"),
    start_time: Optional[datetime] = Query(None, description="起始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(RiskAnomaly)
    
    if anomaly_type:
        query = query.filter(RiskAnomaly.anomaly_type == anomaly_type)
    if severity:
        query = query.filter(RiskAnomaly.severity == severity)
    if is_confirmed is not None:
        query = query.filter(RiskAnomaly.is_confirmed == is_confirmed)
    if cabin_code:
        query = query.filter(RiskAnomaly.cabin_code == cabin_code)
    if start_time:
        query = query.filter(RiskAnomaly.start_time >= start_time)
    if end_time:
        query = query.filter(RiskAnomaly.start_time <= end_time)
    
    anomalies = query.order_by(
        RiskAnomaly.severity.desc(),
        RiskAnomaly.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    result = []
    for anomaly in anomalies:
        anomaly_dict = {
            "id": anomaly.id,
            "anomaly_type": anomaly.anomaly_type,
            "severity": anomaly.severity,
            "cabin_code": anomaly.cabin_code,
            "work_ticket_id": anomaly.work_ticket_id,
            "sensor_log_id": anomaly.sensor_log_id,
            "sensor_id": anomaly.sensor_id,
            "start_time": anomaly.start_time,
            "end_time": anomaly.end_time,
            "description": anomaly.description,
            "details": json.loads(anomaly.details) if anomaly.details else None,
            "is_confirmed": anomaly.is_confirmed,
            "confirmed_by": anomaly.confirmed_by,
            "confirmed_at": anomaly.confirmed_at,
            "created_at": anomaly.created_at
        }
        result.append(anomaly_dict)
    
    return result


@router.get("/anomalies/{anomaly_id}", response_model=RiskAnomalyResponse)
async def get_anomaly(
    anomaly_id: int,
    db: Session = Depends(get_db)
):
    anomaly = db.query(RiskAnomaly).filter(RiskAnomaly.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    
    return {
        "id": anomaly.id,
        "anomaly_type": anomaly.anomaly_type,
        "severity": anomaly.severity,
        "cabin_code": anomaly.cabin_code,
        "work_ticket_id": anomaly.work_ticket_id,
        "sensor_log_id": anomaly.sensor_log_id,
        "sensor_id": anomaly.sensor_id,
        "start_time": anomaly.start_time,
        "end_time": anomaly.end_time,
        "description": anomaly.description,
        "details": json.loads(anomaly.details) if anomaly.details else None,
        "is_confirmed": anomaly.is_confirmed,
        "confirmed_by": anomaly.confirmed_by,
        "confirmed_at": anomaly.confirmed_at,
        "created_at": anomaly.created_at
    }


@router.post("/anomalies/{anomaly_id}/confirm", response_model=RiskAnomalyResponse)
async def confirm_anomaly(
    anomaly_id: int,
    request: AnomalyConfirmRequest,
    db: Session = Depends(get_db)
):
    anomaly = db.query(RiskAnomaly).filter(RiskAnomaly.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    
    if anomaly.is_confirmed:
        raise HTTPException(status_code=400, detail="该异常已经确认，无法重复确认")
    
    anomaly.is_confirmed = request.confirmed
    anomaly.confirmed_by = request.confirmed_by
    anomaly.confirmation_notes = request.notes
    anomaly.confirmed_at = datetime.now()
    
    db.commit()
    db.refresh(anomaly)
    
    return {
        "id": anomaly.id,
        "anomaly_type": anomaly.anomaly_type,
        "severity": anomaly.severity,
        "cabin_code": anomaly.cabin_code,
        "work_ticket_id": anomaly.work_ticket_id,
        "sensor_log_id": anomaly.sensor_log_id,
        "sensor_id": anomaly.sensor_id,
        "start_time": anomaly.start_time,
        "end_time": anomaly.end_time,
        "description": anomaly.description,
        "details": json.loads(anomaly.details) if anomaly.details else None,
        "is_confirmed": anomaly.is_confirmed,
        "confirmed_by": anomaly.confirmed_by,
        "confirmed_at": anomaly.confirmed_at,
        "created_at": anomaly.created_at
    }


@router.delete("/anomalies/{anomaly_id}")
async def delete_anomaly(
    anomaly_id: int,
    db: Session = Depends(get_db)
):
    anomaly = db.query(RiskAnomaly).filter(RiskAnomaly.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    
    db.delete(anomaly)
    db.commit()
    
    return {"success": True, "message": "异常记录已删除"}
