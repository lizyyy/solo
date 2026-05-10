import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models import (
    GPU, Task, TaskHistory, Bill, SchedulerLog,
    GPUStatus, TaskStatus, HistoryAction
)
from app.config import settings


logger = logging.getLogger(__name__)


def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class TaskHistoryRecorder:
    def __init__(self, db: Session):
        self.db = db
    
    def record(
        self,
        task: Task,
        action: str,
        from_status: Optional[str] = None,
        to_status: Optional[str] = None,
        reason: Optional[str] = None,
        details: Optional[str] = None,
        gpu_id: Optional[str] = None,
        queue_position: Optional[int] = None
    ) -> TaskHistory:
        history = TaskHistory(
            task_id=task.id,
            action=action,
            from_status=from_status,
            to_status=to_status,
            reason=reason,
            details=details,
            gpu_id=gpu_id,
            queue_position=queue_position
        )
        self.db.add(history)
        return history
    
    def log_scheduler(
        self,
        event_type: str,
        message: str,
        task_id: Optional[str] = None,
        gpu_id: Optional[str] = None,
        details: Optional[str] = None,
        success: bool = True
    ) -> SchedulerLog:
        log = SchedulerLog(
            event_type=event_type,
            task_id=task_id,
            gpu_id=gpu_id,
            message=message,
            details=details,
            success=success
        )
        self.db.add(log)
        return log


class GPUManager:
    def __init__(self, db: Session):
        self.db = db
    
    def register_gpu(
        self,
        gpu_id: str,
        name: str,
        model: Optional[str] = None,
        memory_gb: Optional[int] = None
    ) -> GPU:
        existing = self.db.query(GPU).filter(GPU.gpu_id == gpu_id).first()
        if existing:
            return existing
        
        gpu = GPU(
            gpu_id=gpu_id,
            name=name,
            model=model,
            memory_gb=memory_gb,
            status=GPUStatus.AVAILABLE
        )
        self.db.add(gpu)
        self.db.commit()
        self.db.refresh(gpu)
        return gpu
    
    def get_available_gpus(self) -> List[GPU]:
        return (
            self.db.query(GPU)
            .filter(GPU.status == GPUStatus.AVAILABLE)
            .order_by(GPU.memory_gb.desc(), GPU.id.asc())
            .all()
        )
    
    def occupy_gpu(self, gpu: GPU, task_id: int) -> bool:
        if gpu.status != GPUStatus.AVAILABLE:
            return False
        gpu.status = GPUStatus.OCCUPIED
        gpu.current_task_id = task_id
        gpu.updated_at = datetime.utcnow()
        self.db.commit()
        return True
    
    def release_gpu(self, gpu: GPU) -> bool:
        if gpu.status != GPUStatus.OCCUPIED:
            return False
        gpu.status = GPUStatus.AVAILABLE
        gpu.current_task_id = None
        gpu.updated_at = datetime.utcnow()
        self.db.commit()
        return True
    
    def set_gpu_maintenance(self, gpu: GPU, maintenance: bool = True) -> bool:
        if maintenance:
            if gpu.status == GPUStatus.OCCUPIED:
                return False
            gpu.status = GPUStatus.MAINTENANCE
        else:
            gpu.status = GPUStatus.AVAILABLE
        gpu.updated_at = datetime.utcnow()
        self.db.commit()
        return True


class QueueManager:
    def __init__(self, db: Session, recorder: TaskHistoryRecorder):
        self.db = db
        self.recorder = recorder
    
    def add_to_queue(self, task: Task) -> int:
        queued_tasks = (
            self.db.query(Task)
            .filter(Task.status == TaskStatus.QUEUED)
            .count()
        )
        
        position = queued_tasks + 1
        
        task.status = TaskStatus.QUEUED
        task.queued_at = datetime.utcnow()
        task.queue_position = position
        
        self.recorder.record(
            task=task,
            action=HistoryAction.QUEUED,
            from_status=TaskStatus.PENDING,
            to_status=TaskStatus.QUEUED,
            reason="Task added to priority queue",
            details=f"Priority: {task.priority}, Position: {position}",
            queue_position=position
        )
        
        self.recorder.log_scheduler(
            event_type="queue_add",
            message=f"Task {task.task_id} added to queue at position {position}",
            task_id=task.task_id,
            details=f"Priority={task.priority}"
        )
        
        self.db.commit()
        self._rebalance_queue()
        return position
    
    def _rebalance_queue(self):
        queued_tasks = (
            self.db.query(Task)
            .filter(Task.status == TaskStatus.QUEUED)
            .order_by(Task.priority.desc(), Task.queued_at.asc())
            .all()
        )
        
        for idx, task in enumerate(queued_tasks, start=1):
            old_position = task.queue_position
            if old_position != idx:
                task.queue_position = idx
                self.recorder.record(
                    task=task,
                    action="position_changed",
                    from_status=TaskStatus.QUEUED,
                    to_status=TaskStatus.QUEUED,
                    reason="Queue rebalanced by priority",
                    details=f"Position changed from {old_position} to {idx}",
                    queue_position=idx
                )
        self.db.commit()
    
    def get_next_task(self) -> Optional[Task]:
        return (
            self.db.query(Task)
            .filter(Task.status == TaskStatus.QUEUED)
            .order_by(Task.priority.desc(), Task.queued_at.asc())
            .first()
        )
    
    def remove_from_queue(self, task: Task):
        if task.status == TaskStatus.QUEUED:
            task.queue_position = None
            self.db.commit()
            self._rebalance_queue()


