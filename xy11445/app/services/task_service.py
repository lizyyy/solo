import uuid
from datetime import datetime, timedelta
from typing import Optional, Callable, Dict, Any, List
from sqlalchemy.orm import Session

from app.models.enums import TaskStatus, TaskType
from app.models.database import AsyncTask
from app.config import settings


class TaskService:
    def __init__(self, db: Session):
        self.db = db

    def create_task(
        self,
        task_type: TaskType,
        params: Dict[str, Any] = None,
        batch_id: str = None,
        work_order_id: str = None,
        max_retry: int = None,
    ) -> AsyncTask:
        task = AsyncTask(
            id=str(uuid.uuid4()),
            task_type=task_type.value if hasattr(task_type, 'value') else task_type,
            status=TaskStatus.PENDING.value,
            batch_id=batch_id,
            work_order_id=work_order_id,
            retry_count=0,
            max_retry=max_retry or settings.MAX_RETRY_COUNT,
            params=params or {},
            next_run_time=datetime.utcnow(),
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def get_task(self, task_id: str) -> Optional[AsyncTask]:
        return self.db.query(AsyncTask).filter(AsyncTask.id == task_id).first()

    def get_pending_tasks(self, limit: int = 10) -> List[AsyncTask]:
        now = datetime.utcnow()
        return (
            self.db.query(AsyncTask)
            .filter(
                AsyncTask.status.in_([
                    TaskStatus.PENDING.value,
                    TaskStatus.WAITING_RETRY.value,
                ]),
                AsyncTask.next_run_time <= now,
            )
            .order_by(AsyncTask.next_run_time.asc())
            .limit(limit)
            .all()
        )

    def get_manual_tasks(self, skip: int = 0, limit: int = 100) -> List[AsyncTask]:
        return (
            self.db.query(AsyncTask)
            .filter(AsyncTask.status == TaskStatus.WAITING_MANUAL.value)
            .order_by(AsyncTask.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def start_task(self, task_id: str) -> bool:
        task = self.get_task(task_id)
        if not task:
            return False
        task.status = TaskStatus.RUNNING.value
        task.started_at = datetime.utcnow()
        self.db.commit()
        return True

    def complete_task(self, task_id: str, result: Dict[str, Any] = None) -> bool:
        task = self.get_task(task_id)
        if not task:
            return False
        task.status = TaskStatus.COMPLETED.value
        task.completed_at = datetime.utcnow()
        task.result = result or {}
        self.db.commit()
        return True

    def fail_task(
        self,
        task_id: str,
        error: str,
        require_manual: bool = False,
    ) -> bool:
        task = self.get_task(task_id)
        if not task:
            return False

        task.last_error = error
        task.retry_count += 1

        if require_manual:
            task.status = TaskStatus.WAITING_MANUAL.value
        elif task.retry_count >= task.max_retry:
            task.status = TaskStatus.PERMANENT_FAILED.value
        else:
            task.status = TaskStatus.WAITING_RETRY.value
            task.next_run_time = datetime.utcnow() + timedelta(
                seconds=settings.RETRY_INTERVAL_SECONDS
            )

        self.db.commit()
        return True

    def retry_manual_task(self, task_id: str) -> bool:
        task = self.get_task(task_id)
        if not task or task.status != TaskStatus.WAITING_MANUAL.value:
            return False
        task.status = TaskStatus.PENDING.value
        task.retry_count = 0
        task.next_run_time = datetime.utcnow()
        self.db.commit()
        return True

    def cancel_task(self, task_id: str) -> bool:
        task = self.get_task(task_id)
        if not task:
            return False
        task.status = TaskStatus.PERMANENT_FAILED.value
        task.last_error = "手动取消"
        self.db.commit()
        return True


class TaskExecutor:
    def __init__(self, db: Session):
        self.db = db
        self.task_service = TaskService(db)
        self._handlers: Dict[str, Callable] = {}

    def register_handler(self, task_type: TaskType, handler: Callable):
        self._handlers[task_type.value if hasattr(task_type, 'value') else task_type] = handler

    def execute_task(self, task_id: str) -> bool:
        task = self.task_service.get_task(task_id)
        if not task:
            return False

        handler = self._handlers.get(task.task_type)
        if not handler:
            self.task_service.fail_task(task_id, f"未找到任务处理器: {task.task_type}", require_manual=True)
            return False

        self.task_service.start_task(task_id)

        try:
            result = handler(task.params, self.db)
            self.task_service.complete_task(task_id, result)
            return True
        except Exception as e:
            require_manual = self._is_permanent_error(e)
            self.task_service.fail_task(task_id, str(e), require_manual=require_manual)
            return False

    def _is_permanent_error(self, error: Exception) -> bool:
        permanent_errors = [
            "数据不存在",
            "权限不足",
            "参数错误",
            "格式错误",
        ]
        error_str = str(error)
        return any(pe in error_str for pe in permanent_errors)

    def run_pending_tasks(self, limit: int = 10) -> int:
        tasks = self.task_service.get_pending_tasks(limit)
        success_count = 0
        for task in tasks:
            if self.execute_task(task.id):
                success_count += 1
        return success_count
