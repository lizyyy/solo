from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...schemas.common import (
    ApiResponse,
    PaginatedResponse,
    OperationHistoryResponse,
    PaginationParams,
)
from ...services.history_service import HistoryService
from ...services.trace_service import TraceService

router = APIRouter()


def _make_response(request: Request, data=None, message: str = "success", code: int = 200):
    return ApiResponse(
        code=code,
        message=message,
        data=data,
        request_id=getattr(request.state, "request_id", ""),
        timestamp=datetime.utcnow().isoformat(),
    )


@router.get("/history", response_model=ApiResponse[PaginatedResponse[OperationHistoryResponse]])
def get_history(
    request: Request,
    operation_type: Optional[str] = Query(None, description="操作类型"),
    target_type: Optional[str] = Query(None, description="目标类型"),
    target_id: Optional[int] = Query(None, description="目标ID"),
    operator: Optional[str] = Query(None, description="操作人"),
    trace_id: Optional[str] = Query(None, description="溯源ID"),
    start_date: Optional[str] = Query(None, description="开始日期"),
    end_date: Optional[str] = Query(None, description="结束日期"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    sort_by: Optional[str] = Query("created_at", description="排序字段"),
    sort_order: Optional[str] = Query("desc", description="排序方向"),
    db: Session = Depends(get_db),
):
    service = HistoryService(db)
    pagination = PaginationParams(
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )
    items, total = service.get_history_list(
        operation_type, target_type, target_id, operator, trace_id, start_date, end_date, pagination
    )
    total_pages = (total + page_size - 1) // page_size

    return _make_response(
        request,
        PaginatedResponse(
            items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
        ),
    )


@router.get("/history/{history_id}", response_model=ApiResponse[OperationHistoryResponse])
def get_history_detail(
    request: Request,
    history_id: int,
    db: Session = Depends(get_db),
):
    service = HistoryService(db)
    history = service.get_history_detail(history_id)
    if not history:
        return _make_response(request, None, "历史记录不存在", 404)
    return _make_response(request, history)


@router.get("/trace/{trace_id}")
def trace_by_id(
    request: Request,
    trace_id: str,
    db: Session = Depends(get_db),
):
    service = TraceService(db)
    results = service.trace_by_trace_id(trace_id)
    return _make_response(request, results)
