from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from typing import List
from database import get_db, LogSource, Task
from schemas import LogSourceCreate, LogSourceUpdate, LogSourceResponse
from services.audit_service import AuditService
from services.task_service import TaskService

router = APIRouter(prefix="/sources", tags=["日志源"])


def _source_to_dict(source: LogSource) -> dict:
    return {
        "id": source.id,
        "name": source.name,
        "source_type": source.source_type,
        "config": source.config,
        "description": source.description,
        "is_active": source.is_active,
        "version": source.version,
        "created_at": source.created_at.isoformat() if source.created_at else None,
        "updated_at": source.updated_at.isoformat() if source.updated_at else None
    }


@router.get("", response_model=List[LogSourceResponse])
def list_sources(
    db: Session = Depends(get_db)
):
    sources = db.query(LogSource).order_by(LogSource.id.desc()).all()
    return sources


@router.get("/{source_id}", response_model=LogSourceResponse)
def get_source(
    source_id: int,
    db: Session = Depends(get_db)
):
    source = db.query(LogSource).filter(LogSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="日志源不存在")
    return source


@router.post("", response_model=LogSourceResponse, status_code=201)
def create_source(
    source_data: LogSourceCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    source = LogSource(
        name=source_data.name,
        source_type=source_data.source_type.value,
        config=source_data.config,
        description=source_data.description,
        is_active=source_data.is_active
    )
    
    db.add(source)
    db.commit()
    db.refresh(source)
    
    AuditService.log_action(
        db=db,
        action="create",
        resource_type="log_source",
        resource_id=str(source.id),
        new_value=_source_to_dict(source),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return source


@router.put("/{source_id}", response_model=LogSourceResponse)
def update_source(
    source_id: int,
    source_data: LogSourceUpdate,
    request: Request,
    db: Session = Depends(get_db)
):
    source = db.query(LogSource).filter(LogSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="日志源不存在")
    
    if source.version != source_data.version:
        raise HTTPException(
            status_code=409,
            detail="数据已被其他用户修改，请刷新后重试"
        )
    
    old_value = _source_to_dict(source)
    
    if source_data.name is not None:
        source.name = source_data.name
    if source_data.source_type is not None:
        source.source_type = source_data.source_type.value
    if source_data.config is not None:
        source.config = source_data.config
    if source_data.description is not None:
        source.description = source_data.description
    if source_data.is_active is not None:
        source.is_active = source_data.is_active
    
    source.version += 1
    
    try:
        db.commit()
        db.refresh(source)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="更新失败，数据可能已被修改"
        )
    
    AuditService.log_action(
        db=db,
        action="update",
        resource_type="log_source",
        resource_id=str(source.id),
        old_value=old_value,
        new_value=_source_to_dict(source),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return source


@router.delete("/{source_id}")
def delete_source(
    source_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    source = db.query(LogSource).filter(LogSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="日志源不存在")
    
    old_value = _source_to_dict(source)
    
    db.delete(source)
    db.commit()
    
    AuditService.log_action(
        db=db,
        action="delete",
        resource_type="log_source",
        resource_id=str(source_id),
        old_value=old_value,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return {"message": "删除成功"}


@router.post("/{source_id}/collect", response_model=dict)
def trigger_collection(
    source_id: int,
    db: Session = Depends(get_db)
):
    source = db.query(LogSource).filter(LogSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="日志源不存在")
    
    if not source.is_active:
        raise HTTPException(status_code=400, detail="日志源未激活")
    
    candidate_tasks = db.query(Task).filter(
        Task.task_type == "collect_logs",
        Task.status.in_(["pending", "running", "retrying"])
    ).all()
    
    existing_task = None
    for task in candidate_tasks:
        if task.data and task.data.get("source_id") == source_id:
            existing_task = task
            break
    
    if existing_task:
        return {
            "message": "已有正在执行的采集任务",
            "task_id": existing_task.id
        }
    
    task = TaskService.create_task(
        db=db,
        task_type="collect_logs",
        data={"source_id": source_id}
    )
    
    return {
        "message": "采集任务已创建",
        "task_id": task.id
    }
