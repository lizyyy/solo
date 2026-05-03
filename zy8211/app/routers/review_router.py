from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import datetime, date, timedelta
from typing import Optional, List
import io
import csv

from app.models import (
    get_db, DehydratorRun, ChemicalBatch, LabMoistureResult,
    ExceptionReview, ReviewRule, ExceptionType
)
from app.schemas import (
    ExceptionReviewResponse, ExceptionReviewResolve
)

router = APIRouter(prefix="/review", tags=["复核接口"])


@router.put("/exceptions/{review_id}/resolve", response_model=ExceptionReviewResponse)
def resolve_exception(
    review_id: str,
    resolve_data: ExceptionReviewResolve,
    db: Session = Depends(get_db)
):
    exception = db.query(ExceptionReview).filter(
        ExceptionReview.review_id == review_id
    ).first()
    
    if not exception:
        raise HTTPException(status_code=404, detail=f"异常记录 {review_id} 不存在")
    
    if exception.is_resolved:
        raise HTTPException(status_code=400, detail=f"异常记录已处理")
    
    exception.is_resolved = True
    exception.resolution_note = resolve_data.resolution_note
    exception.resolved_by = resolve_data.resolved_by
    exception.resolved_at = datetime.utcnow()
    
    db.commit()
    db.refresh(exception)
    
    return exception


@router.post("/exceptions/batch-resolve", response_model=dict)
def batch_resolve_exceptions(
    review_ids: List[str],
    resolve_data: ExceptionReviewResolve,
    db: Session = Depends(get_db)
):
    resolved_count = 0
    errors = []
    
    for review_id in review_ids:
        try:
            exception = db.query(ExceptionReview).filter(
                ExceptionReview.review_id == review_id
            ).first()
            
            if not exception:
                errors.append(f"异常记录 {review_id} 不存在")
                continue
            
            if exception.is_resolved:
                errors.append(f"异常记录 {review_id} 已处理")
                continue
            
            exception.is_resolved = True
            exception.resolution_note = resolve_data.resolution_note
            exception.resolved_by = resolve_data.resolved_by
            exception.resolved_at = datetime.utcnow()
            
            resolved_count += 1
            
        except Exception as e:
            errors.append(f"处理 {review_id} 失败: {str(e)}")
            continue
    
    db.commit()
    
    return {
        "success": True,
        "resolved_count": resolved_count,
        "errors": errors
    }


@router.get("/exceptions/stats", response_model=dict)
def get_exception_stats(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ExceptionReview)
    
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(ExceptionReview.created_at >= start_dt)
    
    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(ExceptionReview.created_at <= end_dt)
    
    total = query.count()
    resolved = query.filter(ExceptionReview.is_resolved == True).count()
    unresolved = total - resolved
    
    type_stats = db.query(
        ExceptionReview.exception_type,
        func.count(ExceptionReview.id).label('count')
    )
    
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        type_stats = type_stats.filter(ExceptionReview.created_at >= start_dt)
    
    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        type_stats = type_stats.filter(ExceptionReview.created_at <= end_dt)
    
    type_stats = type_stats.group_by(ExceptionReview.exception_type).all()
    
    type_distribution = {
        row.exception_type: row.count for row in type_stats
    }
    
    return {
        "total_exceptions": total,
        "resolved": resolved,
        "unresolved": unresolved,
        "resolution_rate": round(resolved / total * 100, 2) if total > 0 else 0,
        "type_distribution": type_distribution
    }


@router.get("/daily-summary", response_model=dict)
def get_daily_summary(
    summary_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    if summary_date is None:
        summary_date = date.today()
    
    start_dt = datetime.combine(summary_date, datetime.min.time())
    end_dt = datetime.combine(summary_date, datetime.max.time())
    
    runs = db.query(DehydratorRun).filter(
        DehydratorRun.shift_date >= start_dt,
        DehydratorRun.shift_date <= end_dt
    ).all()
    
    total_runs = len(runs)
    total_feed_volume = sum(r.feed_sludge_volume for r in runs)
    total_dry_solids = sum(r.dry_solids_input or 0 for r in runs)
    
    lab_results = db.query(LabMoistureResult).filter(
        LabMoistureResult.sample_time >= start_dt,
        LabMoistureResult.sample_time <= end_dt
    ).all()
    
    avg_moisture = None
    if lab_results:
        avg_moisture = sum(r.moisture_content for r in lab_results) / len(lab_results)
    
    exceptions = db.query(ExceptionReview).filter(
        ExceptionReview.created_at >= start_dt,
        ExceptionReview.created_at <= end_dt
    ).all()
    
    total_exceptions = len(exceptions)
    resolved = sum(1 for e in exceptions if e.is_resolved)
    
    batches = db.query(ChemicalBatch).filter(
        ChemicalBatch.start_time <= end_dt,
        (ChemicalBatch.end_time == None) | (ChemicalBatch.end_time >= start_dt)
    ).all()
    
    batch_summary = []
    for batch in batches:
        batch_runs = [r for r in runs if r.batch_id == batch.batch_id]
        batch_feed = sum(r.feed_sludge_volume for r in batch_runs)
        batch_dry = sum(r.dry_solids_input or 0 for r in batch_runs)
        
        batch_labs = [l for l in lab_results if l.batch_id == batch.batch_id]
        batch_moisture = None
        if batch_labs:
            batch_moisture = sum(l.moisture_content for l in batch_labs) / len(batch_labs)
        
        batch_exceptions = [e for e in exceptions if e.run_id in [r.run_id for r in batch_runs]]
        
        batch_summary.append({
            "batch_id": batch.batch_id,
            "chemical_type": batch.chemical_type,
            "run_count": len(batch_runs),
            "total_feed_volume": batch_feed,
            "total_dry_solids": batch_dry,
            "avg_moisture": batch_moisture,
            "exception_count": len(batch_exceptions)
        })
    
    return {
        "date": summary_date,
        "total_runs": total_runs,
        "total_feed_volume": round(total_feed_volume, 2),
        "total_dry_solids": round(total_dry_solids, 2),
        "avg_moisture": round(avg_moisture, 2) if avg_moisture else None,
        "total_exceptions": total_exceptions,
        "resolved_exceptions": resolved,
        "unresolved_exceptions": total_exceptions - resolved,
        "batches": batch_summary
    }
