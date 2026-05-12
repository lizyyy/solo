from fastapi import APIRouter, Depends, Query, Header
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.database import get_db
from app.models.models import TaskStatus
from app.schemas.schemas import (
    RestockTaskCreate, RestockTaskUpdate, RestockTaskResponse, RestockAnalysis
)
from app.services.task_service import TaskService
from app.utils.exceptions import BusinessException, handle_business_exception
from app.utils.idempotent import IdempotentManager

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


@router.get("/analyze/{machine_id}", response_model=RestockAnalysis)
def analyze_restock_demand(machine_id: str, db: Session = Depends(get_db)):
    service = TaskService(db)
    try:
        return service.analyze_restock_demand(machine_id)
    except BusinessException as e:
        raise handle_business_exception(e)


@router.post("", response_model=RestockTaskResponse, status_code=201)
def create_task(
    task_data: RestockTaskCreate,
    idempotent_key: Optional[str] = Header(None),
    skip_fault_check: bool = Query(False),
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    
    if idempotent_key:
        idempotent_mgr = IdempotentManager(db)
        existing = idempotent_mgr.check_and_get(idempotent_key, "create_task")
        if existing:
            return service.get_task(existing.resource_id)
        
        try:
            task = service.create_task(task_data, operator, skip_fault_check)
            idempotent_mgr.record(idempotent_key, "create_task", task.id)
            return task
        except BusinessException as e:
            raise handle_business_exception(e)
    
    try:
        return service.create_task(task_data, operator, skip_fault_check)
    except BusinessException as e:
        raise handle_business_exception(e)


@router.get("", response_model=List[RestockTaskResponse])
def list_tasks(
    status: Optional[TaskStatus] = Query(None),
    machine_id: Optional[str] = Query(None),
    route_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    return service.list_tasks(status, machine_id, route_id)


@router.get("/{task_id}", response_model=RestockTaskResponse)
def get_task(task_id: str, db: Session = Depends(get_db)):
    service = TaskService(db)
    try:
        return service.get_task(task_id)
    except BusinessException as e:
        raise handle_business_exception(e)


@router.patch("/{task_id}", response_model=RestockTaskResponse)
def update_task(
    task_id: str,
    update_data: RestockTaskUpdate,
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    try:
        return service.update_task(task_id, update_data, operator)
    except BusinessException as e:
        raise handle_business_exception(e)


@router.post("/{task_id}/start", response_model=RestockTaskResponse)
def start_task(
    task_id: str,
    idempotent_key: Optional[str] = Header(None),
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    try:
        return service.update_task_status(task_id, TaskStatus.IN_PROGRESS, operator, "Task started")
    except BusinessException as e:
        raise handle_business_exception(e)


@router.post("/{task_id}/execute", response_model=RestockTaskResponse)
def execute_task(
    task_id: str,
    actual_items: List[Dict[str, Any]],
    idempotent_key: Optional[str] = Header(None),
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    try:
        return service.complete_task_execution(task_id, actual_items, operator)
    except BusinessException as e:
        raise handle_business_exception(e)


@router.post("/{task_id}/complete", response_model=RestockTaskResponse)
def complete_task(
    task_id: str,
    idempotent_key: Optional[str] = Header(None),
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    try:
        return service.update_task_status(task_id, TaskStatus.COMPLETED, operator, "Task completed")
    except BusinessException as e:
        raise handle_business_exception(e)


@router.post("/{task_id}/cancel", response_model=RestockTaskResponse)
def cancel_task(
    task_id: str,
    reason: str = Query("Manual cancellation"),
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    try:
        return service.cancel_task(task_id, operator, reason)
    except BusinessException as e:
        raise handle_business_exception(e)


@router.post("/{task_id}/fail", response_model=RestockTaskResponse)
def fail_task(
    task_id: str,
    failed_reason: str = Query(...),
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    try:
        return service.fail_task(task_id, failed_reason, operator)
    except BusinessException as e:
        raise handle_business_exception(e)
