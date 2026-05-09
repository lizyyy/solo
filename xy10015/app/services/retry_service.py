import time
import traceback
from datetime import datetime, timedelta
from typing import Callable, Any, Optional
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.audit import FailedTask

settings = get_settings()


class RetryContext:
    def __init__(self, db: Session, task_name: str, task_type: str, reference_type: str = None, reference_id: int = None):
        self.db = db
        self.task_name = task_name
        self.task_type = task_type
        self.reference_type = reference_type
        self.reference_id = reference_id
        self.failed_task: Optional[FailedTask] = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self._record_failure(exc_type, exc_val, exc_tb)
        return False

    def _record_failure(self, exc_type, exc_val, exc_tb):
        error_msg = f"{exc_type.__name__}: {str(exc_val)}"
        tb_str = "".join(traceback.format_exception(exc_type, exc_val, exc_tb)) if exc_tb else None

        if not self.failed_task:
            self.failed_task = FailedTask(
                task_name=self.task_name,
                task_type=self.task_type,
                reference_type=self.reference_type,
                reference_id=self.reference_id,
                status="failed",
                retry_count=0,
                max_retries=settings.MAX_RETRY_COUNT,
                last_error=error_msg,
                last_failed_at=datetime.utcnow(),
                next_retry_at=datetime.utcnow() + timedelta(seconds=settings.RETRY_DELAY_SECONDS),
                payload={"error": error_msg},
                traceback=tb_str
            )
            self.db.add(self.failed_task)
        else:
            self.failed_task.retry_count += 1
            self.failed_task.last_error = error_msg
            self.failed_task.last_failed_at=datetime.utcnow()
            if self.failed_task.retry_count >= self.failed_task.max_retries:
                self.failed_task.status = "failed_permanently"
                self.failed_task.next_retry_at = None
            else:
                delay = settings.RETRY_DELAY_SECONDS * (2 ** self.failed_task.retry_count)
                self.failed_task.next_retry_at = datetime.utcnow() + timedelta(seconds=delay)
            self.failed_task.traceback = tb_str
        self.db.commit()


def with_retry(
    func: Callable,
    db: Session,
    task_name: str,
    task_type: str,
    reference_type: str = None,
    reference_id: int = None,
    max_retries: int = None,
    *args, **kwargs
) -> Any:
    max_retries = max_retries or settings.MAX_RETRY_COUNT
    last_exception = None

    for attempt in range(max_retries + 1):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            last_exception = e
            if attempt < max_retries:
                time.sleep(settings.RETRY_DELAY_SECONDS * (2 ** attempt))
            else:
                break

    with RetryContext(db, task_name, task_type, reference_type, reference_id) as ctx:
        raise last_exception


def get_failed_tasks_for_retry(db: Session) -> list:
    now = datetime.utcnow()
    return db.query(FailedTask).filter(
        FailedTask.status == "failed",
        FailedTask.retry_count < FailedTask.max_retries,
        FailedTask.next_retry_at <= now
    ).order_by(FailedTask.next_retry_at).all()


def mark_task_success(db: Session, task_id: int) -> None:
    task = db.query(FailedTask).filter(FailedTask.id == task_id).first()
    if task:
        task.status = "completed"
        task.next_retry_at = None
        db.commit()


def manual_retry_task(db: Session, task_id: int) -> bool:
    task = db.query(FailedTask).filter(FailedTask.id == task_id).first()
    if not task:
        return False

    task.status = "failed"
    task.next_retry_at = datetime.utcnow()
    db.commit()
    return True
