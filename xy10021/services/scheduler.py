import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from database import SessionLocal, Task, LogSource
from services.task_service import TaskService, TaskExecutor

logger = logging.getLogger(__name__)


class TaskScheduler:
    
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self._running = False
    
    def start(self):
        if self._running:
            return
        
        self.scheduler.add_job(
            self._process_pending_tasks,
            trigger=IntervalTrigger(seconds=10),
            id="process_pending_tasks",
            replace_existing=True
        )
        
        self.scheduler.add_job(
            self._collect_active_sources,
            trigger=IntervalTrigger(minutes=5),
            id="collect_active_sources",
            replace_existing=True
        )
        
        self.scheduler.start()
        self._running = True
        logger.info("任务调度器已启动")
    
    def stop(self):
        if self._running:
            self.scheduler.shutdown()
            self._running = False
            logger.info("任务调度器已停止")
    
    def _process_pending_tasks(self):
        db = SessionLocal()
        try:
            now = datetime.now()
            tasks = db.query(Task).filter(
                Task.status.in_(["pending", "retrying"]),
                Task.scheduled_at <= now
            ).all()
            
            for task in tasks:
                try:
                    executor = TaskExecutor(db)
                    executor.execute_task(task)
                except Exception as e:
                    logger.error(f"执行任务 {task.id} 时出错: {str(e)}")
        finally:
            db.close()
    
    def _collect_active_sources(self):
        db = SessionLocal()
        try:
            sources = db.query(LogSource).filter(
                LogSource.is_active == True
            ).all()
            
            for source in sources:
                try:
                    candidate_tasks = db.query(Task).filter(
                        Task.task_type == "collect_logs",
                        Task.status.in_(["pending", "running", "retrying"])
                    ).all()
                    
                    existing_task = None
                    for task in candidate_tasks:
                        if task.data and task.data.get("source_id") == source.id:
                            existing_task = task
                            break
                    
                    if not existing_task:
                        TaskService.create_task(
                            db,
                            "collect_logs",
                            {"source_id": source.id}
                        )
                except Exception as e:
                    logger.error(f"为日志源 {source.id} 创建任务时出错: {str(e)}")
        finally:
            db.close()


task_scheduler = TaskScheduler()
