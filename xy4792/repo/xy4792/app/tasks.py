import time
import random
from datetime import datetime
from celery import shared_task
from celery.exceptions import Retry
from app.database import SessionLocal
from app.models import Task, StepLog, RetryLog, DeadLetter, TaskStatus, StepType
from app.config import settings


def get_db_session():
    return SessionLocal()


def log_step(db, task_id: str, step_type: StepType, status: str, message: str = None, duration: int = 0):
    step_log = StepLog(
        task_id=task_id,
        step_type=step_type,
        status=status,
        message=message,
        duration_seconds=duration
    )
    db.add(step_log)
    db.commit()


def update_task_status(db, task: Task, status: TaskStatus, completed_at: datetime = None):
    task.status = status
    if completed_at:
        task.completed_at = completed_at
    db.commit()


def log_retry(db, task: Task, step_type: StepType, error_message: str):
    task.retry_count += 1
    retry_log = RetryLog(
        task_id=task.id,
        retry_number=task.retry_count,
        failed_step=step_type,
        error_message=error_message
    )
    db.add(retry_log)
    db.commit()


def move_to_dead_letter(db, task: Task, reason: str, last_error: str):
    update_task_status(db, task, TaskStatus.DEAD_LETTER)
    dead_letter = DeadLetter(
        task_id=task.id,
        reason=reason,
        last_error=last_error
    )
    db.add(dead_letter)
    db.commit()


@shared_task(bind=True, max_retries=settings.MAX_RETRIES)
def process_contract_task(self, task_id: str, contract_name: str, force_fail: str = None):
    db = get_db_session()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return {"error": f"Task {task_id} not found"}
        
        if task.status == TaskStatus.CANCELLED:
            return {"error": "Task was cancelled"}
        
        update_task_status(db, task, TaskStatus.RUNNING)
        
        steps = [
            (StepType.OCR, "OCR识别中...", "OCR识别完成"),
            (StepType.VALIDATION, "规则校验中...", "规则校验通过"),
            (StepType.REPORT, "生成报告中...", "报告生成完成")
        ]
        
        for step_type, step_msg, success_msg in steps:
            if force_fail and step_type.value == force_fail:
                raise Exception(f"模拟{step_type.value}步骤失败")
            
            start_time = time.time()
            log_step(db, task_id, step_type, "running", step_msg)
            
            try:
                time.sleep(random.uniform(1, 3))
                
                if step_type == StepType.VALIDATION and random.random() < 0.1:
                    raise Exception("合同规则校验不通过: 金额字段格式错误")
                
                duration = int(time.time() - start_time)
                log_step(db, task_id, step_type, "success", success_msg, duration)
                
            except Exception as e:
                duration = int(time.time() - start_time)
                log_step(db, task_id, step_type, "failed", str(e), duration)
                
                if task.retry_count < task.max_retries:
                    log_retry(db, task, step_type, str(e))
                    update_task_status(db, task, TaskStatus.RETRYING)
                    db.close()
                    raise self.retry(exc=e, countdown=2 ** task.retry_count)
                else:
                    move_to_dead_letter(
                        db, task,
                        f"步骤{step_type.value}重试超过最大次数",
                        str(e)
                    )
                    db.close()
                    return {"status": "dead_letter", "error": str(e)}
        
        update_task_status(db, task, TaskStatus.SUCCESS, datetime.utcnow())
        db.close()
        return {"status": "success", "task_id": task_id}
        
    except Retry:
        raise
    except Exception as e:
        db.close()
        raise


@shared_task
def replay_dead_letter_task(dead_letter_id: int):
    db = get_db_session()
    try:
        dead_letter = db.query(DeadLetter).filter(DeadLetter.id == dead_letter_id).first()
        if not dead_letter:
            return {"error": "Dead letter not found"}
        
        task = dead_letter.task
        task.retry_count = 0
        task.status = TaskStatus.PENDING
        task.completed_at = None
        dead_letter.replayed += 1
        
        db.query(StepLog).filter(StepLog.task_id == task.id).delete()
        db.query(RetryLog).filter(RetryLog.task_id == task.id).delete()
        
        db.commit()
        
        celery_task = process_contract_task.apply_async(
            args=[task.id, task.contract_name],
            task_id=task.celery_task_id
        )
        task.celery_task_id = celery_task.id
        db.commit()
        db.close()
        
        return {"status": "replayed", "task_id": task.id}
    except Exception as e:
        db.close()
        raise
