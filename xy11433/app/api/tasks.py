from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models import AsyncTask
from app.schemas import AsyncTaskResponse, PaginatedResponse
from app.services import TaskService

router = APIRouter(prefix="/tasks", tags=["异步任务"])


@router.post("")
def create_task(
    task_type: str,
    task_params: dict,
    created_by: str,
    max_retry_count: int = 3,
    db: Session = Depends(get_db)
):
    task_service = TaskService(db)
    task = task_service.create_task(
        task_type=task_type,
        task_params=task_params,
        created_by=created_by,
        max_retry_count=max_retry_count
    )
    return {"task_id": task.task_id, "status": task.status}


@router.get("", response_model=PaginatedResponse)
def get_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    task_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AsyncTask)
    
    if status:
        query = query.filter(AsyncTask.status == status)
    if task_type:
        query = query.filter(AsyncTask.task_type == task_type)
    
    total = query.count()
    tasks = query.order_by(AsyncTask.created_at.desc()) \
        .offset((page - 1) * page_size) \
        .limit(page_size) \
        .all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": tasks
    }


@router.get("/{task_id}", response_model=AsyncTaskResponse)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(AsyncTask).filter(
        AsyncTask.task_id == task_id
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return task


@router.post("/{task_id}/execute")
def execute_task(task_id: str, db: Session = Depends(get_db)):
    task_service = TaskService(db)
    
    try:
        task = task_service.execute_task(task_id)
        return {
            "task_id": task.task_id,
            "status": task.status,
            "result": task.task_result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{task_id}/retry")
def retry_task(task_id: str, db: Session = Depends(get_db)):
    task_service = TaskService(db)
    
    try:
        task = task_service.retry_task(task_id)
        return {"task_id": task.task_id, "status": task.status}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{task_id}/manual")
def mark_for_manual(
    task_id: str,
    reason: str,
    db: Session = Depends(get_db)
):
    task_service = TaskService(db)
    
    try:
        task = task_service.mark_for_manual(task_id, reason)
        return {"task_id": task.task_id, "status": task.status}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/process-pending")
def process_pending_tasks(db: Session = Depends(get_db)):
    task_service = TaskService(db)
    result = task_service.process_pending_tasks()
    return result


@router.post("/recover-on-startup")
def recover_tasks(db: Session = Depends(get_db)):
    task_service = TaskService(db)
    result = task_service.recover_tasks_on_startup()
    return result
