from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...schemas.common import (
    ApiResponse,
    PaginatedResponse,
    PaginationParams,
)
from ...schemas.export import (
    ExportRequest,
    ExportResponse,
    ExportPreviewRequest,
    ExportPreviewResponse,
    ExportRecordResponse,
)
from ...services.export_service import ExportService

router = APIRouter()


def _make_response(request: Request, data=None, message: str = "success", code: int = 200):
    return ApiResponse(
        code=code,
        message=message,
        data=data,
        request_id=getattr(request.state, "request_id", ""),
        timestamp=datetime.utcnow().isoformat(),
    )


@router.post("/export/preview", response_model=ApiResponse[ExportPreviewResponse])
def export_preview(
    request: Request,
    data: ExportPreviewRequest,
    screen_count: Optional[int] = Query(None, description="屏幕显示数量"),
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    result = service.get_export_preview(data, screen_count)
    return _make_response(request, result)


@router.post("/export", response_model=ApiResponse[ExportResponse])
def export_materials(
    request: Request,
    data: ExportRequest,
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    try:
        result = service.export_materials(data)
        db.commit()
        return _make_response(request, result, "导出成功")
    except ValueError as e:
        db.rollback()
        return _make_response(request, None, str(e), 400)


@router.get("/export/records", response_model=ApiResponse[PaginatedResponse[ExportRecordResponse]])
def get_export_records(
    request: Request,
    filter_hash: Optional[str] = Query(None, description="筛选条件哈希"),
    exported_by: Optional[str] = Query(None, description="导出人"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    sort_by: Optional[str] = Query("created_at", description="排序字段"),
    sort_order: Optional[str] = Query("desc", description="排序方向"),
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    pagination = PaginationParams(
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )
    items, total = service.get_export_record_list(filter_hash, exported_by, pagination)
    total_pages = (total + page_size - 1) // page_size

    return _make_response(
        request,
        PaginatedResponse(
            items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
        ),
    )


@router.get("/export/records/{record_id}/download")
def download_export(
    request: Request,
    record_id: int,
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    result = service.get_export_file_path(record_id)
    if not result:
        return _make_response(request, None, "导出文件不存在", 404)

    file_path, filename = result
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if filename.endswith(".xlsx")
        else "text/csv",
    )


@router.get("/export/records/{record_id}/verify")
def verify_export_consistency(
    request: Request,
    record_id: int,
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    passed, issues = service.verify_export_consistency(record_id)
    return _make_response(
        request,
        {"passed": passed, "issues": issues},
        "数据一致性检查完成" if passed else "发现数据不一致问题",
    )
