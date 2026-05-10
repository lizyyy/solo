from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Callable
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.task import BackgroundTask, TaskStatus
from app.schemas.task import BackgroundTaskCreate
from app.config import get_settings


class TaskService:
    """后台任务服务"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()

    async def create_task(
        self,
        task_data: BackgroundTaskCreate,
    ) -> BackgroundTask:
        """创建后台任务"""
        task = BackgroundTask(
            task_type=task_data.task_type,
            task_key=task_data.task_key,
            priority=task_data.priority,
            parameters=task_data.parameters,
            max_retries=task_data.max_retries,
            scheduled_at=task_data.scheduled_at,
            created_by=task_data.created_by,
            status=TaskStatus.PENDING.value,
        )
        self.db.add(task)
        await self.db.flush()
        return task

    async def get_task(self, task_id: int) -> Optional[BackgroundTask]:
        """获取任务"""
        result = await self.db.execute(
            select(BackgroundTask).where(BackgroundTask.id == task_id)
        )
        return result.scalar_one_or_none()

    async def list_tasks(
        self,
        task_type: Optional[str] = None,
        status: Optional[str] = None,
        task_key: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[BackgroundTask]:
        """列出任务"""
        conditions = []
        if task_type:
            conditions.append(BackgroundTask.task_type == task_type)
        if status:
            conditions.append(BackgroundTask.status == status)
        if task_key:
            conditions.append(BackgroundTask.task_key == task_key)

        stmt = select(BackgroundTask)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(
            BackgroundTask.priority.desc(),
            BackgroundTask.created_at.asc(),
        ).limit(limit).offset(offset)

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_next_pending_task(
        self,
        task_type: Optional[str] = None,
    ) -> Optional[BackgroundTask]:
        """获取下一个待处理任务"""
        now = datetime.utcnow()
        conditions = [
            BackgroundTask.status == TaskStatus.PENDING.value,
            (BackgroundTask.scheduled_at.is_(None) | (BackgroundTask.scheduled_at <= now)),
        ]
        if task_type:
            conditions.append(BackgroundTask.task_type == task_type)

        stmt = select(BackgroundTask).where(and_(*conditions)).order_by(
            BackgroundTask.priority.desc(),
            BackgroundTask.created_at.asc(),
        ).limit(1)

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def start_task(self, task_id: int) -> Optional[BackgroundTask]:
        """开始执行任务"""
        task = await self.get_task(task_id)
        if not task:
            return None

        task.status = TaskStatus.RUNNING.value
        task.started_at = datetime.utcnow()
        task.progress_percent = 0
        await self.db.flush()
        return task

    async def update_progress(
        self,
        task_id: int,
        progress_percent: int,
        progress_message: Optional[str] = None,
    ) -> Optional[BackgroundTask]:
        """更新任务进度"""
        task = await self.get_task(task_id)
        if not task:
            return None

        task.progress_percent = max(0, min(100, progress_percent))
        if progress_message:
            task.progress_message = progress_message
        await self.db.flush()
        return task

    async def complete_task(
        self,
        task_id: int,
        result: Optional[Dict[str, Any]] = None,
    ) -> Optional[BackgroundTask]:
        """完成任务"""
        task = await self.get_task(task_id)
        if not task:
            return None

        task.status = TaskStatus.COMPLETED.value
        task.progress_percent = 100
        task.completed_at = datetime.utcnow()
        if result:
            task.result = result
        await self.db.flush()
        return task

    async def fail_task(
        self,
        task_id: int,
        error_message: str,
        error_stacktrace: Optional[str] = None,
        can_retry: bool = True,
    ) -> Optional[BackgroundTask]:
        """任务失败处理（含重试逻辑）"""
        task = await self.get_task(task_id)
        if not task:
            return None

        task.last_error_at = datetime.utcnow()
        task.error_message = error_message
        task.error_stacktrace = error_stacktrace
        task.retry_count += 1

        if can_retry and task.retry_count < task.max_retries:
            task.status = TaskStatus.PENDING.value
            task.next_retry_at = datetime.utcnow() + timedelta(
                seconds=self.settings.retry_delay_seconds * (2 ** (task.retry_count - 1))
            )
            task.progress_message = f"准备第 {task.retry_count + 1} 次重试"
        else:
            task.status = TaskStatus.FAILED.value
            task.progress_message = "任务失败，已达到最大重试次数"

        await self.db.flush()
        return task

    async def cancel_task(
        self,
        task_id: int,
        cancelled_by: Optional[str] = None,
    ) -> Optional[BackgroundTask]:
        """取消任务"""
        task = await self.get_task(task_id)
        if not task:
            return None

        task.status = TaskStatus.CANCELLED.value
        task.cancelled_at = datetime.utcnow()
        task.cancelled_by = cancelled_by
        task.progress_message = "任务已取消"
        await self.db.flush()
        return task

    async def get_retryable_tasks(self) -> List[BackgroundTask]:
        """获取可重试的任务"""
        now = datetime.utcnow()
        stmt = select(BackgroundTask).where(
            and_(
                BackgroundTask.status == TaskStatus.PENDING.value,
                BackgroundTask.next_retry_at.is_not(None),
                BackgroundTask.next_retry_at <= now,
            )
        ).order_by(BackgroundTask.next_retry_at.asc())

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_task_statistics(self) -> Dict[str, Any]:
        """获取任务统计"""
        stats = {}

        for status in TaskStatus:
            stmt = select(BackgroundTask.id).where(BackgroundTask.status == status.value)
            result = await self.db.execute(stmt)
            stats[status.value] = len(result.scalars().all())

        return stats
