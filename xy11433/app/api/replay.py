from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models import ReplayException
from app.schemas import (
    ReplayExceptionResponse, ReplayExceptionResolve,
    PaginatedResponse
)
from app.services import ReplayService

router = APIRouter(prefix="/replay", tags=["回放链路"])


@router.post("/mock-data")
def generate_mock_data(
    count: int = Query(50, ge=1, le=1000),
    operator: str = "system",
    db: Session = Depends(get_db)
):
    replay_service = ReplayService(db)
    result = replay_service.generate_mock_data(count, operator)
    return result


@router.post("/reconcile")
def reconcile_records(
    operator: str = "system",
    db: Session = Depends(get_db)
):
    replay_service = ReplayService(db)
    result = replay_service.reconcile_records(operator)
    return result


@router.get("/exceptions", response_model=PaginatedResponse)
def get_exceptions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    exception_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ReplayException)
    
    if status:
        query = query.filter(ReplayException.status == status)
    if exception_type:
        query = query.filter(ReplayException.exception_type == exception_type)
    
    total = query.count()
    exceptions = query.order_by(ReplayException.created_at.desc()) \
        .offset((page - 1) * page_size) \
        .limit(page_size) \
        .all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": exceptions
    }


@router.get("/exceptions/{exception_id}", response_model=ReplayExceptionResponse)
def get_exception(exception_id: int, db: Session = Depends(get_db)):
    exception = db.query(ReplayException).filter(
        ReplayException.id == exception_id
    ).first()
    
    if not exception:
        raise HTTPException(status_code=404, detail="异常不存在")
    
    return exception


@router.post("/exceptions/{exception_id}/resolve", response_model=ReplayExceptionResponse)
def resolve_exception(
    exception_id: int,
    request: ReplayExceptionResolve,
    db: Session = Depends(get_db)
):
    replay_service = ReplayService(db)
    
    try:
        exception = replay_service.resolve_exception(
            exception_id=exception_id,
            resolution=request.resolution,
            resolved_by=request.resolved_by,
            after_correction=request.after_correction
        )
        return exception
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/exceptions/{exception_id}/diff")
def get_exception_diff(exception_id: int, db: Session = Depends(get_db)):
    exception = db.query(ReplayException).filter(
        ReplayException.id == exception_id
    ).first()
    
    if not exception:
        raise HTTPException(status_code=404, detail="异常不存在")
    
    before = exception.before_correction or {}
    after = exception.after_correction or {}
    
    all_keys = set(before.keys()) | set(after.keys())
    
    diff = []
    for key in all_keys:
        before_val = before.get(key)
        after_val = after.get(key)
        
        if before_val != after_val:
            diff.append({
                "field": key,
                "before": before_val,
                "after": after_val
            })
    
    return {
        "exception_code": exception.exception_code,
        "exception_type": exception.exception_type,
        "resolution": exception.resolution,
        "resolved_by": exception.resolved_by,
        "resolved_at": exception.resolved_at,
        "differences": diff
    }
