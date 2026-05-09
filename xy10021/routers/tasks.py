from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db, Task
from schemas import TaskResponse
from services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["任务"])


@router.get("", response_model=List[TaskResponse])
def list_tasks(
    status: str = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    query = db.query(Task)
    
    if status:
        query = query.filter(Task.status == status)
    
    tasks = query.order_by(Task.created_at.desc())\
        .offset((page - 1) * page_size)\
        .limit(page_size)\
        .all()
    
    return tasks


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: str,
    db: Session = Depends(get_db)
):
    task = TaskService.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("/{task_id}/retry")
def retry_task(
    task_id: str,
    db: Session = Depends(get_db)
):
    task = TaskService.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task.status not in ["failed"]:
        raise HTTPException(status_code=400, detail="只有失败的任务才能重试")
    
    if task.retry_count >= task.max_retries:
        raise HTTPException(status_code=400, detail="已达到最大重试次数")
    
    updated = TaskService.increment_retry_count(db, task_id)
    
    return {
        "message": "任务已标记为重试",
        "task_id": task_id,
        "retry_count": updated.retry_count
    }


@router.delete("/{task_id}")
def cancel_task(
    task_id: str,
    db: Session = Depends(get_db)
):
    task = TaskService.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task.status == "running":
        raise HTTPException(status_code=400, detail="无法取消正在运行的任务")
    
    db.delete(task)
    db.commit()
    
    return {"message": "任务已取消"}
