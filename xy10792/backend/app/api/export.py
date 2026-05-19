from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from ..core.database import get_db
from ..schemas import ExportRequest
from ..services.export_service import ExportService
from datetime import datetime

router = APIRouter(prefix="/api/export", tags=["export"])


@router.post("/download")
def download_export(
    export_request: ExportRequest,
    db: Session = Depends(get_db)
):
    kwargs = {}
    if export_request.resume_ids:
        kwargs["resume_ids"] = export_request.resume_ids
    if export_request.status_filter:
        kwargs["status_filter"] = export_request.status_filter
    if export_request.start_date:
        kwargs["start_date"] = export_request.start_date
    if export_request.end_date:
        kwargs["end_date"] = export_request.end_date
    
    file_content, media_type, filename = ExportService.export_resumes(
        db,
        export_format=export_request.export_format,
        **kwargs
    )
    
    return StreamingResponse(
        file_content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"}
    )


@router.post("/preview")
def preview_export(
    export_request: ExportRequest,
    db: Session = Depends(get_db)
):
    kwargs = {}
    if export_request.resume_ids:
        kwargs["resume_ids"] = export_request.resume_ids
    if export_request.status_filter:
        kwargs["status_filter"] = export_request.status_filter
    if export_request.start_date:
        kwargs["start_date"] = export_request.start_date
    if export_request.end_date:
        kwargs["end_date"] = export_request.end_date
    
    data = ExportService.get_export_data(db, **kwargs)
    return {
        "total": len(data),
        "preview_data": data[:10],
        "columns": list(data[0].keys()) if data else []
    }


@router.post("/mark-exported")
def mark_as_exported(resume_ids: List[int], db: Session = Depends(get_db)):
    ExportService.mark_as_exported(db, resume_ids)
    return {"message": f"已标记 {len(resume_ids)} 份简历为已导出"}
