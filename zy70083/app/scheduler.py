import threading
import time
import logging
from .database import SessionLocal
from .services.task_service import TaskService

logger = logging.getLogger(__name__)

_scheduler_thread = None
_scheduler_running = False
_scheduler_interval = 10


def _run_scheduler():
    global _scheduler_running
    logger.info("后台任务调度器已启动")

    while _scheduler_running:
        try:
            db = SessionLocal()
            try:
                pending_tasks = TaskService.get_pending_tasks(db)

                for task in pending_tasks:
                    logger.info(f"开始执行任务: {task.id} - {task.task_name}")

                    if task.task_type == "verification":
                        success, message = TaskService.execute_verification_task(db, task)
                        logger.info(f"任务 {task.id} 执行结果: {'成功' if success else '失败'} - {message}")
                    elif task.task_type == "public_announcement":
                        success, message = TaskService.execute_public_announcement_task(db, task)
                        logger.info(f"任务 {task.id} 执行结果: {'成功' if success else '失败'} - {message}")

            finally:
                db.close()

        except Exception as e:
            logger.error(f"调度器执行异常: {str(e)}")

        time.sleep(_scheduler_interval)

    logger.info("后台任务调度器已停止")


def start_scheduler():
    global _scheduler_thread, _scheduler_running

    if _scheduler_running:
        logger.warning("调度器已在运行中")
        return

    _scheduler_running = True
    _scheduler_thread = threading.Thread(target=_run_scheduler, daemon=True)
    _scheduler_thread.start()


def stop_scheduler():
    global _scheduler_running
    _scheduler_running = False
    if _scheduler_thread:
        _scheduler_thread.join(timeout=5)


def is_scheduler_running():
    return _scheduler_running
