import os
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.services import ExportService

router = APIRouter(prefix="/export", tags=["数据导出"])


@router.post("/consumable-records")
def export_records(
    data_source: Optional[str] = None,
    current_status: Optional[str] = None,
    is_duplicate: Optional[bool] = None,
    operator: str = "system",
    db: Session = Depends(get_db)
):
    export_service = ExportService(db)
    
    filters = {}
    if data_source:
        filters["data_source"] = data_source
    if current_status:
        filters["current_status"] = current_status
    if is_duplicate is not None:
        filters["is_duplicate"] = is_duplicate
    
    result = export_service.export_consumable_records(filters, operator)
    return result


@router.get("/download/{filename}")
def download_file(filename: str):
    from app.config import settings
    
    filepath = os.path.join(settings.EXPORT_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return FileResponse(
        path=filepath,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@router.post("/record-history/{record_id}")
def export_record_history(
    record_id: int,
    operator: str = "system",
    db: Session = Depends(get_db)
):
    export_service = ExportService(db)
    
    try:
        result = export_service.export_record_history(record_id, operator)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/exceptions")
def export_exceptions(
    status_filter: Optional[str] = None,
    operator: str = "system",
    db: Session = Depends(get_db)
):
    export_service = ExportService(db)
    
    result = export_service.export_exceptions(status_filter, operator)
    return result
