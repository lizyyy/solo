import json
import threading
import time
from datetime import datetime
from typing import Callable, Dict
from sqlalchemy.orm import Session
from app.models.models import BackgroundJob, TaskStatus
from app.services.common import log_exception, create_pending_task, TaskType, ExceptionType


class JobExecutor:
    def __init__(self):
        self.handlers: Dict[str, Callable] = {}
        self._running = False
        self._thread = None

    def register_handler(self, job_type: str, handler: Callable):
        self.handlers[job_type] = handler

    def execute_job(self, job: BackgroundJob, db: Session) -> bool:
        handler = self.handlers.get(job.job_type)
        if not handler:
            job.error_message = f"No handler found for job type: {job.job_type}"
            job.status = TaskStatus.FAILED
            db.commit()
            log_exception(
                db, ExceptionType.SYSTEM_ERROR, "execute_job",
                job.error_message,
                {"job_id": job.id, "job_type": job.job_type}
            )
            return False

        try:
            data = json.loads(job.data) if job.data else {}
            handler(db, data)
            job.status = TaskStatus.COMPLETED
            job.last_executed_at = datetime.utcnow()
            db.commit()
            return True
        except Exception as e:
            job.retry_count += 1
            job.last_executed_at = datetime.utcnow()
            job.error_message = str(e)

            if job.retry_count >= job.max_retries:
                job.status = TaskStatus.FAILED
                create_pending_task(
                    db, TaskType.DATA_SYNC,
                    f"后台任务失败待处理 - {job.job_type}",
                    f"任务ID: {job.id}，错误: {str(e)}",
                    {"job_id": job.id, "error": str(e)}
                )
            else:
                job.status = TaskStatus.RETRY

            log_exception(
                db, ExceptionType.SYSTEM_ERROR, "execute_job",
                str(e),
                {"job_id": job.id, "job_type": job.job_type, "retry_count": job.retry_count}
            )
            db.commit()
            return False


job_executor = JobExecutor()


def example_batch_process_handler(db: Session, data: dict):
    batch_number = data.get("batch_number")
    if not batch_number:
        raise ValueError("batch_number is required")
    time.sleep(2)
    print(f"Processed batch: {batch_number}")


job_executor.register_handler("example_batch_process", example_batch_process_handler)
