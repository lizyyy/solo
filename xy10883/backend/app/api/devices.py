from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models import DeviceMetric, AnomalyRecord
from app.schemas import DeviceMetricCreate, DeviceMetric as DeviceMetricSchema

router = APIRouter()


@router.post("/metrics", response_model=DeviceMetricSchema)
async def create_device_metric(metric: DeviceMetricCreate, db: Session = Depends(get_db)):
    db_metric = DeviceMetric(
        device_id=metric.device_id,
        metric_name=metric.metric_name,
        metric_value=metric.metric_value,
        unit=metric.unit,
        previous_value=metric.previous_value,
        extra=metric.extra
    )
    db.add(db_metric)
    db.commit()
    db.refresh(db_metric)
    return db_metric


@router.get("/metrics")
async def get_device_metrics(
    device_id: Optional[str] = None,
    metric_name: Optional[str] = None,
    hours: int = 24,
    db: Session = Depends(get_db)
):
    query = db.query(DeviceMetric)

    if device_id:
        query = query.filter(DeviceMetric.device_id == device_id)
    if metric_name:
        query = query.filter(DeviceMetric.metric_name == metric_name)

    time_threshold = datetime.utcnow() - timedelta(hours=hours)
    query = query.filter(DeviceMetric.timestamp >= time_threshold)

    metrics = query.order_by(desc(DeviceMetric.timestamp)).all()
    return metrics


@router.get("/{device_id}/anomalies")
async def get_device_anomalies(
    device_id: str,
    status: Optional[str] = None,
    days: int = 7,
    db: Session = Depends(get_db)
):
    time_threshold = datetime.utcnow() - timedelta(days=days)
    query = db.query(AnomalyRecord).filter(
        AnomalyRecord.device_id == device_id,
        AnomalyRecord.detected_at >= time_threshold
    )

    if status:
        query = query.filter(AnomalyRecord.status == status)

    anomalies = query.order_by(desc(AnomalyRecord.detected_at)).all()
    return anomalies


@router.get("/{device_id}/metrics/{metric_name}/history")
async def get_metric_history(
    device_id: str,
    metric_name: str,
    hours: int = 24,
    db: Session = Depends(get_db)
):
    time_threshold = datetime.utcnow() - timedelta(hours=hours)
    metrics = db.query(DeviceMetric).filter(
        DeviceMetric.device_id == device_id,
        DeviceMetric.metric_name == metric_name,
        DeviceMetric.timestamp >= time_threshold
    ).order_by(DeviceMetric.timestamp).all()

    return [
        {
            "timestamp": m.timestamp,
            "value": m.metric_value,
            "previous_value": m.previous_value
        }
        for m in metrics
    ]
