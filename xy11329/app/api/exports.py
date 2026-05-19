from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime
import os

from app.database import get_db
from app.models import TaskStatus, ExceptionType
from app.services import ExportService
from app.config import EXPORT_DIR

router = APIRouter(prefix="/exports", tags=["exports"])


@router.post("/tasks/excel")
def export_tasks_to_excel(
    status: Optional[TaskStatus] = None,
    escort_id: Optional[int] = None,
    priority: Optional[str] = None,
    has_exception: Optional[bool] = None,
    exception_type: Optional[ExceptionType] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    filepath = service.export_tasks_to_excel(
        status=status,
        escort_id=escort_id,
        priority=priority,
        has_exception=has_exception,
        exception_type=exception_type,
        start_date=start_date,
        end_date=end_date,
    )
    filename = os.path.basename(filepath)
    return {"filename": filename, "filepath": filepath}


@router.post("/tasks/csv")
def export_tasks_to_csv(
    status: Optional[TaskStatus] = None,
    escort_id: Optional[int] = None,
    priority: Optional[str] = None,
    has_exception: Optional[bool] = None,
    exception_type: Optional[ExceptionType] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    filepath = service.export_tasks_to_csv(
        status=status,
        escort_id=escort_id,
        priority=priority,
        has_exception=has_exception,
        exception_type=exception_type,
        start_date=start_date,
        end_date=end_date,
    )
    filename = os.path.basename(filepath)
    return {"filename": filename, "filepath": filepath}


@router.get("/download/{filename}")
def download_export_file(filename: str):
    filepath = os.path.join(EXPORT_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    
    media_type = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if filename.endswith(".xlsx")
        else "text/csv"
    )
    return FileResponse(
        filepath,
        media_type=media_type,
        filename=filename,
    )


@router.get("/", response_model=List[Dict[str, Any]])
def list_export_files(db: Session = Depends(get_db)):
    service = ExportService(db)
    return service.list_export_files()
