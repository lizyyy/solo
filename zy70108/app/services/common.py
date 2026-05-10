import json
import secrets
import string
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.models import (
    TraceabilityCode, Batch, InspectionReport, CodeBatchBinding, ScanLog,
    ExceptionRecord, PendingTask, BackgroundJob, CodeStatus, BindingStatus,
    ExceptionType, TaskType, TaskStatus
)


def generate_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return 'TS' + ''.join(secrets.choice(chars) for _ in range(12))


def log_exception(db: Session, exception_type: ExceptionType, operation: str,
                  error_message: str, data: Optional[dict] = None) -> ExceptionRecord:
    record = ExceptionRecord(
        exception_type=exception_type.value,
        operation=operation,
        data=json.dumps(data, ensure_ascii=False) if data else None,
        error_message=error_message,
        resolved=False
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def create_pending_task(db: Session, task_type: TaskType, title: str,
                        description: Optional[str] = None,
                        data: Optional[dict] = None,
                        assigned_to: Optional[str] = None) -> PendingTask:
    task = PendingTask(
        task_type=task_type.value,
        title=title,
        description=description,
        data=json.dumps(data, ensure_ascii=False) if data else None,
        assigned_to=assigned_to,
        completed=False
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def create_background_job(db: Session, job_type: str,
                          data: Optional[dict] = None,
                          max_retries: int = 3) -> BackgroundJob:
    job = BackgroundJob(
        job_type=job_type,
        status=TaskStatus.PENDING,
        data=json.dumps(data, ensure_ascii=False) if data else None,
        retry_count=0,
        max_retries=max_retries
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job
