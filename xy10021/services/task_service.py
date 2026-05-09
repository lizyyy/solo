import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Callable
from sqlalchemy.orm import Session
from database import Task, LogSource, LogEntry
from services.log_collector import LogCollectorFactory
from config import settings

logger = logging.getLogger(__name__)


class TaskService:
    
    @staticmethod
    def create_task(
        db: Session,
        task_type: str,
        data: Optional[Dict[str, Any]] = None,
        max_retries: int = settings.TASK_MAX_RETRIES
    ) -> Task:
        task = Task(
            id=str(uuid.uuid4()),
            task_type=task_type,
            status="pending",
            data=data,
            max_retries=max_retries,
            scheduled_at=datetime.now()
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task
    
    @staticmethod
    def get_task(db: Session, task_id: str) -> Optional[Task]:
        return db.query(Task).filter(Task.id == task_id).first()
    
    @staticmethod
    def update_task_status(
        db: Session,
        task_id: str,
        status: str,
        result: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None
    ) -> Optional[Task]:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None
        
        task.status = status
        if result is not None:
            task.result = result
        if error_message is not None:
            task.error_message = error_message
        
        if status == "running":
            task.started_at = datetime.now()
        elif status in ["completed", "failed"]:
            task.completed_at = datetime.now()
        
        db.commit()
        db.refresh(task)
        return task
    
    @staticmethod
    def increment_retry_count(db: Session, task_id: str) -> Optional[Task]:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None
        
        task.retry_count += 1
        task.status = "retrying"
        task.scheduled_at = datetime.now() + timedelta(seconds=settings.TASK_RETRY_DELAY)
        db.commit()
        db.refresh(task)
        return task


class TaskExecutor:
    
    def __init__(self, db: Session):
        self.db = db
    
    def execute_task(self, task: Task):
        task_service = TaskService()
        task_service.update_task_status(self.db, task.id, "running")
        
        try:
            handler = self._get_task_handler(task.task_type)
            result = handler(task.data)
            task_service.update_task_status(self.db, task.id, "completed", result=result)
            logger.info(f"任务 {task.id} 执行完成")
        except Exception as e:
            logger.error(f"任务 {task.id} 执行失败: {str(e)}")
            
            if task.retry_count < task.max_retries:
                task_service.increment_retry_count(self.db, task.id)
            else:
                task_service.update_task_status(
                    self.db, task.id, "failed",
                    error_message=str(e)
                )
    
    def _get_task_handler(self, task_type: str) -> Callable:
        handlers = {
            "collect_logs": self._handle_collect_logs,
            "generate_report": self._handle_generate_report,
        }
        handler = handlers.get(task_type)
        if not handler:
            raise ValueError(f"未知的任务类型: {task_type}")
        return handler
    
    def _handle_collect_logs(self, data: Dict[str, Any]) -> Dict[str, Any]:
        source_id = data.get("source_id")
        if not source_id:
            raise ValueError("缺少 source_id")
        
        source = self.db.query(LogSource).filter(LogSource.id == source_id).first()
        if not source:
            raise ValueError(f"日志源不存在: {source_id}")
        
        if not source.is_active:
            return {"message": "日志源未激活", "count": 0}
        
        collector = LogCollectorFactory.get_collector(source.source_type, self.db)
        logs = collector.collect(source.config)
        
        count = 0
        for log_data in logs:
            entry = LogEntry(
                source_id=source.id,
                log_time=log_data["log_time"],
                log_level=log_data["log_level"],
                message=log_data["message"],
                module=log_data.get("module"),
                trace_id=log_data.get("trace_id"),
                extra_data=log_data.get("extra_data")
            )
            self.db.add(entry)
            count += 1
        
        self.db.commit()
        
        return {"message": "日志采集成功", "count": count}
    
    def _handle_generate_report(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return {"message": "报告生成完成", "report_id": str(uuid.uuid4())}
