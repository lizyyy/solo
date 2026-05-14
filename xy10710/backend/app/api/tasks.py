from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.schemas.schemas import (
    TranscodeTaskCreate,
    TranscodeTaskResponse,
    TaskListResponse,
    ErrorLogResponse,
    ExportRequest,
    ExportRecordResponse,
    TaskFilter
)
from app.services.task_service import (
    create_task,
    get_task_by_id,
    get_tasks,
    get_task_versions,
    confirm_watermark,
    approve_task,
    retry_task,
    rollback_task,
    get_task_errors,
    export_tasks,
    get_export_records
)
from fastapi.responses import FileResponse
import os

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("", response_model=TranscodeTaskResponse)
def create_new_task(task_data: TranscodeTaskCreate, db: Session = Depends(get_db)):
    task = create_task(db, task_data)
    return task


@router.get("", response_model=TaskListResponse)
def list_tasks(
    status: Optional[str] = None,
    created_by: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    filters = TaskFilter(
        status=status,
        created_by=created_by,
        search=search,
        page=page,
        page_size=page_size
    )
    tasks, total = get_tasks(db, filters)
    return TaskListResponse(
        tasks=tasks,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{task_id}", response_model=TranscodeTaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/{task_id}/versions", response_model=list[TranscodeTaskResponse])
def list_task_versions(task_id: int, db: Session = Depends(get_db)):
    versions = get_task_versions(db, task_id)
    return versions


@router.post("/{task_id}/confirm-watermark", response_model=TranscodeTaskResponse)
def confirm_task_watermark(task_id: int, db: Session = Depends(get_db)):
    task = confirm_watermark(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/{task_id}/approve", response_model=TranscodeTaskResponse)
def approve_task_by_id(task_id: int, approved_by: str = Query(...), db: Session = Depends(get_db)):
    task = approve_task(db, task_id, approved_by)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/{task_id}/retry", response_model=TranscodeTaskResponse)
def retry_task_by_id(task_id: int, db: Session = Depends(get_db)):
    task = retry_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or max retries exceeded")
    return task


@router.post("/{task_id}/rollback", response_model=TranscodeTaskResponse)
def rollback_task_to_version(task_id: int, target_version: int = Query(...), db: Session = Depends(get_db)):
    task = rollback_task(db, task_id, target_version)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or target version invalid")
    return task


@router.get("/{task_id}/errors", response_model=list[ErrorLogResponse])
def list_task_errors(task_id: int, db: Session = Depends(get_db)):
    errors = get_task_errors(db, task_id)
    return errors


@router.post("/export")
def export_tasks_data(export_request: ExportRequest, db: Session = Depends(get_db)):
    file_path = export_tasks(db, export_request)
    file_name = os.path.basename(file_path)
    return {"file_path": file_path, "file_name": file_name}


@router.get("/export/download/{file_name}")
def download_export(file_name: str):
    from app.core.config import settings
    file_path = os.path.join(settings.EXPORT_DIR, file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=file_name)


@router.get("/export/records", response_model=list[ExportRecordResponse])
def list_export_records(db: Session = Depends(get_db)):
    records = get_export_records(db)
    return records