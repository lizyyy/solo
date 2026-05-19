from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import TaskStatus, TaskPriority, ExceptionType
from app.schemas import (
    TaskCreate, Task as TaskSchema, TaskDetail,
    TaskAssign, TaskAccept, TaskTransfer,
    TaskComplete, TaskCancel, TaskUpdatePriority,
    BatchAssign, BatchComplete, BatchCancel,
    BatchUpdatePriority, BatchResult, AuditLog
)
from app.services import TaskService, BatchService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("/", response_model=TaskSchema)
def create_task(task_data: TaskCreate, db: Session = Depends(get_db)):
    service = TaskService(db)
    task, status = service.create_task(
        request_id=task_data.request_id,
        patient_name=task_data.patient_name,
        patient_medical_record_no=task_data.patient_medical_record_no,
        patient_phone=task_data.patient_phone,
        patient_department=task_data.patient_department,
        patient_bed_no=task_data.patient_bed_no,
        service_type=task_data.service_type,
        from_location=task_data.from_location,
        to_location=task_data.to_location,
        description=task_data.description,
        priority=task_data.priority,
        operator_role=task_data.operator_role,
        operator_name=task_data.operator_name,
    )
    return task


@router.get("/{task_id}", response_model=TaskDetail)
def get_task(task_id: int, db: Session = Depends(get_db)):
    service = TaskService(db)
    task = service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/", response_model=List[TaskSchema])
def list_tasks(
    status: Optional[TaskStatus] = None,
    escort_id: Optional[int] = None,
    priority: Optional[TaskPriority] = None,
    has_exception: Optional[bool] = None,
    exception_type: Optional[ExceptionType] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    service = TaskService(db)
    tasks = service.list_tasks(
        status=status,
        escort_id=escort_id,
        priority=priority,
        has_exception=has_exception,
        exception_type=exception_type,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )
    return tasks


@router.post("/{task_id}/assign", response_model=TaskSchema)
def assign_task(task_id: int, data: TaskAssign, db: Session = Depends(get_db)):
    service = TaskService(db)
    task, status = service.assign_task(
        task_id=task_id,
        escort_id=data.escort_id,
        operator_role=data.operator_role,
        operator_name=data.operator_name,
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task or escort not found")
    if status == "invalid_status":
        raise HTTPException(status_code=400, detail="Invalid task status for assignment")
    return task


@router.post("/{task_id}/accept", response_model=TaskSchema)
def accept_task(task_id: int, data: TaskAccept, db: Session = Depends(get_db)):
    service = TaskService(db)
    task, status = service.accept_task(
        task_id=task_id,
        operator_role=data.operator_role,
        operator_name=data.operator_name,
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if status == "invalid_status":
        raise HTTPException(status_code=400, detail="Invalid task status for acceptance")
    return task


@router.post("/{task_id}/transfer", response_model=TaskSchema)
def transfer_task(task_id: int, data: TaskTransfer, db: Session = Depends(get_db)):
    service = TaskService(db)
    task, status = service.transfer_task(
        task_id=task_id,
        new_escort_id=data.new_escort_id,
        operator_role=data.operator_role,
        operator_name=data.operator_name,
        note=data.note,
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task or escort not found")
    if status == "invalid_status":
        raise HTTPException(status_code=400, detail="Invalid task status for transfer")
    return task


@router.post("/{task_id}/complete", response_model=TaskSchema)
def complete_task(task_id: int, data: TaskComplete, db: Session = Depends(get_db)):
    service = TaskService(db)
    task, status = service.complete_task(
        task_id=task_id,
        operator_role=data.operator_role,
        operator_name=data.operator_name,
        completion_note=data.completion_note,
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if status == "invalid_status":
        raise HTTPException(status_code=400, detail="Invalid task status for completion")
    return task


@router.post("/{task_id}/cancel", response_model=TaskSchema)
def cancel_task(task_id: int, data: TaskCancel, db: Session = Depends(get_db)):
    service = TaskService(db)
    task, status = service.cancel_task(
        task_id=task_id,
        operator_role=data.operator_role,
        operator_name=data.operator_name,
        cancel_reason=data.cancel_reason,
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if status == "already_completed":
        raise HTTPException(status_code=400, detail="Task already completed, cannot cancel")
    return task


@router.post("/{task_id}/check-timeout", response_model=TaskSchema)
def check_task_timeout(task_id: int, db: Session = Depends(get_db)):
    service = TaskService(db)
    task, status = service.check_timeout(task_id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/{task_id}/update-priority", response_model=TaskSchema)
def update_task_priority(task_id: int, data: TaskUpdatePriority, db: Session = Depends(get_db)):
    service = TaskService(db)
    task, status = service.update_priority(
        task_id=task_id,
        new_priority=data.new_priority,
        operator_role=data.operator_role,
        operator_name=data.operator_name,
        note=data.note,
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if status == "invalid_status":
        raise HTTPException(status_code=400, detail="Invalid task status for priority update")
    return task


@router.get("/{task_id}/audit-logs", response_model=List[AuditLog])
def get_task_audit_logs(task_id: int, db: Session = Depends(get_db)):
    service = TaskService(db)
    logs = service.get_audit_logs(task_id=task_id)
    return logs


@router.post("/batch/assign", response_model=BatchResult)
def batch_assign_tasks(data: BatchAssign, db: Session = Depends(get_db)):
    service = BatchService(db)
    result = service.batch_assign(
        task_ids=data.task_ids,
        escort_id=data.escort_id,
        operator_role=data.operator_role,
        operator_name=data.operator_name,
    )
    return result


@router.post("/batch/complete", response_model=BatchResult)
def batch_complete_tasks(data: BatchComplete, db: Session = Depends(get_db)):
    service = BatchService(db)
    result = service.batch_complete(
        task_ids=data.task_ids,
        operator_role=data.operator_role,
        operator_name=data.operator_name,
        completion_note=data.completion_note,
    )
    return result


@router.post("/batch/cancel", response_model=BatchResult)
def batch_cancel_tasks(data: BatchCancel, db: Session = Depends(get_db)):
    service = BatchService(db)
    result = service.batch_cancel(
        task_ids=data.task_ids,
        operator_role=data.operator_role,
        operator_name=data.operator_name,
        cancel_reason=data.cancel_reason,
    )
    return result


@router.post("/batch/update-priority", response_model=BatchResult)
def batch_update_priority(data: BatchUpdatePriority, db: Session = Depends(get_db)):
    service = BatchService(db)
    result = service.batch_update_priority(
        task_ids=data.task_ids,
        new_priority=data.new_priority,
        operator_role=data.operator_role,
        operator_name=data.operator_name,
        note=data.note,
    )
    return result


@router.post("/batch/check-timeout", response_model=BatchResult)
def batch_check_timeout(task_ids: List[int], db: Session = Depends(get_db)):
    service = BatchService(db)
    result = service.batch_check_timeout(task_ids=task_ids)
    return result
