from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
import tempfile
import os

from app.database import get_db
from app.models.enums import TaskStatus, TaskSource, RetryCategory
from app.schemas.task import (
    CompensationTask,
    CompensationTaskCreate,
    TaskListResponse,
    ReceiptSubmitRequest,
    ManualTakeoverRequest,
    CompensateRequest,
    CloseTaskRequest,
    RetryTaskRequest,
)
from app.services import task_service, import_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("/", response_model=CompensationTask)
def create_task(task_data: CompensationTaskCreate, db: Session = Depends(get_db)):
    return task_service.create_task(db, task_data)


@router.post("/submit-receipt", response_model=CompensationTask)
def submit_receipt(request: ReceiptSubmitRequest, db: Session = Depends(get_db)):
    task, created = task_service.submit_receipt(db, request)
    return task


@router.get("/", response_model=TaskListResponse)
def list_tasks(
    status: Optional[TaskStatus] = None,
    source: Optional[TaskSource] = None,
    box_no: Optional[str] = None,
    retry_category: Optional[RetryCategory] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    tasks, total = task_service.list_tasks(db, status, source, box_no, retry_category, skip, limit)
    return TaskListResponse(total=total, items=tasks)


@router.get("/{task_id}", response_model=CompensationTask)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = task_service.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.get("/task-no/{task_no}", response_model=CompensationTask)
def get_task_by_no(task_no: str, db: Session = Depends(get_db)):
    task = task_service.get_task_by_task_no(db, task_no)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("/{task_id}/retry", response_model=CompensationTask)
def retry_task(task_id: int, request: RetryTaskRequest, db: Session = Depends(get_db)):
    task = task_service.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    try:
        return task_service.retry_task(db, task, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{task_id}/manual-takeover", response_model=CompensationTask)
def manual_takeover(task_id: int, request: ManualTakeoverRequest, db: Session = Depends(get_db)):
    task = task_service.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task_service.manual_takeover(db, task, request)


@router.post("/{task_id}/compensate", response_model=CompensationTask)
def compensate_task(task_id: int, request: CompensateRequest, db: Session = Depends(get_db)):
    task = task_service.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    try:
        return task_service.compensate_task(db, task, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{task_id}/close", response_model=CompensationTask)
def close_task(task_id: int, request: CloseTaskRequest, db: Session = Depends(get_db)):
    task = task_service.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task_service.close_task(db, task, request)


@router.post("/{task_id}/mark-permanent-failed", response_model=CompensationTask)
def mark_permanent_failed(
    task_id: int,
    operator: Optional[str] = None,
    remark: Optional[str] = None,
    db: Session = Depends(get_db),
):
    task = task_service.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task_service.mark_permanent_failed(db, task, operator, remark)


@router.post("/import/file")
def import_file(
    source: TaskSource,
    file: UploadFile = File(...),
    key_fields: Optional[str] = None,
    db: Session = Depends(get_db),
):
    key_fields_list = key_fields.split(",") if key_fields else None

    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        tmp.write(file.file.read())
        tmp_path = tmp.name

    try:
        result = import_service.import_data_from_file(db, tmp_path, source, key_fields_list)
        return result
    finally:
        os.unlink(tmp_path)


@router.post("/import/json")
def import_json(
    source: TaskSource,
    source_file: str,
    data: List[dict],
    key_fields: Optional[str] = None,
    db: Session = Depends(get_db),
):
    key_fields_list = key_fields.split(",") if key_fields else None
    result = import_service.import_json_data(db, data, source, source_file, key_fields_list)
    return result
