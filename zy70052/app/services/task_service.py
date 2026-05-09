from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from decimal import Decimal
import json
import traceback

from sqlalchemy.orm import Session

from app.models import TaskRecord, ExtensionApplication
from app.utils import (
    TaskStatus, TaskType, ApplicationStatus,
    IdGenerator, DateTimeUtils
)
from app.config import settings


class TaskService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_task(
        self,
        task_name: str,
        task_type: TaskType,
        business_type: Optional[str] = None,
        business_no: Optional[str] = None,
        business_id: Optional[int] = None,
        task_parameters: Optional[Dict[str, Any]] = None,
        task_description: Optional[str] = None,
        delay_seconds: int = 0
    ) -> TaskRecord:
        next_execution_time = DateTimeUtils.now_naive()
        if delay_seconds > 0:
            next_execution_time = DateTimeUtils.add_days(
                next_execution_time, delay_seconds // 86400
            )
            next_execution_time = DateTimeUtils.add_days(
                next_execution_time, 0
            )
            remaining = delay_seconds % 86400
            next_execution_time = next_execution_time + timedelta(seconds=remaining)
        
        task = TaskRecord(
            task_name=task_name,
            task_type=task_type.value,
            business_type=business_type,
            business_no=business_no,
            business_id=business_id,
            task_parameters=json.dumps(task_parameters, ensure_ascii=False) if task_parameters else None,
            task_description=task_description,
            status=TaskStatus.PENDING.value,
            max_execution_count=settings.TASK_MAX_RETRIES,
            next_execution_time=next_execution_time
        )
        
        self.db.add(task)
        self.db.flush()
        
        return task
    
    def start_task(self, task_id: int) -> Optional[TaskRecord]:
        task = self.db.query(TaskRecord).get(task_id)
        if not task:
            return None
        
        task.status = TaskStatus.RUNNING.value
        task.execution_count += 1
        task.last_execution_time = DateTimeUtils.now_naive()
        task.version += 1
        
        self.db.flush()
        return task
    
    def complete_task(
        self,
        task_id: int,
        result: Optional[Dict[str, Any]] = None
    ) -> Optional[TaskRecord]:
        task = self.db.query(TaskRecord).get(task_id)
        if not task:
            return None
        
        task.status = TaskStatus.SUCCESS.value
        task.last_successful_execution_time = DateTimeUtils.now_naive()
        task.execution_result = json.dumps(result, ensure_ascii=False) if result else None
        task.version += 1
        
        self.db.flush()
        self.db.commit()
        
        return task
    
    def fail_task(
        self,
        task_id: int,
        error_message: str,
        error_stack: Optional[str] = None
    ) -> Optional[TaskRecord]:
        task = self.db.query(TaskRecord).get(task_id)
        if not task:
            return None
        
        now = DateTimeUtils.now_naive()
        
        if task.execution_count >= task.max_execution_count:
            task.status = TaskStatus.MAX_RETRY_EXCEEDED.value
        else:
            task.status = TaskStatus.RETRYING.value
            retry_delay = settings.TASK_RETRY_BACKOFF * task.execution_count
            task.next_execution_time = now + timedelta(seconds=retry_delay)
        
        task.last_error_message = error_message
        task.last_error_stack = error_stack
        task.last_error_time = now
        
        if not task.first_error_time:
            task.first_error_time = now
        
        task.version += 1
        
        self.db.flush()
        self.db.commit()
        
        return task
    
    def cancel_task(self, task_id: int) -> Optional[TaskRecord]:
        task = self.db.query(TaskRecord).get(task_id)
        if not task:
            return None
        
        task.status = TaskStatus.CANCELLED.value
        task.version += 1
        
        self.db.flush()
        self.db.commit()
        
        return task
    
    def get_pending_tasks(self, limit: int = 100) -> List[TaskRecord]:
        now = DateTimeUtils.now_naive()
        return self.db.query(TaskRecord).filter(
            TaskRecord.status.in_([
                TaskStatus.PENDING.value,
                TaskStatus.RETRYING.value
            ]),
            TaskRecord.next_execution_time <= now
        ).order_by(TaskRecord.next_execution_time.asc()).limit(limit).all()
    
    def get_failed_tasks(self, limit: int = 100) -> List[TaskRecord]:
        return self.db.query(TaskRecord).filter(
            TaskRecord.status.in_([
                TaskStatus.FAILED.value,
                TaskStatus.MAX_RETRY_EXCEEDED.value
            ])
        ).order_by(TaskRecord.last_error_time.desc()).limit(limit).all()
    
    def execute_extension_task(
        self,
        task: TaskRecord
    ) -> Dict[str, Any]:
        from app.services.extension_service import ExtensionService, ExtensionApplicationException
        
        try:
            params = json.loads(task.task_parameters) if task.task_parameters else {}
            application_no = params.get("application_no")
            
            if not application_no:
                raise Exception("缺少 application_no 参数")
            
            extension_service = ExtensionService(self.db)
            result = extension_service.execute_extension(
                application_no=application_no
            )
            
            self.complete_task(task.id, result)
            return result
            
        except ExtensionApplicationException as e:
            error_stack = traceback.format_exc()
            self.fail_task(task.id, str(e), error_stack)
            raise
        except Exception as e:
            error_stack = traceback.format_exc()
            self.fail_task(task.id, str(e), error_stack)
            raise
    
    def get_task_status(self, task_id: int) -> Optional[Dict[str, Any]]:
        task = self.db.query(TaskRecord).get(task_id)
        if not task:
            return None
        
        return {
            "task_id": task.id,
            "task_name": task.task_name,
            "task_type": task.task_type,
            "status": task.status,
            "execution_count": task.execution_count,
            "max_execution_count": task.max_execution_count,
            "last_execution_time": task.last_execution_time.isoformat() if task.last_execution_time else None,
            "next_execution_time": task.next_execution_time.isoformat() if task.next_execution_time else None,
            "last_successful_execution_time": task.last_successful_execution_time.isoformat() if task.last_successful_execution_time else None,
            "last_error_message": task.last_error_message,
            "last_error_time": task.last_error_time.isoformat() if task.last_error_time else None,
            "business_no": task.business_no,
            "business_type": task.business_type
        }
    
    def create_execute_extension_task(
        self,
        application_no: str,
        delay_seconds: int = 0
    ) -> TaskRecord:
        return self.create_task(
            task_name="执行贷款展期",
            task_type=TaskType.EXECUTE_EXTENSION,
            business_type="EXTENSION_APPLICATION",
            business_no=application_no,
            task_parameters={"application_no": application_no},
            task_description=f"执行展期申请: {application_no}",
            delay_seconds=delay_seconds
        )
    
    def retry_failed_task(self, task_id: int) -> Optional[TaskRecord]:
        task = self.db.query(TaskRecord).get(task_id)
        if not task:
            return None
        
        if task.status not in [
            TaskStatus.FAILED.value,
            TaskStatus.MAX_RETRY_EXCEEDED.value
        ]:
            return None
        
        task.status = TaskStatus.PENDING.value
        task.execution_count = 0
        task.next_execution_time = DateTimeUtils.now_naive()
        task.last_error_message = None
        task.last_error_stack = None
        task.first_error_time = None
        task.last_error_time = None
        task.version += 1
        
        self.db.flush()
        self.db.commit()
        
        return task
