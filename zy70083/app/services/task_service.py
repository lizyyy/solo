from typing import Optional, Dict, Callable, Tuple, List
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from datetime import datetime
from ..models import (
    BackgroundTask, TaskStatus, ApplicationRecord,
    ApplicationStatus, ProcessingHistory
)
from .verification_service import VerificationService
from .lottery_service import LotteryService
import logging

logger = logging.getLogger(__name__)


class TaskService:
    @staticmethod
    def create_task(
        db: Session,
        task_name: str,
        task_type: str,
        application_record_id: Optional[int] = None,
        max_retry: int = 3
    ) -> BackgroundTask:
        task = BackgroundTask(
            task_name=task_name,
            task_type=task_type,
            application_record_id=application_record_id,
            max_retry=max_retry,
            status=TaskStatus.PENDING.value
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        logger.info(f"Task created: {task.id} - {task_name}")
        return task

    @staticmethod
    def get_pending_tasks(db: Session) -> List[BackgroundTask]:
        return db.query(BackgroundTask).filter(
            BackgroundTask.status.in_([
                TaskStatus.PENDING.value,
                TaskStatus.RETRY.value
            ])
        ).order_by(BackgroundTask.created_at.asc()).all()

    @staticmethod
    def update_task_status(
        db: Session,
        task: BackgroundTask,
        status: str,
        progress: Optional[int] = None,
        error_message: Optional[str] = None
    ):
        task.status = status
        if progress is not None:
            task.progress = progress
        if error_message:
            task.error_message = error_message
            task.last_error_at = func.now()
        if status == TaskStatus.COMPLETED.value:
            task.last_success_at = func.now()
        db.commit()
        db.refresh(task)
        logger.info(f"Task {task.id} updated: {status}")

    @staticmethod
    def mark_task_for_retry(
        db: Session,
        task: BackgroundTask,
        error_message: str
    ) -> bool:
        if task.retry_count >= task.max_retry:
            TaskService.update_task_status(db, task, TaskStatus.FAILED.value, error_message=error_message)
            return False

        task.retry_count += 1
        task.status = TaskStatus.RETRY.value
        task.error_message = error_message
        task.last_error_at = func.now()
        db.commit()
        db.refresh(task)
        logger.info(f"Task {task.id} marked for retry ({task.retry_count}/{task.max_retry}): {error_message}")
        return True

    @staticmethod
    def execute_verification_task(db: Session, task: BackgroundTask) -> Tuple[bool, str]:
        if task.application_record_id is None:
            return False, "任务未关联申请记录"

        application = db.query(ApplicationRecord).filter(
            ApplicationRecord.id == task.application_record_id
        ).first()
        if not application:
            return False, "申请记录不存在"

        TaskService.update_task_status(db, task, TaskStatus.RUNNING.value, progress=10)

        try:
            if application.current_status == ApplicationStatus.REJECTED.value:
                passed, message = VerificationService.retry_verification(db, application, operator=f"task_{task.id}")
            else:
                passed, results = VerificationService.run_full_verification(db, application, operator=f"task_{task.id}")
                message = results[-1]["message"] if results else "核验完成"

            TaskService.update_task_status(db, task, TaskStatus.COMPLETED.value, progress=100)
            return passed, message

        except Exception as e:
            error_msg = f"核验任务异常: {str(e)}"
            logger.error(error_msg)
            can_retry = TaskService.mark_task_for_retry(db, task, error_msg)
            if can_retry:
                return False, f"任务失败，已标记重试 ({task.retry_count}/{task.max_retry}): {error_msg}"
            return False, f"任务失败，已达最大重试次数: {error_msg}"

    @staticmethod
    def execute_public_announcement_task(db: Session, task: BackgroundTask) -> Tuple[bool, str]:
        application = db.query(ApplicationRecord).filter(
            ApplicationRecord.id == task.application_record_id
        ).first() if task.application_record_id else None

        TaskService.update_task_status(db, task, TaskStatus.RUNNING.value, progress=50)

        try:
            pool_id = application.lottery_pool_id if application else None
            if not pool_id:
                return False, "未找到摇号池信息"

            success, message = LotteryService.start_public_announcement(
                db, pool_id, operator=f"task_{task.id}"
            )

            if success:
                TaskService.update_task_status(db, task, TaskStatus.COMPLETED.value, progress=100)
                return True, message
            else:
                return TaskService.mark_task_for_retry(db, task, message), message

        except Exception as e:
            error_msg = f"公示任务异常: {str(e)}"
            logger.error(error_msg)
            can_retry = TaskService.mark_task_for_retry(db, task, error_msg)
            if can_retry:
                return False, f"任务失败，已标记重试: {error_msg}"
            return False, f"任务失败: {error_msg}"

    @staticmethod
    def get_task_status(db: Session, task_id: int) -> Optional[BackgroundTask]:
        return db.query(BackgroundTask).filter(BackgroundTask.id == task_id).first()

    @staticmethod
    def retry_failed_task(db: Session, task_id: int, operator: Optional[str] = None) -> Tuple[bool, str]:
        task = db.query(BackgroundTask).filter(BackgroundTask.id == task_id).first()
        if not task:
            return False, "任务不存在"

        if task.status != TaskStatus.FAILED.value:
            return False, f"任务状态为 {task.status}，只有失败任务可以重试"

        task.status = TaskStatus.RETRY.value
        task.retry_count = 0
        task.error_message = None
        db.commit()

        logger.info(f"Task {task.id} manually retried by {operator or 'unknown'}")
        return True, "任务已标记为重试，等待执行"

    @staticmethod
    def get_failed_tasks(db: Session) -> List[BackgroundTask]:
        return db.query(BackgroundTask).filter(
            BackgroundTask.status == TaskStatus.FAILED.value
        ).order_by(BackgroundTask.updated_at.desc()).all()

    @staticmethod
    def explain_task_status(task: BackgroundTask) -> Dict:
        status_explanations = {
            TaskStatus.PENDING.value: "任务已创建，等待执行",
            TaskStatus.RUNNING.value: "任务正在执行中",
            TaskStatus.COMPLETED.value: "任务已成功完成",
            TaskStatus.FAILED.value: "任务失败，已达最大重试次数",
            TaskStatus.RETRY.value: f"任务失败，等待重试 ({task.retry_count}/{task.max_retry})"
        }

        retry_suggestion = None
        if task.status == TaskStatus.FAILED.value:
            retry_suggestion = "请检查错误信息并修复问题后，手动调用重试接口重新执行"
        elif task.status == TaskStatus.RETRY.value:
            retry_suggestion = f"任务将自动重试第 {task.retry_count + 1} 次，如有需要可手动检查"

        return {
            "task_id": task.id,
            "task_name": task.task_name,
            "status": task.status,
            "status_explanation": status_explanations.get(task.status, "未知状态"),
            "progress": task.progress,
            "retry_count": task.retry_count,
            "max_retry": task.max_retry,
            "error_message": task.error_message,
            "last_error_at": task.last_error_at,
            "last_success_at": task.last_success_at,
            "retry_suggestion": retry_suggestion,
            "can_manual_retry": task.status == TaskStatus.FAILED.value
        }
