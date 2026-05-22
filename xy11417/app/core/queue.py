import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from .config import settings, TaskStatus, RetryCategory
from .database import SessionLocal
from app.models import RepairTask, ProcessLog, FailedRecord
from app.services.task_processor import TaskProcessor

logger = logging.getLogger(__name__)

class QueueManager:
    def __init__(self):
        self.running = False
        self.processor = TaskProcessor()
        self.task_queue: asyncio.Queue = asyncio.Queue()
        self.workers: List[asyncio.Task] = []
    
    async def start(self):
        self.running = True
        logger.info("Starting queue manager...")
        
        self.workers = [
            asyncio.create_task(self.queue_consumer())
            for _ in range(3)
        ]
        
        asyncio.create_task(self.queue_scheduler())
        asyncio.create_task(self.dead_letter_monitor())
        
        logger.info("Queue manager started successfully")
    
    async def stop(self):
        self.running = False
        logger.info("Stopping queue manager...")
        
        for worker in self.workers:
            worker.cancel()
        
        await asyncio.gather(*self.workers, return_exceptions=True)
        logger.info("Queue manager stopped")
    
    async def queue_scheduler(self):
        while self.running:
            try:
                db = SessionLocal()
                try:
                    pending_tasks = db.query(RepairTask).filter(
                        RepairTask.status.in_([
                            TaskStatus.PENDING.value,
                            TaskStatus.RETRYING.value
                        ]),
                        (RepairTask.next_retry_at.is_(None) | (RepairTask.next_retry_at <= datetime.utcnow()))
                    ).limit(100).all()
                    
                    for task in pending_tasks:
                        await self.task_queue.put(task.task_id)
                    
                    if pending_tasks:
                        logger.info(f"Scheduled {len(pending_tasks)} tasks for processing")
                finally:
                    db.close()
                
                await asyncio.sleep(settings.QUEUE_PROCESS_INTERVAL)
            except Exception as e:
                logger.error(f"Queue scheduler error: {e}")
                await asyncio.sleep(5)
    
    async def queue_consumer(self):
        while self.running:
            try:
                task_id = await self.task_queue.get()
                await self.process_task(task_id)
                self.task_queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Queue consumer error: {e}")
    
    async def process_task(self, task_id: str):
        db = SessionLocal()
        try:
            task = db.query(RepairTask).filter(RepairTask.task_id == task_id).first()
            if not task:
                logger.warning(f"Task {task_id} not found")
                return
            
            if task.status not in [TaskStatus.PENDING.value, TaskStatus.RETRYING.value]:
                logger.info(f"Task {task_id} already processed, skipping")
                return
            
            task.status = TaskStatus.PROCESSING.value
            db.commit()
            
            self.add_process_log(db, task_id, "start_processing", 
                               status_before=TaskStatus.PENDING.value,
                               status_after=TaskStatus.PROCESSING.value)
            
            result = await self.processor.process(task, db)
            
            if result.success:
                task.status = TaskStatus.SUCCESS.value
                self.add_process_log(db, task_id, "processing_complete",
                                   status_before=TaskStatus.PROCESSING.value,
                                   status_after=TaskStatus.SUCCESS.value,
                                   details={"result": result.data})
            else:
                await self.handle_task_failure(task, result.error, result.retry_category, db)
            
            db.commit()
            
        except Exception as e:
            logger.error(f"Error processing task {task_id}: {e}")
            await self.handle_task_failure(task, str(e), RetryCategory.SYSTEM_ERROR.value, db)
            db.commit()
        finally:
            db.close()
    
    async def handle_task_failure(self, task: RepairTask, error: str, 
                                  retry_category: str, db: Session):
        task.retry_count += 1
        task.error_message = error
        task.retry_category = retry_category
        task.last_retry_at = datetime.utcnow()
        
        self.add_failed_record(db, task.task_id, task.retry_count, 
                              retry_category, error)
        
        self.add_process_log(db, task.task_id, "processing_failed",
                           status_before=TaskStatus.PROCESSING.value,
                           status_after=TaskStatus.RETRYING.value,
                           details={"error": error, "retry_count": task.retry_count})
        
        if task.retry_count >= task.max_retries:
            task.status = TaskStatus.DEAD_LETTER.value
            task.manual_review_required = True
            self.add_process_log(db, task.task_id, "max_retries_exceeded",
                               status_before=TaskStatus.RETRYING.value,
                               status_after=TaskStatus.DEAD_LETTER.value,
                               details={"max_retries": task.max_retries})
        else:
            task.status = TaskStatus.RETRYING.value
            delay = settings.RETRY_DELAY_SECONDS * (settings.RETRY_BACKOFF_MULTIPLIER ** (task.retry_count - 1))
            task.next_retry_at = datetime.utcnow() + timedelta(seconds=delay)
    
    async def dead_letter_monitor(self):
        while self.running:
            try:
                db = SessionLocal()
                try:
                    cutoff_time = datetime.utcnow() - timedelta(hours=settings.DEAD_LETTER_AFTER_HOURS)
                    
                    stuck_tasks = db.query(RepairTask).filter(
                        RepairTask.status == TaskStatus.RETRYING.value,
                        RepairTask.updated_at < cutoff_time
                    ).all()
                    
                    for task in stuck_tasks:
                        task.status = TaskStatus.DEAD_LETTER.value
                        task.manual_review_required = True
                        self.add_process_log(db, task.task_id, "auto_dead_letter",
                                           status_before=TaskStatus.RETRYING.value,
                                           status_after=TaskStatus.DEAD_LETTER.value,
                                           details={"reason": "stuck_timeout"})
                    
                    if stuck_tasks:
                        db.commit()
                        logger.info(f"Moved {len(stuck_tasks)} stuck tasks to dead letter")
                finally:
                    db.close()
                
                await asyncio.sleep(300)
            except Exception as e:
                logger.error(f"Dead letter monitor error: {e}")
                await asyncio.sleep(60)
    
    def add_process_log(self, db: Session, task_id: str, action: str,
                       status_before: str = None, status_after: str = None,
                       details: dict = None, performed_by: int = None):
        log = ProcessLog(
            task_id=task_id,
            action=action,
            status_before=status_before,
            status_after=status_after,
            details=details,
            performed_by=performed_by
        )
        db.add(log)
    
    def add_failed_record(self, db: Session, task_id: str, retry_attempt: int,
                         error_category: str, error_message: str, 
                         error_details: dict = None, raw_payload: dict = None):
        record = FailedRecord(
            task_id=task_id,
            retry_attempt=retry_attempt,
            error_category=error_category,
            error_message=error_message,
            error_details=error_details,
            raw_payload=raw_payload
        )
        db.add(record)
