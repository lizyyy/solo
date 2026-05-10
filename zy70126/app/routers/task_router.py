from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.schemas import BackgroundTask as TaskSchema, ResponseModel, TaskRetryRequest
from app.services.task_service import task_service
from app.models import TaskStatus

router = APIRouter(prefix="/api/v1/tasks", tags=["后台任务"])


def run_pending_tasks(db: Session):
    pending_tasks = task_service.get_pending_tasks(db)
    for task in pending_tasks:
        task_service.execute_task(db, task)


@router.post("", response_model=ResponseModel)
def create_task(
    task_type: str = Query(..., description="任务类型: notify_insurance, sync_transport, generate_report"),
    approval_id: Optional[int] = Query(None, description="关联的审批申请ID"),
    db: Session = Depends(get_db)
):
    task = task_service.create_task(db, task_type, approval_id=approval_id)
    return ResponseModel(
        success=True,
        message="后台任务创建成功",
        data={"task_id": task.task_id, "task_type": task.task_type, "status": task.status.value}
    )


@router.get("", response_model=List[TaskSchema])
def list_tasks(
    skip: int = 0,
    limit: int = 100,
    approval_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from app.models import BackgroundTask
    query = db.query(BackgroundTask)
    
    if approval_id:
        query = query.filter(BackgroundTask.approval_id == approval_id)
    if status:
        query = query.filter(BackgroundTask.status == status)
    
    return query.order_by(BackgroundTask.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/pending", response_model=List[TaskSchema])
def list_pending_tasks(db: Session = Depends(get_db)):
    return task_service.get_pending_tasks(db)


@router.get("/failed", response_model=List[TaskSchema])
def list_failed_tasks(
    approval_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    return task_service.get_failed_tasks(db, approval_id)


@router.get("/{task_id}", response_model=TaskSchema)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = task_service.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    return task


@router.post("/{task_id}/execute", response_model=ResponseModel)
def execute_task(task_id: str, db: Session = Depends(get_db)):
    task = task_service.get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    
    success = task_service.execute_task(db, task)
    
    task = task_service.get_task_by_id(db, task_id)
    
    if success:
        return ResponseModel(
            success=True,
            message=f"任务执行成功",
            data={
                "task_id": task.task_id,
                "status": task.status.value,
                "attempts": task.attempts,
                "result": task.result
            }
        )
    else:
        return ResponseModel(
            success=False,
            message=f"任务执行失败",
            data={
                "task_id": task.task_id,
                "status": task.status.value,
                "attempts": task.attempts,
                "error_message": task.error_message,
                "next_retry_at": task.next_retry_at.isoformat() if task.next_retry_at else None
            }
        )


@router.post("/{task_id}/retry", response_model=ResponseModel)
def retry_task(
    request: TaskRetryRequest,
    db: Session = Depends(get_db)
):
    try:
        task = task_service.retry_task(
            db, 
            task_id=request.task_id, 
            operator=request.operator, 
            force=request.force
        )
        return ResponseModel(
            success=True,
            message="任务重试已触发",
            data={
                "task_id": task.task_id,
                "status": task.status.value,
                "message": "任务已重置为待执行状态，可以立即执行或等待后台自动处理"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/process-pending", response_model=ResponseModel)
def process_pending_tasks(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    pending_count = len(task_service.get_pending_tasks(db))
    
    background_tasks.add_task(run_pending_tasks, db)
    
    return ResponseModel(
        success=True,
        message=f"已触发后台任务处理，共 {pending_count} 个待执行任务",
        data={"pending_count": pending_count}
    )


@router.post("/batch-retry", response_model=ResponseModel)
def batch_retry_failed_tasks(
    operator: str = Query(..., description="操作人"),
    approval_id: Optional[int] = Query(None, description="指定审批申请的失败任务"),
    force: bool = Query(False, description="是否强制重试"),
    db: Session = Depends(get_db)
):
    failed_tasks = task_service.get_failed_tasks(db, approval_id)
    
    if not failed_tasks:
        return ResponseModel(
            success=True,
            message="没有需要重试的失败任务",
            data={"retried_count": 0}
        )
    
    retried_count = 0
    errors = []
    
    for task in failed_tasks:
        try:
            task_service.retry_task(db, task.task_id, operator, force)
            retried_count += 1
        except Exception as e:
            errors.append({"task_id": task.task_id, "error": str(e)})
    
    return ResponseModel(
        success=len(errors) == 0,
        message=f"批量重试完成: 成功 {retried_count} 个，失败 {len(errors)} 个",
        data={
            "retried_count": retried_count,
            "failed_count": len(errors),
            "errors": errors
        }
    )
