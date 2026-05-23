from typing import Optional, List, Tuple, Dict, Any, Callable
from datetime import datetime, timedelta
import traceback
import asyncio
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from ..models import (
    AsyncTask,
    TaskStatus,
    TaskType,
    Batch,
)
from ..config import settings
from .batch_service import BatchService


class TaskService:
    @staticmethod
    def create_task(
        db: Session,
        task_type: TaskType,
        batch_id: Optional[int] = None,
        parameters: Optional[Dict] = None,
        priority: int = 0,
        max_retries: int = 3,
        created_by: Optional[str] = None,
    ) -> AsyncTask:
        task = AsyncTask(
            batch_id=batch_id,
            task_type=task_type.value,
            status=TaskStatus.PENDING.value,
            priority=priority,
            max_retries=max_retries,
            parameters=parameters or {},
            created_by=created_by,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def get_task(
        db: Session,
        task_id: int,
    ) -> Optional[AsyncTask]:
        return db.query(AsyncTask).filter(AsyncTask.id == task_id).first()

    @staticmethod
    def list_tasks(
        db: Session,
        status: Optional[TaskStatus] = None,
        task_type: Optional[TaskType] = None,
        batch_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[AsyncTask], int]:
        query = db.query(AsyncTask)

        if status:
            query = query.filter(AsyncTask.status == status.value)
        if task_type:
            query = query.filter(AsyncTask.task_type == task_type.value)
        if batch_id:
            query = query.filter(AsyncTask.batch_id == batch_id)

        total = query.count()
        tasks = (
            query.order_by(AsyncTask.priority.desc(), AsyncTask.created_at)
            .offset(skip)
            .limit(limit)
            .all()
        )

        return tasks, total

    @staticmethod
    def get_next_pending_task(
        db: Session,
    ) -> Optional[AsyncTask]:
        now = datetime.utcnow()
        task = (
            db.query(AsyncTask)
            .filter(
                or_(
                    AsyncTask.status == TaskStatus.PENDING.value,
                    and_(
                        AsyncTask.status == TaskStatus.WAITING_RETRY.value,
                        AsyncTask.next_retry_at <= now,
                    ),
                )
            )
            .order_by(AsyncTask.priority.desc(), AsyncTask.created_at)
            .first()
        )
        return task

    @staticmethod
    def start_task(
        db: Session,
        task_id: int,
    ) -> Optional[AsyncTask]:
        task = TaskService.get_task(db, task_id)
        if not task:
            return None

        task.status = TaskStatus.RUNNING.value
        task.started_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def complete_task(
        db: Session,
        task_id: int,
        result: Optional[Dict] = None,
    ) -> Optional[AsyncTask]:
        task = TaskService.get_task(db, task_id)
        if not task:
            return None

        task.status = TaskStatus.SUCCESS.value
        task.completed_at = datetime.utcnow()
        task.result = result or {}
        task.last_error = None
        task.error_traceback = None
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def fail_task(
        db: Session,
        task_id: int,
        error: str,
        error_traceback: Optional[str] = None,
    ) -> Optional[AsyncTask]:
        task = TaskService.get_task(db, task_id)
        if not task:
            return None

        task.retry_count += 1
        task.last_error = error
        task.error_traceback = error_traceback

        if task.retry_count >= task.max_retries:
            task.status = TaskStatus.WAITING_MANUAL.value
            task.next_retry_at = None
        else:
            task.status = TaskStatus.WAITING_RETRY.value
            task.next_retry_at = datetime.utcnow() + timedelta(
                seconds=settings.RETRY_INTERVAL
            )

        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def mark_permanently_failed(
        db: Session,
        task_id: int,
        marked_by: str,
        reason: str,
    ) -> Optional[AsyncTask]:
        task = TaskService.get_task(db, task_id)
        if not task:
            return None

        task.status = TaskStatus.FAILED_PERMANENTLY.value
        task.result = {
            "marked_by": marked_by,
            "reason": reason,
            "marked_at": datetime.utcnow().isoformat(),
        }
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def manual_retry(
        db: Session,
        task_id: int,
        retried_by: str,
        comment: Optional[str] = None,
    ) -> Optional[AsyncTask]:
        task = TaskService.get_task(db, task_id)
        if not task:
            return None

        task.status = TaskStatus.PENDING.value
        task.retry_count = 0
        task.next_retry_at = None
        task.result = {
            "manual_retry_by": retried_by,
            "comment": comment,
            "retried_at": datetime.utcnow().isoformat(),
        }
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def manual_resolve(
        db: Session,
        task_id: int,
        resolved_by: str,
        resolution: str,
        result: Optional[Dict] = None,
    ) -> Optional[AsyncTask]:
        task = TaskService.get_task(db, task_id)
        if not task:
            return None

        task.status = TaskStatus.SUCCESS.value
        task.completed_at = datetime.utcnow()
        task.result = {
            **(result or {}),
            "manual_resolved_by": resolved_by,
            "resolution": resolution,
            "resolved_at": datetime.utcnow().isoformat(),
        }
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def recover_tasks_on_startup(db: Session) -> int:
        running_tasks = db.query(AsyncTask).filter(
            AsyncTask.status == TaskStatus.RUNNING.value
        )
        count = running_tasks.count()

        for task in running_tasks.all():
            task.status = TaskStatus.PENDING.value
            task.started_at = None

        db.commit()
        return count


class TaskExecutor:
    def __init__(self, db: Session):
        self.db = db
        self.handlers: Dict[TaskType, Callable] = {}

    def register_handler(self, task_type: TaskType, handler: Callable):
        self.handlers[task_type] = handler

    async def execute_task(self, task: AsyncTask) -> bool:
        task_type = TaskType(task.task_type)
        handler = self.handlers.get(task_type)

        if not handler:
            TaskService.fail_task(
                self.db,
                task.id,
                f"No handler registered for task type: {task_type}",
            )
            return False

        try:
            TaskService.start_task(self.db, task.id)
            result = await handler(task.parameters, task.batch_id)
            TaskService.complete_task(self.db, task.id, result)
            return True
        except Exception as e:
            error_msg = str(e)
            error_tb = traceback.format_exc()
            TaskService.fail_task(self.db, task.id, error_msg, error_tb)
            return False

    async def run_forever(self):
        while True:
            task = TaskService.get_next_pending_task(self.db)
            if task:
                await self.execute_task(task)
            else:
                await asyncio.sleep(1)
