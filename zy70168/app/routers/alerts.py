from datetime import datetime
from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Alert, AlertStatus
from app.schemas import AlertResponse, AlertRevokeRequest
from app.services.metrics_service import MetricsService

router = APIRouter(prefix="/api/alerts", tags=["告警管理"])


@router.get("", response_model=List[AlertResponse])
async def list_alerts(
    metric_name: Optional[str] = Query(None, description="指标名称过滤"),
    entity_id: Optional[str] = Query(None, description="实体ID过滤"),
    status: Optional[AlertStatus] = Query(None, description="告警状态"),
    alert_type: Optional[str] = Query(None, description="告警类型"),
    start_time: Optional[datetime] = Query(None, description="告警开始时间"),
    end_time: Optional[datetime] = Query(None, description="告警结束时间"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """查询告警列表"""
    conditions = []
    if metric_name:
        conditions.append(Alert.metric_name == metric_name)
    if entity_id:
        conditions.append(Alert.entity_id == entity_id)
    if status:
        conditions.append(Alert.status == status)
    if alert_type:
        conditions.append(Alert.alert_type == alert_type)
    if start_time:
        conditions.append(Alert.alert_time >= start_time)
    if end_time:
        conditions.append(Alert.alert_time <= end_time)

    stmt = select(Alert)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(Alert.alert_time.desc()).offset(offset).limit(limit)
    
    result = await db.execute(stmt)
    alerts = list(result.scalars().all())
    return alerts


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db)
):
    """查询单个告警详情"""
    stmt = select(Alert).where(Alert.alert_id == alert_id)
    result = await db.execute(stmt)
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")
    
    return alert


@router.post("/{alert_id}/revoke")
async def revoke_alert(
    alert_id: str,
    request: AlertRevokeRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    手动撤销告警（兜底机制）
    
    说明：
    1. 通常情况下，迟到事件修正会自动撤销不再满足条件的告警
    2. 此接口用于特殊情况的手动兜底处理
    3. 撤销后会记录撤销时间和原因
    """
    result = await MetricsService.revoke_alert(db, alert_id, request.reason)
    
    if not result:
        raise HTTPException(status_code=404, detail="告警不存在")
    
    return result


@router.get("/stats/summary")
async def get_alert_stats(
    metric_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """获取告警统计信息"""
    stats = {}
    
    for status in AlertStatus:
        conditions = [Alert.status == status]
        if metric_name:
            conditions.append(Alert.metric_name == metric_name)
        
        stmt = select(Alert).where(and_(*conditions))
        result = await db.execute(stmt)
        count = len(list(result.scalars().all()))
        stats[status.value] = count
    
    return stats
