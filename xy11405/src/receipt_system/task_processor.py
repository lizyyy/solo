import uuid
import traceback
from datetime import datetime, timedelta
from typing import Callable, Dict, Any, Optional
from sqlalchemy.orm import Session
from .models import AsyncTask, TaskStatus, Batch
from .config import settings
from .database import get_db_session


class TaskProcessor:
    def __init__(self):
        self.task_handlers: Dict[str, Callable] = {}

    def register_handler(self, task_type: str, handler: Callable):
        self.task_handlers[task_type] = handler

    def create_task(
        self,
        db: Session,
        task_type: str,
        payload: Optional[Dict[str, Any]] = None,
        batch_id: Optional[str] = None,
        max_retries: int = settings.MAX_RETRY_COUNT
    ) -> AsyncTask:
        task = AsyncTask(
            id=str(uuid.uuid4()),
            batch_id=batch_id,
            task_type=task_type,
            status=TaskStatus.PENDING,
            retry_count=0,
            max_retries=max_retries,
            payload=payload or {}
        )
        db.add(task)
        db.flush()
        return task

    def process_task(self, task: AsyncTask) -> bool:
        handler = self.task_handlers.get(task.task_type)
        if not handler:
            self._handle_manual_fail(task, f"未找到任务处理器: {task.task_type}")
            return False

        try:
            task.started_at = datetime.now()
            result = handler(task.payload)
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.now()
            task.result_data = result
            return True
        except Exception as e:
            task.retry_count += 1
            task.error_message = str(e)
            task.error_stacktrace = traceback.format_exc()

            if self._is_retryable_error(e):
                if task.retry_count >= task.max_retries:
                    task.status = TaskStatus.WAITING_MANUAL
                else:
                    task.status = TaskStatus.WAITING_RETRY
                    task.next_retry_at = datetime.now() + timedelta(seconds=settings.RETRY_DELAY_SECONDS)
            else:
                task.status = TaskStatus.PERMANENT_FAILED

            return False

    def _is_retryable_error(self, error: Exception) -> bool:
        retryable_errors = (
            ConnectionError,
            TimeoutError,
        )
        return isinstance(error, retryable_errors)

    def _handle_manual_fail(self, task: AsyncTask, error_message: str):
        task.status = TaskStatus.PERMANENT_FAILED
        task.error_message = error_message

    def get_pending_tasks(self, db: Session) -> list:
        return db.query(AsyncTask).filter(
            AsyncTask.status.in_([TaskStatus.PENDING, TaskStatus.WAITING_RETRY])
        ).all()

    def get_manual_tasks(self, db: Session) -> list:
        return db.query(AsyncTask).filter(
            AsyncTask.status == TaskStatus.WAITING_MANUAL
        ).all()

    def retry_manual_task(self, db: Session, task_id: str, actor: str) -> AsyncTask:
        task = db.query(AsyncTask).filter(AsyncTask.id == task_id).first()
        if not task:
            raise ValueError(f"任务不存在: {task_id}")

        task.status = TaskStatus.PENDING
        task.retry_count = 0
        task.error_message = None
        task.error_stacktrace = None
        task.result_data = {
            **(task.result_data or {}),
            "manual_retried_by": actor,
            "manual_retried_at": datetime.now().isoformat()
        }

        return task

    def run_forever(self):
        import time
        while True:
            with get_db_session() as db:
                tasks = self.get_pending_tasks(db)
                for task in tasks:
                    if task.status == TaskStatus.WAITING_RETRY:
                        if task.next_retry_at and task.next_retry_at > datetime.now():
                            continue
                        task.status = TaskStatus.PENDING
                    self.process_task(task)
            time.sleep(settings.RETRY_DELAY_SECONDS)


task_processor = TaskProcessor()


def export_batch_import_handler(payload: Dict[str, Any]) -> Dict[str, Any]:
    return {"status": "completed", "exported_at": datetime.now().isoformat()}


task_processor.register_handler("export_batch", export_batch_import_handler)
