import uuid
import traceback
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Callable
from sqlalchemy.orm import Session
from app.models import AsyncTask, TaskStatus
from app.config import settings
from loguru import logger


class TaskService:
    def __init__(self, db: Session):
        self.db = db
        self._task_handlers: Dict[str, Callable] = {}

    def _generate_task_id(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4())[:8].upper()
        return f"TASK-{timestamp}-{unique_id}"

    def register_handler(self, task_type: str, handler: Callable):
        self._task_handlers[task_type] = handler

    def create_task(
        self,
        task_type: str,
        task_params: Dict[str, Any],
        created_by: str,
        max_retry_count: int = settings.MAX_RETRY_COUNT
    ) -> AsyncTask:
        task_id = self._generate_task_id()
        
        task = AsyncTask(
            task_id=task_id,
            task_type=task_type,
            status=TaskStatus.PENDING.value,
            retry_count=0,
            max_retry_count=max_retry_count,
            task_params=task_params,
            created_by=created_by
        )
        
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        
        logger.info(f"创建异步任务: {task_id}, 类型: {task_type}")
        
        return task

    def execute_task(self, task_id: str) -> AsyncTask:
        task = self.db.query(AsyncTask).filter(
            AsyncTask.task_id == task_id
        ).first()
        
        if not task:
            raise ValueError(f"任务不存在: {task_id}")
        
        if task.status not in [
            TaskStatus.PENDING.value,
            TaskStatus.WAIT_RETRY.value
        ]:
            raise ValueError(f"任务状态不允许执行: {task.status}")
        
        task.status = TaskStatus.PROCESSING.value
        task.started_at = datetime.now()
        task.retry_count += 1
        self.db.commit()
        
        try:
            handler = self._task_handlers.get(task.task_type)
            if not handler:
                raise ValueError(f"未注册任务处理器: {task.task_type}")
            
            result = handler(task.task_params or {})
            
            task.status = TaskStatus.COMPLETED.value
            task.task_result = result
            task.completed_at = datetime.now()
            
            logger.info(f"任务执行成功: {task_id}")
            
        except Exception as e:
            error_msg = str(e)
            error_stack = traceback.format_exc()
            
            task.error_message = error_msg
            task.error_stack = error_stack
            
            if task.retry_count >= task.max_retry_count:
                task.status = TaskStatus.FAILED_PERMANENT.value
                task.completed_at = datetime.now()
                logger.error(f"任务永久失败: {task_id}, 错误: {error_msg}")
            else:
                task.status = TaskStatus.WAIT_RETRY.value
                task.next_retry_time = datetime.now() + timedelta(
                    seconds=settings.RETRY_DELAY_SECONDS
                )
                logger.warning(f"任务执行失败，等待重试: {task_id}, 重试次数: {task.retry_count}/{task.max_retry_count}")
        
        self.db.commit()
        
        return task

    def mark_for_manual(self, task_id: str, reason: str) -> AsyncTask:
        task = self.db.query(AsyncTask).filter(
            AsyncTask.task_id == task_id
        ).first()
        
        if not task:
            raise ValueError(f"任务不存在: {task_id}")
        
        task.status = TaskStatus.WAIT_MANUAL.value
        task.error_message = (task.error_message or "") + f"\n[转人工处理] {reason}"
        
        self.db.commit()
        
        logger.info(f"任务转人工处理: {task_id}, 原因: {reason}")
        
        return task

    def retry_task(self, task_id: str) -> AsyncTask:
        task = self.db.query(AsyncTask).filter(
            AsyncTask.task_id == task_id
        ).first()
        
        if not task:
            raise ValueError(f"任务不存在: {task_id}")
        
        if task.status not in [
            TaskStatus.WAIT_RETRY.value,
            TaskStatus.WAIT_MANUAL.value,
            TaskStatus.FAILED_PERMANENT.value
        ]:
            raise ValueError(f"任务状态不允许重试: {task.status}")
        
        task.status = TaskStatus.PENDING.value
        task.started_at = None
        task.completed_at = None
        task.error_message = None
        task.error_stack = None
        
        self.db.commit()
        
        logger.info(f"任务标记为重试: {task_id}")
        
        return task

    def get_pending_tasks(self) -> list:
        now = datetime.now()
        
        tasks = self.db.query(AsyncTask).filter(
            AsyncTask.status.in_([
                TaskStatus.PENDING.value,
                TaskStatus.WAIT_RETRY.value
            ])
        ).all()
        
        ready_tasks = []
        for task in tasks:
            if task.status == TaskStatus.PENDING.value:
                ready_tasks.append(task)
            elif task.status == TaskStatus.WAIT_RETRY.value:
                if task.next_retry_time and task.next_retry_time <= now:
                    ready_tasks.append(task)
        
        return ready_tasks

    def process_pending_tasks(self) -> Dict[str, int]:
        result = {
            "processed": 0,
            "success": 0,
            "failed": 0
        }
        
        tasks = self.get_pending_tasks()
        
        for task in tasks:
            result["processed"] += 1
            try:
                executed_task = self.execute_task(task.task_id)
                if executed_task.status == TaskStatus.COMPLETED.value:
                    result["success"] += 1
                else:
                    result["failed"] += 1
            except Exception as e:
                result["failed"] += 1
                logger.error(f"处理任务失败 {task.task_id}: {str(e)}")
        
        logger.info(f"批量处理任务完成: 共 {result['processed']} 个, 成功 {result['success']} 个, 失败 {result['failed']} 个")
        
        return result

    def recover_tasks_on_startup(self) -> Dict[str, int]:
        result = {
            "recovered_pending": 0,
            "recovered_processing": 0,
            "total_recovered": 0
        }
        
        processing_tasks = self.db.query(AsyncTask).filter(
            AsyncTask.status == TaskStatus.PROCESSING.value
        ).all()
        
        for task in processing_tasks:
            if task.retry_count >= task.max_retry_count:
                task.status = TaskStatus.FAILED_PERMANENT.value
                task.error_message = (task.error_message or "") + "\n[系统恢复] 服务重启，任务未完成，已超过最大重试次数"
            else:
                task.status = TaskStatus.WAIT_RETRY.value
                task.next_retry_time = datetime.now()
                task.error_message = (task.error_message or "") + "\n[系统恢复] 服务重启，任务未完成，等待重试"
            result["recovered_processing"] += 1
        
        pending_tasks = self.db.query(AsyncTask).filter(
            AsyncTask.status.in_([
                TaskStatus.PENDING.value,
                TaskStatus.WAIT_RETRY.value
            ])
        ).all()
        
        result["recovered_pending"] = len(pending_tasks)
        
        self.db.commit()
        
        result["total_recovered"] = result["recovered_pending"] + result["recovered_processing"]
        
        logger.info(f"服务启动任务恢复完成: 待处理 {result['recovered_pending']} 个, 处理中恢复 {result['recovered_processing']} 个")
        
        return result

    def get_task_status(self, task_id: str) -> Optional[AsyncTask]:
        return self.db.query(AsyncTask).filter(
            AsyncTask.task_id == task_id
        ).first()
