from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.task import BackgroundTaskCreate, BackgroundTaskResponse
from app.services.task_service import TaskService

router = APIRouter(prefix="/api/v1/tasks", tags=["后台任务"])


@router.post("/", response_model=BackgroundTaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(task_data: BackgroundTaskCreate, db: AsyncSession = Depends(get_db)):
    """创建后台任务"""
    service = TaskService(db)
    task = await service.create_task(task_data)
    await db.commit()
    return task


@router.get("/", response_model=List[BackgroundTaskResponse])
async def list_tasks(
    task_type: Optional[str] = None,
    status: Optional[str] = None,
    task_key: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """列出任务"""
    service = TaskService(db)
    tasks = await service.list_tasks(
        task_type=task_type,
        status=status,
        task_key=task_key,
        limit=limit,
        offset=offset,
    )
    return tasks


@router.get("/{task_id}", response_model=BackgroundTaskResponse)
async def get_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """获取任务详情"""
    service = TaskService(db)
    task = await service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    return task


@router.post("/{task_id}/cancel", response_model=BackgroundTaskResponse)
async def cancel_task(
    task_id: int,
    cancelled_by: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """取消任务"""
    service = TaskService(db)
    task = await service.cancel_task(task_id, cancelled_by=cancelled_by)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    await db.commit()
    return task


@router.get("/next/pending", response_model=Optional[BackgroundTaskResponse])
async def get_next_pending_task(
    task_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """获取下一个待处理任务"""
    service = TaskService(db)
    task = await service.get_next_pending_task(task_type=task_type)
    return task


@router.get("/retryable")
async def get_retryable_tasks(db: AsyncSession = Depends(get_db)):
    """获取可重试的任务"""
    service = TaskService(db)
    tasks = await service.get_retryable_tasks()
    return {"count": len(tasks), "tasks": tasks}


@router.get("/stats")
async def get_task_statistics(db: AsyncSession = Depends(get_db)):
    """获取任务统计"""
    service = TaskService(db)
    stats = await service.get_task_statistics()
    return stats
