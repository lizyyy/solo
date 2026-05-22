import logging
from datetime import datetime
from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.database import SessionLocal
from app.config import settings
from app.models.enums import TaskStatus, RetryCategory
from app.services.task_service import (
    get_tasks_for_retry,
    update_task_status,
    handle_processing_failure,
)
from app.models.enums import OperationType

logger = logging.getLogger(__name__)

scheduler: Optional[BackgroundScheduler] = None


def process_retry_tasks():
    db = SessionLocal()
    try:
        tasks = get_tasks_for_retry(db)
        logger.info(f"找到 {len(tasks)} 个待重试任务")

        for task in tasks:
            try:
                task = update_task_status(
                    db,
                    task,
                    TaskStatus.PROCESSING,
                    OperationType.RETRY,
                    remark=f"调度器自动重试，第{task.retry_count + 1}次",
                )

                success = process_task(task)

                if success:
                    update_task_status(
                        db,
                        task,
                        TaskStatus.COMPENSATED,
                        OperationType.PROCESS,
                        remark="调度器自动处理成功",
                    )
                    task.processed_at = datetime.now()
                    db.commit()
                else:
                    handle_processing_failure(
                        db,
                        task,
                        "自动重试处理失败",
                        RetryCategory.OTHER,
                    )

            except Exception as e:
                logger.error(f"处理任务 {task.task_no} 时出错: {e}")
                db.rollback()
                try:
                    handle_processing_failure(
                        db,
                        task,
                        str(e),
                        RetryCategory.OTHER,
                    )
                except Exception as inner_e:
                    logger.error(f"更新任务状态失败: {inner_e}")
                    db.rollback()

    except Exception as e:
        logger.error(f"重试任务调度执行失败: {e}")
    finally:
        db.close()


def process_task(task) -> bool:
    return True


def start_scheduler():
    global scheduler

    if not settings.SCHEDULER_ENABLED:
        logger.info("调度器已禁用")
        return

    scheduler = BackgroundScheduler()

    scheduler.add_job(
        process_retry_tasks,
        trigger=IntervalTrigger(minutes=settings.RETRY_INTERVAL_MINUTES),
        id="retry_tasks",
        name="自动重试补偿任务",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(f"调度器已启动，重试间隔: {settings.RETRY_INTERVAL_MINUTES} 分钟")

    process_retry_tasks()


def stop_scheduler():
    global scheduler
    if scheduler:
        scheduler.shutdown()
        logger.info("调度器已停止")


def get_scheduler_status() -> dict:
    global scheduler
    if not scheduler:
        return {"running": False, "jobs": []}

    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
        })

    return {
        "running": scheduler.running,
        "jobs": jobs,
    }
