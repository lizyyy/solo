from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.models import Task, TaskStatus, Forklift
from app.schemas.schemas import TaskCreate, TaskResponse, APIResponse
from app.services.battery_service import BatteryService

router = APIRouter(prefix="/api/tasks", tags=["任务管理"])

@router.post("", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
    forklift = db.query(Forklift).filter(
        Forklift.forklift_code == data.forklift_code,
        Forklift.is_deleted == False
    ).first()
    
    if not forklift:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"叉车 {data.forklift_code} 不存在"
        )
    
    existing = db.query(Task).filter(
        Task.task_code == data.task_code
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"任务编号 {data.task_code} 已存在"
        )
    
    task = Task(
        task_code=data.task_code,
        forklift_id=forklift.id,
        priority=data.priority,
        estimated_duration_hours=data.estimated_duration_hours,
        required_battery_percent=data.required_battery_percent,
        scheduled_start_time=data.scheduled_start_time,
        scheduled_end_time=data.scheduled_end_time,
        description=data.description
    )
    
    db.add(task)
    db.commit()
    db.refresh(task)
    
    battery_service = BatteryService(db)
    battery_check = battery_service.check_task_battery_requirement(
        forklift_id=forklift.id,
        task_required_percent=data.required_battery_percent
    )
    
    response_data = {
        "task": TaskResponse.from_orm(task).dict(),
        "battery_check": battery_check
    }
    
    return APIResponse(
        success=True,
        code="CREATED",
        message="任务创建成功" if battery_check["has_sufficient_battery"] else "任务创建成功，但需要充电",
        data=response_data
    )

@router.get("/{task_code}", response_model=APIResponse)
def get_task(task_code: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.task_code == task_code).first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"任务 {task_code} 不存在"
        )
    
    return APIResponse(
        success=True,
        code="OK",
        message="查询成功",
        data={"task": TaskResponse.from_orm(task).dict()}
    )

@router.get("", response_model=APIResponse)
def list_tasks(
    status_filter: Optional[TaskStatus] = None,
    forklift_code: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Task)
    
    if status_filter:
        query = query.filter(Task.status == status_filter)
    
    if forklift_code:
        forklift = db.query(Forklift).filter(
            Forklift.forklift_code == forklift_code
        ).first()
        if forklift:
            query = query.filter(Task.forklift_id == forklift.id)
    
    tasks = query.order_by(Task.scheduled_start_time.asc()).all()
    
    return APIResponse(
        success=True,
        code="OK",
        message="查询成功",
        data={
            "tasks": [TaskResponse.from_orm(t).dict() for t in tasks],
            "total": len(tasks)
        }
    )

@router.patch("/{task_code}/start", response_model=APIResponse)
def start_task(task_code: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.task_code == task_code).first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"任务 {task_code} 不存在"
        )
    
    if task.status != TaskStatus.PENDING:
        return APIResponse(
            success=False,
            code="INVALID_STATUS",
            message=f"任务状态为 {task.status.value}，无法开始"
        )
    
    battery_service = BatteryService(db)
    battery_check = battery_service.check_task_battery_requirement(
        forklift_id=task.forklift_id,
        task_required_percent=task.required_battery_percent
    )
    
    if not battery_check["has_sufficient_battery"]:
        return APIResponse(
            success=False,
            code="INSUFFICIENT_BATTERY",
            message=f"电量不足，需要 {task.required_battery_percent}%，当前 {battery_check['current_battery_percent']}%",
            data={"battery_check": battery_check}
        )
    
    task.status = TaskStatus.IN_PROGRESS
    task.actual_start_time = db.func.now()
    db.commit()
    db.refresh(task)
    
    return APIResponse(
        success=True,
        code="STARTED",
        message="任务已开始",
        data={"task": TaskResponse.from_orm(task).dict()}
    )

@router.patch("/{task_code}/complete", response_model=APIResponse)
def complete_task(task_code: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.task_code == task_code).first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"任务 {task_code} 不存在"
        )
    
    if task.status != TaskStatus.IN_PROGRESS:
        return APIResponse(
            success=False,
            code="INVALID_STATUS",
            message=f"任务状态为 {task.status.value}，无法完成"
        )
    
    task.status = TaskStatus.COMPLETED
    task.actual_end_time = db.func.now()
    db.commit()
    db.refresh(task)
    
    return APIResponse(
        success=True,
        code="COMPLETED",
        message="任务已完成",
        data={"task": TaskResponse.from_orm(task).dict()}
    )
