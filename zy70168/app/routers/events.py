from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Event, EventStatus
from app.schemas import EventCreate, EventResponse, ProcessResult
from app.services.metrics_service import MetricsService

router = APIRouter(prefix="/api/events", tags=["事件处理"])


@router.post("", response_model=ProcessResult)
async def submit_event(
    event_data: EventCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    上报事件（核心入口）
    
    - 以 event_time 作为事件时间入口
    - 自动检测迟到事件
    - 支持幂等性（通过 event_id）
    - 自动拦截异常值（负数）
    """
    result = await MetricsService.process_event(db, event_data)
    return result


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: str,
    db: AsyncSession = Depends(get_db)
):
    """查询单个事件详情"""
    stmt = select(Event).where(Event.id == event_id)
    result = await db.execute(stmt)
    event = result.scalar_one_or_none()
    
    if not event:
        raise HTTPException(status_code=404, detail="事件不存在")
    
    return event


@router.get("", response_model=List[EventResponse])
async def list_events(
    metric_name: Optional[str] = Query(None, description="指标名称过滤"),
    entity_id: Optional[str] = Query(None, description="实体ID过滤"),
    start_time: Optional[datetime] = Query(None, description="事件开始时间"),
    end_time: Optional[datetime] = Query(None, description="事件结束时间"),
    status: Optional[EventStatus] = Query(None, description="事件状态过滤"),
    is_late: Optional[bool] = Query(None, description="是否迟到事件"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """查询事件列表"""
    conditions = []
    if metric_name:
        conditions.append(Event.metric_name == metric_name)
    if entity_id:
        conditions.append(Event.entity_id == entity_id)
    if start_time:
        conditions.append(Event.event_time >= start_time)
    if end_time:
        conditions.append(Event.event_time <= end_time)
    if status:
        conditions.append(Event.status == status)
    if is_late is not None:
        conditions.append(Event.is_late == is_late)

    stmt = select(Event)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(Event.event_time.desc()).offset(offset).limit(limit)
    
    result = await db.execute(stmt)
    events = list(result.scalars().all())
    return events


@router.post("/batch", response_model=List[ProcessResult])
async def submit_events_batch(
    events_data: List[EventCreate],
    db: AsyncSession = Depends(get_db)
):
    """批量上报事件"""
    results = []
    for event_data in events_data:
        result = await MetricsService.process_event(db, event_data)
        results.append(result)
    return results