class TaskExecutor:
    def __init__(self, db: Session, recorder: TaskHistoryRecorder, gpu_manager: GPUManager):
        self.db = db
        self.recorder = recorder
        self.gpu_manager = gpu_manager
    
    def start_task(self, task: Task, gpu: GPU) -> bool:
        if not self.gpu_manager.occupy_gpu(gpu, task.id):
            self.recorder.record(
                task=task,
                action=HistoryAction.REJECTED,
                from_status=task.status,
                to_status=task.status,
                reason=f"GPU {gpu.gpu_id} is not available",
                details=f"GPU status: {gpu.status}"
            )
            self.recorder.log_scheduler(
                event_type="gpu_occupied_fail",
                message=f"Failed to occupy GPU {gpu.gpu_id} for task {task.task_id}",
                task_id=task.task_id,
                gpu_id=gpu.gpu_id,
                success=False
            )
            return False
        
        old_status = task.status
        task.status = TaskStatus.RUNNING
        task.gpu_id = gpu.id
        task.started_at = datetime.utcnow()
        task.queue_position = None
        
        self.recorder.record(
            task=task,
            action=HistoryAction.STARTED,
            from_status=old_status,
            to_status=TaskStatus.RUNNING,
            reason=f"GPU {gpu.gpu_id} allocated",
            details=f"GPU: {gpu.name} ({gpu.memory_gb}GB)",
            gpu_id=gpu.gpu_id
        )
        
        self.recorder.log_scheduler(
            event_type="task_start",
            message=f"Task {task.task_id} started on GPU {gpu.gpu_id}",
            task_id=task.task_id,
            gpu_id=gpu.gpu_id
        )
        
        self._create_or_update_bill(task, gpu)
        self.db.commit()
        return True
    
    def _create_or_update_bill(self, task: Task, gpu: GPU):
        bill = self.db.query(Bill).filter(Bill.task_id == task.id).first()
        if not bill:
            bill = Bill(
                bill_id=generate_id("bill"),
                task_id=task.id,
                user_id=task.user_id,
                gpu_name=gpu.name,
                gpu_memory_gb=gpu.memory_gb,
                start_time=datetime.utcnow()
            )
            self.db.add(bill)
        else:
            bill.start_time = datetime.utcnow()
            bill.gpu_name = gpu.name
            bill.gpu_memory_gb = gpu.memory_gb
    
    def complete_task(self, task: Task, success: bool = True, reason: str = ""):
        gpu = self.db.query(GPU).filter(GPU.current_task_id == task.id).first()
        
        old_status = task.status
        if success:
            task.status = TaskStatus.SUCCEEDED
            action = HistoryAction.SUCCEEDED
        else:
            task.status = TaskStatus.FAILED
            action = HistoryAction.FAILED
        
        task.ended_at = datetime.utcnow()
        
        if gpu:
            self.gpu_manager.release_gpu(gpu)
        
        self.recorder.record(
            task=task,
            action=action,
            from_status=old_status,
            to_status=task.status,
            reason=reason,
            details=f"Task completed. Duration: {(task.ended_at - task.started_at).total_seconds():.1f}s",
            gpu_id=gpu.gpu_id if gpu else None
        )
        
        self.recorder.log_scheduler(
            event_type="task_complete" if success else "task_fail",
            message=f"Task {task.task_id} completed with status {task.status}",
            task_id=task.task_id,
            gpu_id=gpu.gpu_id if gpu else None,
            success=success
        )
        
        self._finalize_bill(task)
        self.db.commit()
    
    def timeout_task(self, task: Task):
        gpu = self.db.query(GPU).filter(GPU.current_task_id == task.id).first()
        
        old_status = task.status
        task.status = TaskStatus.TIMED_OUT
        task.ended_at = datetime.utcnow()
        
        if gpu:
            self.gpu_manager.release_gpu(gpu)
        
        self.recorder.record(
            task=task,
            action=HistoryAction.TIMED_OUT,
            from_status=old_status,
            to_status=TaskStatus.TIMED_OUT,
            reason=f"Exceeded timeout of {task.timeout_minutes} minutes",
            details=f"Task ran for {(task.ended_at - task.started_at).total_seconds():.1f}s",
            gpu_id=gpu.gpu_id if gpu else None
        )
        
        self.recorder.log_scheduler(
            event_type="task_timeout",
            message=f"Task {task.task_id} timed out after {task.timeout_minutes} minutes",
            task_id=task.task_id,
            gpu_id=gpu.gpu_id if gpu else None,
            success=False
        )
        
        self._finalize_bill(task)
        self.db.commit()
    
    def _finalize_bill(self, task: Task):
        bill = self.db.query(Bill).filter(Bill.task_id == task.id).first()
        if bill and task.started_at and task.ended_at:
            bill.end_time = task.ended_at
            total_seconds = int((task.ended_at - task.started_at).total_seconds())
            bill.total_seconds = total_seconds
            
            base_rate = 0.01
            premium_rate = 0.005 * (10 - task.priority) if task.priority > 5 else 0
            
            bill.base_cost = round(total_seconds * base_rate, 2)
            bill.premium_cost = round(total_seconds * premium_rate, 2)
            bill.total_cost = round(bill.base_cost + bill.premium_cost, 2)


