from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.schemas import ChargingTaskCreate, ChargingTask as ChargingTaskSchema, BatchResult
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["充电任务"])


@router.post("/", summary="创建单个充电任务")
def create_task(
    task: ChargingTaskCreate,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    db_task, error = service.create_task(task, operator)
    
    if error and db_task.status == "rejected":
        return {
            "task": db_task,
            "status": "rejected",
            "reason": error
        }
    
    return {
        "task": db_task,
        "status": "approved"
    }


@router.post("/batch", response_model=BatchResult, summary="批量创建充电任务")
def batch_create_tasks(
    tasks: List[ChargingTaskCreate],
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    result = service.batch_create_tasks(tasks, operator)
    return result


@router.get("/", response_model=List[ChargingTaskSchema], summary="获取任务列表")
def get_tasks(
    requested_by: Optional[str] = Query(None, description="按负责人筛选"),
    status: Optional[str] = Query(None, description="按状态筛选"),
    shift: Optional[str] = Query(None, description="按班次筛选"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    return service.get_tasks(
        requested_by=requested_by,
        status=status,
        shift=shift,
        skip=skip,
        limit=limit
    )


@router.get("/{task_id}", response_model=ChargingTaskSchema, summary="获取单个任务详情")
def get_task(task_id: int, db: Session = Depends(get_db)):
    service = TaskService(db)
    task = service.get_task_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.get("/{task_id}/reason", summary="获取任务拦截/放行原因")
def get_task_reason(task_id: int, db: Session = Depends(get_db)):
    service = TaskService(db)
    task = service.get_task_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return {
        "task_id": task_id,
        "status": task.status,
        "reason": task.reason
    }
