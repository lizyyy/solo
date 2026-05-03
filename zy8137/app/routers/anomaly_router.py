from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from datetime import datetime

from app.database import get_db
from app.models import AnomalyRecord, WorkSession, Machinery

router = APIRouter(prefix="/anomaly", tags=["异常明细"])


@router.get("/list", response_model=Dict[str, Any])
async def list_anomalies(
    machine_id: Optional[str] = Query(None, description="机器编号"),
    anomaly_type: Optional[str] = Query(None, description="异常类型"),
    severity: Optional[str] = Query(None, description="严重程度: high, medium, low"),
    resolved: Optional[bool] = Query(None, description="是否已解决"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(AnomalyRecord)
        
        if machine_id:
            query = query.filter(AnomalyRecord.machine_id == machine_id)
        
        if anomaly_type:
            query = query.filter(AnomalyRecord.anomaly_type == anomaly_type)
        
        if severity:
            query = query.filter(AnomalyRecord.severity == severity)
        
        if resolved is not None:
            query = query.filter(AnomalyRecord.resolved == resolved)
        
        total_count = query.count()
        
        query = query.order_by(
            AnomalyRecord.severity.asc(),
            AnomalyRecord.detected_at.desc()
        )
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        anomalies = query.all()
        
        anomaly_list = []
        for a in anomalies:
            work_session = db.query(WorkSession).filter(
                WorkSession.session_id == a.work_session_id
            ).first()
            
            machine = db.query(Machinery).filter(
                Machinery.machine_id == a.machine_id
            ).first()
            
            anomaly_list.append({
                "anomaly_id": a.anomaly_id,
                "work_session_id": a.work_session_id,
                "machine_id": a.machine_id,
                "machine_name": machine.machine_name if machine else None,
                "plot_id": a.plot_id,
                "anomaly_type": a.anomaly_type,
                "severity": a.severity,
                "description": a.description,
                "details": a.details,
                "detected_at": a.detected_at.isoformat() if a.detected_at else None,
                "resolved": a.resolved,
                "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
                "resolution_notes": a.resolution_notes,
                "work_session_info": {
                    "start_time": work_session.start_time.isoformat() if work_session else None,
                    "end_time": work_session.end_time.isoformat() if work_session else None,
                    "total_area_mu": work_session.calculated_area_mu if work_session else None
                } if work_session else None
            })
        
        return {
            "success": True,
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "data": anomaly_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.get("/{anomaly_id}", response_model=Dict[str, Any])
async def get_anomaly_detail(
    anomaly_id: str,
    db: Session = Depends(get_db)
):
    try:
        anomaly = db.query(AnomalyRecord).filter(
            AnomalyRecord.anomaly_id == anomaly_id
        ).first()
        
        if not anomaly:
            raise HTTPException(status_code=404, detail="异常记录不存在")
        
        work_session = db.query(WorkSession).filter(
            WorkSession.session_id == anomaly.work_session_id
        ).first()
        
        machine = db.query(Machinery).filter(
            Machinery.machine_id == anomaly.machine_id
        ).first()
        
        return {
            "success": True,
            "data": {
                "anomaly_id": anomaly.anomaly_id,
                "work_session_id": anomaly.work_session_id,
                "machine": {
                    "machine_id": machine.machine_id if machine else None,
                    "machine_name": machine.machine_name if machine else None,
                    "machine_type": machine.machine_type if machine else None
                },
                "plot_id": anomaly.plot_id,
                "anomaly_type": anomaly.anomaly_type,
                "severity": anomaly.severity,
                "description": anomaly.description,
                "details": anomaly.details,
                "detected_at": anomaly.detected_at.isoformat() if anomaly.detected_at else None,
                "resolved": anomaly.resolved,
                "resolved_at": anomaly.resolved_at.isoformat() if anomaly.resolved_at else None,
                "resolution_notes": anomaly.resolution_notes,
                "work_session": {
                    "session_id": work_session.session_id if work_session else None,
                    "start_time": work_session.start_time.isoformat() if work_session else None,
                    "end_time": work_session.end_time.isoformat() if work_session else None,
                    "is_cross_midnight": work_session.is_cross_midnight if work_session else None,
                    "has_boundary_missing": work_session.has_boundary_missing if work_session else None
                } if work_session else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.post("/{anomaly_id}/resolve", response_model=Dict[str, Any])
async def resolve_anomaly(
    anomaly_id: str,
    resolution_notes: str = Query(..., description="解决备注"),
    db: Session = Depends(get_db)
):
    try:
        anomaly = db.query(AnomalyRecord).filter(
            AnomalyRecord.anomaly_id == anomaly_id
        ).first()
        
        if not anomaly:
            raise HTTPException(status_code=404, detail="异常记录不存在")
        
        anomaly.resolved = True
        anomaly.resolved_at = datetime.now()
        anomaly.resolution_notes = resolution_notes
        
        db.commit()
        
        return {
            "success": True,
            "message": "异常已标记为已解决",
            "anomaly_id": anomaly_id
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@router.get("/statistics/summary", response_model=Dict[str, Any])
async def get_anomaly_statistics(
    machine_id: Optional[str] = Query(None, description="机器编号"),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(AnomalyRecord)
        
        if machine_id:
            query = query.filter(AnomalyRecord.machine_id == machine_id)
        
        total_count = query.count()
        
        unresolved_count = query.filter(AnomalyRecord.resolved == False).count()
        
        severity_counts = {
            "high": query.filter(AnomalyRecord.severity == "high").count(),
            "medium": query.filter(AnomalyRecord.severity == "medium").count(),
            "low": query.filter(AnomalyRecord.severity == "low").count()
        }
        
        type_counts = {}
        types = query.with_entities(AnomalyRecord.anomaly_type).distinct().all()
        for (typ,) in types:
            if typ:
                type_counts[typ] = query.filter(AnomalyRecord.anomaly_type == typ).count()
        
        return {
            "success": True,
            "data": {
                "total_count": total_count,
                "unresolved_count": unresolved_count,
                "resolved_count": total_count - unresolved_count,
                "severity_counts": severity_counts,
                "type_counts": type_counts
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")
