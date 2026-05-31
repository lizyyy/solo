from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, Request, UploadFile, File, Form
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...schemas.common import (
    ApiResponse,
    PaginatedResponse,
    ImportBatchResponse,
    PaginationParams,
)
from ...schemas.materials import ImportResult
from ...services.import_service import ImportService

router = APIRouter()


def _make_response(request: Request, data=None, message: str = "success", code: int = 200):
    return ApiResponse(
        code=code,
        message=message,
        data=data,
        request_id=getattr(request.state, "request_id", ""),
        timestamp=datetime.utcnow().isoformat(),
    )


@router.post("/audio-tracks/import", response_model=ApiResponse[ImportResult])
async def import_audio_tracks(
    request: Request,
    file: UploadFile = File(..., description="Excel/CSV文件"),
    imported_by: str = Form("system", description="导入人"),
    db: Session = Depends(get_db),
):
    service = ImportService(db)
    file_content = await file.read()
    result = service.import_audio_tracks(file_content, file.filename or "audio_tracks.xlsx", imported_by)
    db.commit()
    return _make_response(request, result, "原始音轨导入完成")


@router.post("/ad-scripts/import", response_model=ApiResponse[ImportResult])
async def import_ad_scripts(
    request: Request,
    file: UploadFile = File(..., description="Excel/CSV文件"),
    imported_by: str = Form("system", description="导入人"),
    db: Session = Depends(get_db),
):
    service = ImportService(db)
    file_content = await file.read()
    result = service.import_ad_scripts(file_content, file.filename or "ad_scripts.xlsx", imported_by)
    db.commit()
    return _make_response(request, result, "广告口播导入完成")


@router.post("/sound-materials/import", response_model=ApiResponse[ImportResult])
async def import_sound_materials(
    request: Request,
    file: UploadFile = File(..., description="Excel/CSV文件"),
    imported_by: str = Form("system", description="导入人"),
    db: Session = Depends(get_db),
):
    service = ImportService(db)
    file_content = await file.read()
    result = service.import_sound_materials(file_content, file.filename or "sound_materials.xlsx", imported_by)
    db.commit()
    return _make_response(request, result, "环境音素材导入完成")


@router.get("/import/batches", response_model=ApiResponse[PaginatedResponse[ImportBatchResponse]])
def get_import_batches(
    request: Request,
    import_type: Optional[str] = Query(None, description="导入类型"),
    status: Optional[str] = Query(None, description="状态"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    sort_by: Optional[str] = Query("created_at", description="排序字段"),
    sort_order: Optional[str] = Query("desc", description="排序方向"),
    db: Session = Depends(get_db),
):
    service = ImportService(db)
    pagination = PaginationParams(
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )
    items, total = service.get_import_batch_list(import_type, status, pagination)
    total_pages = (total + page_size - 1) // page_size

    return _make_response(
        request,
        PaginatedResponse(
            items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
        ),
    )


@router.get("/import/batches/{batch_id}", response_model=ApiResponse[ImportBatchResponse])
def get_import_batch(
    request: Request,
    batch_id: int,
    db: Session = Depends(get_db),
):
    service = ImportService(db)
    batch = service.get_import_batch(batch_id)
    if not batch:
        return _make_response(request, None, "导入批次不存在", 404)
    return _make_response(request, batch)
