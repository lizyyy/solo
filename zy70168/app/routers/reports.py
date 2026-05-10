from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import CorrectionReport, CorrectionSource
from app.schemas import CorrectionReportResponse

router = APIRouter(prefix="/api/correction-reports", tags=["修正报告"])


@router.get("", response_model=List[CorrectionReportResponse])
async def list_reports(
    metric_name: Optional[str] = Query(None, description="指标名称过滤"),
    entity_id: Optional[str] = Query(None, description="实体ID过滤"),
    source: Optional[CorrectionSource] = Query(None, description="修正来源"),
    start_time: Optional[datetime] = Query(None, description="修正开始时间"),
    end_time: Optional[datetime] = Query(None, description="修正结束时间"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """
    查询修正报告列表（用于复查和审计）
    
    修正报告记录了所有指标值的变化：
    - late_event: 迟到事件自动触发的修正
    - manual: 人工手动修正
    """
    conditions = []
    if metric_name:
        conditions.append(CorrectionReport.metric_name == metric_name)
    if entity_id:
        conditions.append(CorrectionReport.entity_id == entity_id)
    if source:
        conditions.append(CorrectionReport.source == source)
    if start_time:
        conditions.append(CorrectionReport.correction_time >= start_time)
    if end_time:
        conditions.append(CorrectionReport.correction_time <= end_time)

    stmt = select(CorrectionReport)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(CorrectionReport.correction_time.desc()).offset(offset).limit(limit)
    
    result = await db.execute(stmt)
    reports = list(result.scalars().all())
    return reports


@router.get("/{report_id}", response_model=CorrectionReportResponse)
async def get_report(
    report_id: str,
    db: AsyncSession = Depends(get_db)
):
    """查询单个修正报告详情"""
    stmt = select(CorrectionReport).where(CorrectionReport.report_id == report_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="修正报告不存在")
    
    return report


@router.get("/stats/summary")
async def get_report_stats(
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """获取修正报告统计信息"""
    conditions = []
    if start_time:
        conditions.append(CorrectionReport.correction_time >= start_time)
    if end_time:
        conditions.append(CorrectionReport.correction_time <= end_time)

    stats = {}
    for source in CorrectionSource:
        conds = conditions + [CorrectionReport.source == source]
        stmt = select(CorrectionReport).where(and_(*conds)) if conds else select(CorrectionReport)
        result = await db.execute(stmt)
        reports = list(result.scalars().all())
        
        total_value_change = sum(r.new_value - r.original_value for r in reports)
        alerts_affected = sum(len(r.affected_alerts) for r in reports)
        rankings_affected = sum(len(r.affected_rankings) for r in reports)
        
        stats[source.value] = {
            "count": len(reports),
            "total_value_change": total_value_change,
            "alerts_affected": alerts_affected,
            "rankings_affected": rankings_affected
        }
    
    return stats


@router.get("/by-entity/{entity_id}")
async def get_entity_correction_history(
    entity_id: str,
    metric_name: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """查询某个实体的修正历史（用于问题排查）"""
    conditions = [CorrectionReport.entity_id == entity_id]
    if metric_name:
        conditions.append(CorrectionReport.metric_name == metric_name)
    
    stmt = select(CorrectionReport).where(and_(*conditions))\
        .order_by(CorrectionReport.correction_time.desc())\
        .limit(limit)
    
    result = await db.execute(stmt)
    reports = list(result.scalars().all())
    
    history = []
    for r in reports:
        history.append({
            "report_id": r.report_id,
            "correction_time": r.correction_time,
            "metric_name": r.metric_name,
            "bucket_time": r.bucket_time,
            "original_value": r.original_value,
            "new_value": r.new_value,
            "value_change": r.new_value - r.original_value,
            "source": r.source.value,
            "operator": r.operator,
            "reason": r.reason,
            "alerts_affected": len(r.affected_alerts),
            "rankings_affected": len(r.affected_rankings)
        })
    
    return {
        "entity_id": entity_id,
        "correction_count": len(history),
        "history": history
    }