class RetryManager:
    def __init__(self, db: Session, recorder: TaskHistoryRecorder, queue_manager: QueueManager):
        self.db = db
        self.recorder = recorder
        self.queue_manager = queue_manager
    
    def should_retry(self, task: Task) -> bool:
        return task.retry_count < task.max_retries
    
    def retry_task(self, task: Task) -> bool:
        if not self.should_retry(task):
            self.recorder.record(
                task=task,
                action=HistoryAction.REJECTED,
                from_status=task.status,
                to_status=task.status,
                reason="Max retries exceeded",
                details=f"Retry count: {task.retry_count}/{task.max_retries}"
            )
            self.recorder.log_scheduler(
                event_type="retry_exceeded",
                message=f"Task {task.task_id} exceeded max retries",
                task_id=task.task_id,
                success=False
            )
            return False
        
        task.retry_count += 1
        task.status = TaskStatus.RETRYING
        self.db.commit()
        
        self.recorder.record(
            task=task,
            action=HistoryAction.RETRY_SCHEDULED,
            from_status=TaskStatus.FAILED,
            to_status=TaskStatus.RETRYING,
            reason=f"Task failed, scheduling retry {task.retry_count}/{task.max_retries}",
            details=f"Waiting before re-queueing"
        )
        
        self.recorder.log_scheduler(
            event_type="retry_scheduled",
            message=f"Task {task.task_id} retry {task.retry_count}/{task.max_retries} scheduled",
            task_id=task.task_id
        )
        
        self.queue_manager.add_to_queue(task)
        return True


