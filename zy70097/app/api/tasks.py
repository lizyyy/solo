from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.models import BackgroundTask
from app.schemas import (
    BaselineCalculationRequest,
    SavingCalculationRequest,
    ExportRequest,
    RetryTaskRequest,
    TaskResponse
)
from app.services import TaskService

router = APIRouter(prefix="/api/tasks", tags=["任务管理"])


@router.post("/baseline/calculate", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
def submit_baseline_calculation(
    request: BaselineCalculationRequest,
    db: Session = Depends(get_db)
):
    """
    提交基线计算任务（后台异步执行）
    
    返回任务信息，可通过任务ID查询执行状态
    """
    try:
        if request.equipment_ids and len(request.equipment_ids) > 0:
            if len(request.equipment_ids) == 1 and not request.group_ids:
                task = TaskService.submit_baseline_calculation(
                    db=db,
                    equipment_id=request.equipment_ids[0],
                    start_date=request.start_date,
                    end_date=request.end_date,
                    version_name=request.version_name,
                    created_by=request.created_by
                )
            else:
                task = TaskService.submit_batch_baseline_calculation(
                    db=db,
                    equipment_ids=request.equipment_ids,
                    group_ids=request.group_ids,
                    start_date=request.start_date,
                    end_date=request.end_date,
                    version_name=request.version_name,
                    created_by=request.created_by
                )
        elif request.group_ids and len(request.group_ids) > 0:
            if len(request.group_ids) == 1:
                task = TaskService.submit_baseline_calculation(
                    db=db,
                    group_id=request.group_ids[0],
                    start_date=request.start_date,
                    end_date=request.end_date,
                    version_name=request.version_name,
                    created_by=request.created_by
                )
            else:
                task = TaskService.submit_batch_baseline_calculation(
                    db=db,
                    equipment_ids=request.equipment_ids,
                    group_ids=request.group_ids,
                    start_date=request.start_date,
                    end_date=request.end_date,
                    version_name=request.version_name,
                    created_by=request.created_by
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="必须指定设备ID或分组ID"
            )
        
        return task
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/savings/calculate", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
def submit_saving_calculation(
    request: SavingCalculationRequest,
    db: Session = Depends(get_db)
):
    """
    提交节能收益计算任务（后台异步执行）
    """
    try:
        if request.equipment_ids and len(request.equipment_ids) > 0:
            if len(request.equipment_ids) == 1 and not request.group_ids:
                task = TaskService.submit_saving_calculation(
                    db=db,
                    equipment_id=request.equipment_ids[0],
                    baseline_id=request.baseline_id,
                    period_start=request.period_start,
                    period_end=request.period_end,
                    created_by=request.created_by
                )
            else:
                task = TaskService.submit_batch_saving_calculation(
                    db=db,
                    equipment_ids=request.equipment_ids,
                    group_ids=request.group_ids,
                    baseline_id=request.baseline_id,
                    period_start=request.period_start,
                    period_end=request.period_end,
                    created_by=request.created_by
                )
        elif request.group_ids and len(request.group_ids) > 0:
            if len(request.group_ids) == 1:
                task = TaskService.submit_saving_calculation(
                    db=db,
                    group_id=request.group_ids[0],
                    baseline_id=request.baseline_id,
                    period_start=request.period_start,
                    period_end=request.period_end,
                    created_by=request.created_by
                )
            else:
                task = TaskService.submit_batch_saving_calculation(
                    db=db,
                    equipment_ids=request.equipment_ids,
                    group_ids=request.group_ids,
                    baseline_id=request.baseline_id,
                    period_start=request.period_start,
                    period_end=request.period_end,
                    created_by=request.created_by
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="必须指定设备ID或分组ID"
            )
        
        return task
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/export", response_model=TaskResponse, status_code=status.HTTP_202_ACCEPTED)
def submit_export_task(
    request: ExportRequest,
    db: Session = Depends(get_db)
):
    """
    提交导出任务（后台异步执行）
    
    导出类型：
    - baseline: 基线报告
    - saving: 节能收益报告
    - energy_data: 能耗数据
    - production_data: 产量数据
    - audit: 审计日志
    """
    try:
        task = TaskService.submit_export_task(
            db=db,
            export_type=request.export_type,
            equipment_ids=request.equipment_ids,
            group_ids=request.group_ids,
            baseline_id=request.baseline_id,
            period_start=request.period_start,
            period_end=request.period_end,
            file_format=request.file_format,
            created_by=request.created_by
        )
        
        return task
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/", response_model=List[TaskResponse])
def list_tasks(
    skip: int = 0,
    limit: int = 100,
    task_type: Optional[str] = None,
    status: Optional[str] = None,
    created_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取任务列表"""
    query = db.query(BackgroundTask)
    
    if task_type:
        query = query.filter(BackgroundTask.task_type == task_type)
    if status:
        query = query.filter(BackgroundTask.status == status)
    if created_by:
        query = query.filter(BackgroundTask.created_by == created_by)
    
    return query.order_by(BackgroundTask.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{task_id}", response_model=TaskResponse)
def get_task_status(
    task_id: str,
    db: Session = Depends(get_db)
):
    """
    获取任务状态
    
    任务状态说明：
    - pending: 等待执行
    - running: 正在执行
    - completed: 执行成功
    - failed: 执行失败（超过最大重试次数）
    - retrying: 正在重试
    """
    task = TaskService.get_task_status(db, task_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"任务 {task_id} 不存在"
        )
    
    return task


@router.post("/{task_id}/retry", response_model=TaskResponse)
def retry_task(
    task_id: str,
    force: bool = False,
    db: Session = Depends(get_db)
):
    """
    重试失败的任务
    
    参数说明：
    - force: 是否强制重试（即使已达到最大重试次数）
    
    重试表现：
    - 不会重复创建已成功的记录
    - 从任务参数重新执行
    - 重试次数会记录在 retry_count 字段中
    """
    try:
        TaskService.retry_task(db, task_id, force)
        
        task = TaskService.get_task_status(db, task_id)
        return task
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{task_id}/result")
def get_task_result(
    task_id: str,
    db: Session = Depends(get_db)
):
    """获取任务执行结果"""
    task = TaskService.get_task_status(db, task_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"任务 {task_id} 不存在"
        )
    
    return {
        "task_id": task.task_id,
        "status": task.status,
        "progress": task.progress,
        "result": task.result,
        "error_message": task.error_message,
        "retry_count": task.retry_count,
        "max_retries": task.max_retries,
        "export_file": task.export_file
    }
