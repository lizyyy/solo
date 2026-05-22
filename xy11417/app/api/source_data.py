import uuid
import hashlib
import json
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_active_user, RoleChecker, filter_fields_by_role
from app.core.config import UserRole, TaskStatus, SourceType
from app.models import User, SourceData, RepairTask, ProcessLog
from app.schemas import SourceDataSubmit, SourceDataResponse
from app.services.task_processor import TaskProcessor

router = APIRouter()
task_processor = TaskProcessor()

@router.post("/submit", response_model=dict)
async def submit_source_data(
    data_in: SourceDataSubmit,
    request: Request,
    current_user: User = Depends(RoleChecker([UserRole.DATA_ENTRY, UserRole.REVIEWER, UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    data_dict = data_in.model_dump(exclude={"auto_process"})
    data_hash = hashlib.sha256(
        json.dumps(data_dict, sort_keys=True).encode()
    ).hexdigest()
    
    existing = db.query(SourceData).filter(
        SourceData.source_type == data_in.source_type,
        SourceData.source_id == data_in.source_id,
        SourceData.data_hash == data_hash
    ).first()
    
    if existing:
        return {
            "message": "Duplicate data detected, skipped",
            "source_data_id": existing.id,
            "is_duplicate": True
        }
    
    source_data = SourceData(**data_dict, data_hash=data_hash, created_by=current_user.id)
    
    is_valid, errors = task_processor.validate_source_data(source_data)
    source_data.is_valid = is_valid
    source_data.validation_errors = errors if not is_valid else None
    
    db.add(source_data)
    db.flush()
    
    task_id = f"TASK-{uuid.uuid4().hex[:12].upper()}"
    task = RepairTask(
        task_id=task_id,
        source_data_id=source_data.id,
        status=TaskStatus.PENDING.value if is_valid else TaskStatus.FAILED.value,
        manual_review_required=not is_valid
    )
    db.add(task)
    
    log = ProcessLog(
        task_id=task_id,
        action="source_submitted",
        details={
            "source_type": data_in.source_type,
            "source_id": data_in.source_id,
            "is_valid": is_valid,
            "validation_errors": errors
        },
        performed_by=current_user.id,
        ip_address=request.client.host if request.client else None
    )
    db.add(log)
    
    db.commit()
    
    if data_in.auto_process and is_valid:
        from main import queue_manager
        await queue_manager.task_queue.put(task_id)
    
    return {
        "message": "Source data submitted successfully",
        "source_data_id": source_data.id,
        "task_id": task_id,
        "is_valid": is_valid,
        "validation_errors": errors
    }

@router.get("/", response_model=list[SourceDataResponse])
def list_source_data(
    skip: int = 0,
    limit: int = 100,
    source_type: SourceType = None,
    is_valid: bool = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(SourceData)
    
    if source_type:
        query = query.filter(SourceData.source_type == source_type)
    if is_valid is not None:
        query = query.filter(SourceData.is_valid == is_valid)
    
    sources = query.order_by(SourceData.created_at.desc()).offset(skip).limit(limit).all()
    
    return sources

@router.get("/{source_id}", response_model=SourceDataResponse)
def get_source_data(
    source_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    source_data = db.query(SourceData).filter(SourceData.id == source_id).first()
    if not source_data:
        raise HTTPException(status_code=404, detail="Source data not found")
    return source_data

@router.put("/{source_id}/revalidate")
def revalidate_source_data(
    source_id: int,
    current_user: User = Depends(RoleChecker([UserRole.REVIEWER, UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    source_data = db.query(SourceData).filter(SourceData.id == source_id).first()
    if not source_data:
        raise HTTPException(status_code=404, detail="Source data not found")
    
    is_valid, errors = task_processor.validate_source_data(source_data)
    source_data.is_valid = is_valid
    source_data.validation_errors = errors if not is_valid else None
    
    if is_valid:
        task = db.query(RepairTask).filter(RepairTask.source_data_id == source_id).first()
        if task and task.status == TaskStatus.FAILED.value:
            task.status = TaskStatus.PENDING.value
            task.manual_review_required = False
            task.retry_count = 0
    
    db.commit()
    
    return {
        "message": "Revalidation complete",
        "is_valid": is_valid,
        "validation_errors": errors
    }
