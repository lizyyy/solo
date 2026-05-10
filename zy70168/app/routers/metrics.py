from datetime import datetime, timedelta
from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import MetricSnapshot, SnapshotSource
from app.schemas import (
    MetricSnapshotResponse, ManualCorrectionRequest
)
from app.services.metrics_service import MetricsService

router = APIRouter(prefix="/api/metrics", tags=["指标管理"])


@router.get("/snapshots", response_model=List[MetricSnapshotResponse])
async def list_snapshots(
    metric_name: Optional[str] = Query(None, description="指标名称过滤"),
    entity_id: Optional[str] = Query(None, description="实体ID过滤"),
    bucket_time: Optional[datetime] = Query(None, description="具体桶时间"),
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    is_latest_only: bool = Query(True, description="只查最新版本"),
    include_manual: bool = Query(True, description="包含人工修正"),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """
    查询指标快照（支持历史版本）
    
    注意：默认只返回最新版本（is_latest=True），这样历史查询和当前统计保持一致。
    如果需要查看所有历史版本，设置 is_latest_only=False。
    """
    conditions = []
    if metric_name:
        conditions.append(MetricSnapshot.metric_name == metric_name)
    if entity_id:
        conditions.append(MetricSnapshot.entity_id == entity_id)
    if bucket_time:
        conditions.append(MetricSnapshot.bucket_time == bucket_time)
    if start_time:
        conditions.append(MetricSnapshot.bucket_time >= start_time)
    if end_time:
        conditions.append(MetricSnapshot.bucket_time < end_time)
    if is_latest_only:
        conditions.append(MetricSnapshot.is_latest == True)
    if not include_manual:
        conditions.append(MetricSnapshot.source != SnapshotSource.MANUAL)

    stmt = select(MetricSnapshot)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(
        MetricSnapshot.bucket_time.desc(),
        MetricSnapshot.version.desc()
    ).limit(limit)
    
    result = await db.execute(stmt)
    snapshots = list(result.scalars().all())
    return snapshots


@router.get("/snapshots/{metric_name}/{entity_id}/{bucket_time}", response_model=List[MetricSnapshotResponse])
async def get_snapshot_history(
    metric_name: str,
    entity_id: str,
    bucket_time: datetime,
    db: AsyncSession = Depends(get_db)
):
    """查询某个指标在某个时间桶的完整版本历史"""
    stmt = select(MetricSnapshot).where(
        and_(
            MetricSnapshot.metric_name == metric_name,
            MetricSnapshot.entity_id == entity_id,
            MetricSnapshot.bucket_time == bucket_time
        )
    ).order_by(MetricSnapshot.version.desc())
    
    result = await db.execute(stmt)
    snapshots = list(result.scalars().all())
    return snapshots


@router.get("/latest/{metric_name}/{entity_id}", response_model=Optional[MetricSnapshotResponse])
async def get_latest_snapshot(
    metric_name: str,
    entity_id: str,
    bucket_time: Optional[datetime] = Query(None, description="指定桶时间，不指定则查最近的"),
    db: AsyncSession = Depends(get_db)
):
    """查询某个实体的最新指标快照"""
    conditions = [
        MetricSnapshot.metric_name == metric_name,
        MetricSnapshot.entity_id == entity_id,
        MetricSnapshot.is_latest == True
    ]
    if bucket_time:
        conditions.append(MetricSnapshot.bucket_time == bucket_time)

    stmt = select(MetricSnapshot).where(and_(*conditions))
    if bucket_time:
        stmt = stmt.order_by(MetricSnapshot.bucket_time.desc())
    else:
        stmt = stmt.order_by(MetricSnapshot.bucket_time.desc())
    
    result = await db.execute(stmt)
    snapshot = result.scalar_one_or_none()
    return snapshot


@router.post("/manual-correction")
async def apply_manual_correction(
    request: ManualCorrectionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    人工修正指标值
    
    说明：
    1. 人工修正后会创建新的快照版本（is_manual_overridden=True）
    2. 后续迟到事件到达时，会跳过自动计算，保持人工修正值
    3. 会自动检查并撤销不再满足条件的告警
    4. 会自动回放更新相关榜单
    5. 生成修正报告供复查
    """
    result = await MetricsService.apply_manual_correction(db, request)
    return result
