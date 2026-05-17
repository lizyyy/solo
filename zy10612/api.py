from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import TaskStatus
from schemas import (
    TaskCreate, TaskResponse, TaskUpdateStatus, TaskRetry,
    HistoryResponse, TaskWithHistory, ConflictDetectionResponse,
    BadRowImportRequest
)
from services import (
    create_task, get_task_by_no, update_task_status, retry_task,
    get_task_history, list_tasks, detect_duplicate_tasks, record_bad_row_import
)

router = APIRouter(tags=["报表导出任务"])


@router.post("/tasks", response_model=TaskResponse, status_code=201)
def create_export_task(task_data: TaskCreate, db: Session = Depends(get_db)):
    task = create_task(db, task_data)
    return task


@router.post("/tasks/check-conflict", response_model=ConflictDetectionResponse)
def check_task_conflict(task_data: TaskCreate, db: Session = Depends(get_db)):
    duplicate_tasks = detect_duplicate_tasks(db, task_data)
    has_conflict = len(duplicate_tasks) > 0
    message = f"发现 {len(duplicate_tasks)} 个相同条件的排队/生成中/重试中任务" if has_conflict else "无冲突任务"
    return ConflictDetectionResponse(
        has_conflict=has_conflict,
        existing_tasks=[TaskResponse.from_orm(t) for t in duplicate_tasks],
        message=message
    )


@router.get("/tasks", response_model=list[TaskResponse])
def get_tasks_list(
    tenant_id: Optional[str] = None,
    status: Optional[TaskStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return list_tasks(db, tenant_id=tenant_id, status=status, skip=skip, limit=limit)


@router.get("/tasks/{task_no}", response_model=TaskWithHistory)
def get_task_detail(task_no: str, db: Session = Depends(get_db)):
    task = get_task_by_no(db, task_no)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    history = get_task_history(db, task_no) or []
    task_data = TaskResponse.from_orm(task)
    return TaskWithHistory(
        **task_data.dict(),
        history=[HistoryResponse.from_orm(h) for h in history]
    )


@router.get("/tasks/{task_no}/history", response_model=list[HistoryResponse])
def get_task_history_list(task_no: str, db: Session = Depends(get_db)):
    history = get_task_history(db, task_no)
    if history is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    return history


@router.put("/tasks/{task_no}/status", response_model=TaskResponse)
def update_task_status_endpoint(task_no: str, update_data: TaskUpdateStatus, db: Session = Depends(get_db)):
    task = update_task_status(db, task_no, update_data)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("/tasks/{task_no}/retry", response_model=TaskResponse)
def retry_task_endpoint(task_no: str, retry_data: TaskRetry, db: Session = Depends(get_db)):
    try:
        task = retry_task(db, task_no, retry_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("/tasks/bad-row", status_code=201)
def record_bad_row(request: BadRowImportRequest, db: Session = Depends(get_db)):
    history = record_bad_row_import(db, request)
    if not history:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"status": "success", "message": "坏行记录已添加到历史"}
