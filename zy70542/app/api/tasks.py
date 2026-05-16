from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas.task import (
    TaskCreate, TaskResponse, TaskDetailResponse, ShardResponse,
    TaskProgressUpdate, FailureRecordCreate, FailureRecordResponse,
    ManualFixRequest, ResumeReportResponse, TaskResumeRequest
)
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskResponse, status_code=201)
def create_task(task_data: TaskCreate, db: Session = Depends(get_db)):
    try:
        return TaskService.create_task(db, task_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{task_id}", response_model=TaskDetailResponse)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = TaskService.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    shards = TaskService.get_task_shards(db, task_id)
    failures = TaskService.get_task_failures(db, task_id)
    
    return {
        **task.__dict__,
        "shards": shards,
        "failure_count": len(failures)
    }


@router.get("/{task_id}/shards", response_model=List[ShardResponse])
def get_task_shards(task_id: str, db: Session = Depends(get_db)):
    task = TaskService.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return TaskService.get_task_shards(db, task_id)


@router.post("/{task_id}/start", response_model=TaskResponse)
def start_task(task_id: str, db: Session = Depends(get_db)):
    try:
        return TaskService.start_task(db, task_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{task_id}/progress", response_model=List[ShardResponse])
def update_progress(task_id: str, progress_data: TaskProgressUpdate, db: Session = Depends(get_db)):
    task = TaskService.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    updated_shards = []
    for shard_update in progress_data.shards:
        try:
            shard = TaskService.update_shard_progress(db, task_id, shard_update)
            updated_shards.append(shard)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    if progress_data.watermark is not None:
        try:
            TaskService.update_watermark(db, task_id, progress_data.watermark)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    return updated_shards


@router.post("/{task_id}/failures", response_model=FailureRecordResponse, status_code=201)
def record_failure(task_id: str, failure_data: FailureRecordCreate, db: Session = Depends(get_db)):
    try:
        return TaskService.record_failure(db, task_id, failure_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{task_id}/failures", response_model=List[FailureRecordResponse])
def get_failures(task_id: str, shard_no: int = None, db: Session = Depends(get_db)):
    task = TaskService.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return TaskService.get_task_failures(db, task_id, shard_no)


@router.post("/{task_id}/manual-fix", response_model=FailureRecordResponse)
def manual_fix(task_id: str, fix_data: ManualFixRequest, db: Session = Depends(get_db)):
    try:
        return TaskService.manual_fix(db, task_id, fix_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{task_id}/resume", response_model=ResumeReportResponse)
def resume_task(task_id: str, resume_data: TaskResumeRequest, db: Session = Depends(get_db)):
    try:
        return TaskService.resume_task(db, task_id, resume_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{task_id}/resume-reports", response_model=List[ResumeReportResponse])
def get_resume_reports(task_id: str, db: Session = Depends(get_db)):
    task = TaskService.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return TaskService.get_resume_reports(db, task_id)


@router.post("/{task_id}/shards/{shard_no}/complete", response_model=ShardResponse)
def complete_shard(task_id: str, shard_no: int, db: Session = Depends(get_db)):
    try:
        return TaskService.complete_shard(db, task_id, shard_no)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{task_id}/export")
def export_task(task_id: str, db: Session = Depends(get_db)):
    try:
        return TaskService.export_task_data(db, task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