class MainScheduler:
    def __init__(self, db: Session):
        self.db = db
        self.recorder = TaskHistoryRecorder(db)
        self.gpu_manager = GPUManager(db)
        self.queue_manager = QueueManager(db, self.recorder)
        self.task_executor = TaskExecutor(db, self.recorder, self.gpu_manager)
        self.retry_manager = RetryManager(db, self.recorder, self.queue_manager)
    
    def schedule_tick(self):
        try:
            self._check_timeouts()
            self._process_retries()
            self._dispatch_tasks()
            self.db.commit()
        except Exception as e:
            logger.exception(f"Scheduler tick failed: {e}")
            self.db.rollback()
    
    def _check_timeouts(self):
        running_tasks = (
            self.db.query(Task)
            .filter(Task.status == TaskStatus.RUNNING)
            .all()
        )
        
        now = datetime.utcnow()
        for task in running_tasks:
            if task.started_at and task.timeout_minutes:
                timeout_at = task.started_at + timedelta(minutes=task.timeout_minutes)
                if now >= timeout_at:
                    self.task_executor.timeout_task(task)
    
    def _process_retries(self):
        failed_tasks = (
            self.db.query(Task)
            .filter(
                (Task.status == TaskStatus.FAILED) |
                (Task.status == TaskStatus.TIMED_OUT)
            )
            .all()
        )
        
        for task in failed_tasks:
            if self.retry_manager.should_retry(task):
                self.retry_manager.retry_task(task)
    
    def _dispatch_tasks(self):
        available_gpus = self.gpu_manager.get_available_gpus()
        
        if not available_gpus:
            return
        
        next_task = self.queue_manager.get_next_task()
        if not next_task:
            return
        
        gpu = available_gpus[0]
        
        if self.task_executor.start_task(next_task, gpu):
            self.queue_manager.remove_from_queue(next_task)
    
    def submit_task(
        self,
        name: str,
        user_id: str,
        priority: int = settings.default_priority,
        estimated_duration_minutes: int = settings.default_max_duration_minutes,
        timeout_minutes: int = settings.default_timeout_minutes,
        max_retries: int = settings.max_retry_count,
        command: Optional[str] = None,
        script_path: Optional[str] = None,
        output_path: Optional[str] = None
    ) -> Task:
        task = Task(
            task_id=generate_id("task"),
            name=name,
            user_id=user_id,
            priority=priority,
            estimated_duration_minutes=estimated_duration_minutes,
            timeout_minutes=timeout_minutes,
            max_retries=max_retries,
            command=command,
            script_path=script_path,
            output_path=output_path,
            status=TaskStatus.PENDING,
            submitted_at=datetime.utcnow()
        )
        self.db.add(task)
        self.db.flush()
        
        self.recorder.record(
            task=task,
            action=HistoryAction.SUBMITTED,
            from_status=None,
            to_status=TaskStatus.PENDING,
            reason="Task received",
            details=f"User: {user_id}, Priority: {priority}, Est: {estimated_duration_minutes}min"
        )
        
        self.recorder.log_scheduler(
            event_type="task_submit",
            message=f"Task {task.task_id} submitted by user {user_id}",
            task_id=task.task_id,
            details=f"Priority={priority}, EstDuration={estimated_duration_minutes}min"
        )
        
        self.queue_manager.add_to_queue(task)
        self.db.commit()
        self.db.refresh(task)
        return task
    
    def cancel_task(self, task: Task) -> bool:
        if task.status in [TaskStatus.RUNNING, TaskStatus.QUEUED, TaskStatus.PENDING, TaskStatus.RETRYING]:
            old_status = task.status
            task.status = TaskStatus.CANCELLED
            task.ended_at = datetime.utcnow()
            
            if task.status == TaskStatus.RUNNING:
                gpu = self.db.query(GPU).filter(GPU.current_task_id == task.id).first()
                if gpu:
                    self.gpu_manager.release_gpu(gpu)
            
            self.queue_manager.remove_from_queue(task)
            
            self.recorder.record(
                task=task,
                action=HistoryAction.CANCELLED,
                from_status=old_status,
                to_status=TaskStatus.CANCELLED,
                reason="User cancelled task"
            )
            
            self.recorder.log_scheduler(
                event_type="task_cancel",
                message=f"Task {task.task_id} cancelled by user",
                task_id=task.task_id
            )
            
            self.task_executor._finalize_bill(task)
            self.db.commit()
            return True
        return False
    
    def get_task_block_point(self, task: Task) -> dict:
        latest_history = self.db.query(TaskHistory).filter(
            TaskHistory.task_id == task.id
        ).order_by(TaskHistory.id.desc()).first()
        
        previous_history = self.db.query(TaskHistory).filter(
            TaskHistory.task_id == task.id,
            TaskHistory.id < (latest_history.id if latest_history else 0)
        ).order_by(TaskHistory.id.desc()).first()
        
        block_info = {
            "current_status": task.status,
            "block_point": None,
            "block_reason": None,
            "latest_action": None,
            "previous_action": None,
            "queue_position": task.queue_position,
            "retry_count": task.retry_count,
            "max_retries": task.max_retries
        }
        
        if latest_history:
            block_info["latest_action"] = {
                "action": latest_history.action,
                "from_status": latest_history.from_status,
                "to_status": latest_history.to_status,
                "reason": latest_history.reason,
                "details": latest_history.details,
                "timestamp": latest_history.timestamp.isoformat() if latest_history.timestamp else None
            }
            
            if latest_history.action == HistoryAction.REJECTED:
                block_info["block_point"] = "Rejected at submission/scheduling"
                block_info["block_reason"] = latest_history.reason or latest_history.details
            elif task.status == TaskStatus.QUEUED:
                block_info["block_point"] = "Waiting in priority queue"
                block_info["block_reason"] = f"Position #{task.queue_position}, waiting for available GPU"
            elif task.status == TaskStatus.RETRYING:
                block_info["block_point"] = "Retrying after failure"
                block_info["block_reason"] = f"Retry {task.retry_count}/{task.max_retries}"
        
        if previous_history:
            block_info["previous_action"] = {
                "action": previous_history.action,
                "from_status": previous_history.from_status,
                "to_status": previous_history.to_status,
                "reason": previous_history.reason,
                "details": previous_history.details,
                "timestamp": previous_history.timestamp.isoformat() if previous_history.timestamp else None
            }
        
        return block_info
