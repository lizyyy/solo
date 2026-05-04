from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from datetime import datetime, date

from app.database import get_db
from app.models import DetectionHistory, HitRecord
from app.schemas import (
    DetectionHistoryResponse, DetectionHistoryDetailResponse,
    DetectionHitResponse, SegmentResponse,
    PaginatedResponse, SuccessResponse
)

router = APIRouter()


@router.get("/list", response_model=PaginatedResponse[DetectionHistoryResponse])
async def list_detection_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_sensitive: Optional[bool] = Query(None),
    review_status: Optional[str] = Query(None),
    highest_severity: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    keyword: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(DetectionHistory)
    
    if is_sensitive is not None:
        query = query.where(DetectionHistory.is_sensitive == is_sensitive)
    if review_status:
        query = query.where(DetectionHistory.review_status == review_status)
    if highest_severity:
        query = query.where(DetectionHistory.highest_severity == highest_severity)
    if start_date:
        query = query.where(DetectionHistory.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.where(DetectionHistory.created_at <= datetime.combine(end_date, datetime.max.time()))
    if keyword:
        query = query.where(DetectionHistory.original_text.contains(keyword))
    
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    offset = (page - 1) * page_size
    query = query.order_by(DetectionHistory.created_at.desc()).offset(offset).limit(page_size)
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return PaginatedResponse(
        items=[DetectionHistoryResponse.model_validate(r) for r in records],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1
    )


@router.get("/{history_id}", response_model=DetectionHistoryDetailResponse)
async def get_detection_detail(
    history_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DetectionHistory).where(DetectionHistory.id == history_id)
    )
    history = result.scalar_one_or_none()
    
    if not history:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    
    hits_result = await db.execute(
        select(HitRecord).where(HitRecord.detection_id == history_id)
    )
    hits = hits_result.scalars().all()
    
    segments = history.segments if history.segments else []
    
    return DetectionHistoryDetailResponse(
        id=history.id,
        request_id=history.request_id,
        original_text=history.original_text,
        normalized_text=history.normalized_text,
        is_sensitive=history.is_sensitive,
        highest_severity=history.highest_severity,
        total_hits=history.total_hits,
        processing_time_ms=history.processing_time_ms,
        client_ip=history.client_ip,
        review_status=history.review_status,
        reviewed_by=history.reviewed_by,
        reviewed_at=history.reviewed_at,
        lexicon_version=history.lexicon_version,
        created_at=history.created_at,
        segments=[SegmentResponse(**seg) for seg in segments],
        hits=[
            DetectionHitResponse(
                hit_word=h.hit_word,
                matched_word=h.matched_word,
                start_position=h.start_position,
                end_position=h.end_position,
                match_type=h.match_type,
                category=h.category,
                severity=h.severity,
                description=h.description or "",
                suggestion=h.suggestion or "",
                context_before=h.context_before,
                context_after=h.context_after,
                confidence=1.0,
                sensitive_word_id=h.sensitive_word_id,
                is_false_positive=h.is_false_positive,
                false_positive_reason=h.false_positive_reason
            )
            for h in hits
        ]
    )


@router.get("/stats/summary", response_model=SuccessResponse)
async def get_history_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(DetectionHistory)
    
    if start_date:
        query = query.where(DetectionHistory.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.where(DetectionHistory.created_at <= datetime.combine(end_date, datetime.max.time()))
    
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()
    
    sensitive_query = query.where(DetectionHistory.is_sensitive == True)
    sensitive_result = await db.execute(select(func.count()).select_from(sensitive_query.subquery()))
    sensitive_count = sensitive_result.scalar()
    
    pending_query = query.where(DetectionHistory.review_status == "pending")
    pending_result = await db.execute(select(func.count()).select_from(pending_query.subquery()))
    pending_count = pending_result.scalar()
    
    severity_stats = {}
    for severity in ['low', 'medium', 'high', 'critical']:
        sev_query = query.where(
            DetectionHistory.is_sensitive == True,
            DetectionHistory.highest_severity == severity
        )
        sev_result = await db.execute(select(func.count()).select_from(sev_query.subquery()))
        severity_stats[severity] = sev_result.scalar()
    
    return SuccessResponse(
        message="获取统计成功",
        data={
            "total_detections": total,
            "sensitive_count": sensitive_count,
            "pending_review_count": pending_count,
            "pass_rate": round((total - sensitive_count) / total * 100, 2) if total > 0 else 100,
            "severity_distribution": severity_stats
        }
    )


@router.delete("/{history_id}", response_model=SuccessResponse)
async def delete_detection_history(
    history_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DetectionHistory).where(DetectionHistory.id == history_id)
    )
    history = result.scalar_one_or_none()
    
    if not history:
        raise HTTPException(status_code=404, detail="检测记录不存在")
    
    await db.delete(history)
    await db.commit()
    
    return SuccessResponse(message="删除成功")
