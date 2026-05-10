from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.schemas import (
    WarmupTaskCreate, WarmupTaskUpdate, WarmupTaskResponse,
    ExecutionStartRequest, ExecutionResponse, WarmupReport,
    PatchRequest, RollbackRequest, ExecutionItemResponse
)
from app.services.task_service import task_service
from app.services.orchestrator import orchestrator

router = APIRouter(prefix="/api/tasks", tags=["预热任务管理"])


@router.post("", response_model=WarmupTaskResponse, summary="创建预热任务")
def create_task(task_data: WarmupTaskCreate, db: Session = Depends(get_db)):
    """
    创建一个新的缓存预热任务
    
    - **task_name**: 任务名称
    - **data_source_type**: 数据源类型 (如: mock)
    - **data_source_config**: 数据源配置 (JSON字符串)
    - **cache_key_pattern**: 缓存键格式，支持 {key} 变量替换
    - **version_strategy**: 版本策略 (timestamp/checksum/timestamp_checksum)
    - **default_concurrency**: 默认并发数
    - **default_qps_limit**: 默认QPS限制
    """
    try:
        task = task_service.create_task(db, task_data)
        return task
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=dict, summary="列出预热任务")
def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    tasks, total = task_service.list_tasks(db, page, page_size)
    return {
        "total": total,
        "items": [WarmupTaskResponse.model_validate(t) for t in tasks],
        "page": page,
        "page_size": page_size
    }


@router.get("/{task_id}", response_model=WarmupTaskResponse, summary="获取任务详情")
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = task_service.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.put("/{task_id}", response_model=WarmupTaskResponse, summary="更新任务")
def update_task(
    task_id: int,
    task_data: WarmupTaskUpdate,
    db: Session = Depends(get_db)
):
    task = task_service.update_task(db, task_id, task_data)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.delete("/{task_id}", summary="删除任务")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    if not task_service.delete_task(db, task_id):
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"message": "删除成功"}


@router.post("/{task_id}/start", response_model=ExecutionResponse, summary="开始预热执行")
def start_execution(
    task_id: int,
    request: ExecutionStartRequest = ExecutionStartRequest(),
    db: Session = Depends(get_db)
):
    """
    开始执行缓存预热任务
    
    - **concurrency**: 并发数（不填使用任务默认值）
    - **qps_limit**: QPS限制（不填使用任务默认值）
    - **force_version**: 强制使用指定版本号（用于重跑同一批数据）
    """
    try:
        execution = task_service.start_execution(db, task_id, request)
        return execution
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{task_id}/executions", response_model=dict, summary="列出任务执行历史")
def list_executions(
    task_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    executions, total = task_service.list_executions(db, task_id, page, page_size)
    return {
        "total": total,
        "items": [ExecutionResponse.model_validate(e) for e in executions],
        "page": page,
        "page_size": page_size
    }
