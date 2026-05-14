from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime
import time

from ..models.cleanup_task import CleanupTask
from ..models.seed_batch import SeedBatch
from ..schemas.cleanup_task import CleanupTaskCreate, CleanupTaskUpdate
from .sandbox_service import SandboxService
from .batch_service import BatchService


class CleanupService:
    @staticmethod
    def get_task(db: Session, task_id: int) -> Optional[CleanupTask]:
        return db.query(CleanupTask).filter(CleanupTask.id == task_id).first()
    
    @staticmethod
    def list_tasks(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None, sandbox_id: Optional[int] = None) -> List[CleanupTask]:
        query = db.query(CleanupTask)
        if status:
            query = query.filter(CleanupTask.status == status)
        if sandbox_id:
            query = query.filter(CleanupTask.sandbox_id == sandbox_id)
        return query.order_by(CleanupTask.created_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def create_task(db: Session, task_create: CleanupTaskCreate) -> CleanupTask:
        task = CleanupTask(
            **task_create.model_dump(),
            status="pending"
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task
    
    @staticmethod
    def execute_cleanup(db: Session, task_id: int) -> tuple[bool, Optional[str]]:
        task = CleanupService.get_task(db, task_id)
        if not task:
            return False, "Task not found"
        
        if task.status not in ["pending", "failed"]:
            return False, f"Invalid task status: {task.status}"
        
        sandbox = SandboxService.get_sandbox(db, task.sandbox_id)
        if not sandbox:
            return False, "Sandbox not found"
        
        start_time = time.time()
        task.status = "running"
        task.executed_at = datetime.now()
        db.commit()
        
        try:
            result = {
                "cleanup_type": task.cleanup_type,
                "strategy": task.cleanup_strategy,
                "records_removed": 0,
                "batches_rolled_back": []
            }
            
            if task.batch_id:
                batch = BatchService.get_batch(db, task.batch_id)
                if batch:
                    batch.status = "rolled_back"
                    db.commit()
                    result["batches_rolled_back"].append(batch.batch_no)
                    result["records_removed"] += 1
            
            if task.cleanup_type == "full":
                batches = BatchService.list_batches(db, sandbox_id=task.sandbox_id, status="completed")
                for batch in batches:
                    batch.status = "rolled_back"
                    result["batches_rolled_back"].append(batch.batch_no)
                    result["records_removed"] += 1
                db.commit()
                SandboxService.update_last_cleaned(db, task.sandbox_id)
            
            task.status = "completed"
            task.completed_at = datetime.now()
            task.result_summary = result
            db.commit()
            
            return True, None
            
        except Exception as e:
            error_msg = str(e)
            task.status = "failed"
            task.error_message = error_msg
            task.completed_at = datetime.now()
            db.commit()
            
            return False, error_msg
    
    @staticmethod
    def rollback_batch(db: Session, batch_id: int) -> tuple[bool, Optional[str]]:
        batch = BatchService.get_batch(db, batch_id)
        if not batch:
            return False, "Batch not found"
        
        if batch.status != "completed":
            return False, f"Cannot rollback batch with status: {batch.status}"
        
        task = CleanupTask(
            sandbox_id=batch.sandbox_id,
            batch_id=batch_id,
            cleanup_type="rollback",
            cleanup_strategy={"target_batch": batch_id},
            status="pending"
        )
        db.add(task)
        db.commit()
        
        return CleanupService.execute_cleanup(db, task.id)
