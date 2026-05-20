from datetime import datetime, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from .models import Task, Lock, ExecutionLog, AbnormalQueue, TaskStatus, LockStatus


class MutexLockService:
    def __init__(self, db: Session):
        self.db = db

    def _now(self) -> datetime:
        return datetime.utcnow()

    def acquire_lock(
        self,
        task_name: str,
        instance_id: str,
        execution_window_start: Optional[datetime] = None,
        execution_window_end: Optional[datetime] = None,
    ) -> Tuple[bool, str, Optional[Lock]]:
        task = self.db.query(Task).filter(Task.name == task_name).first()
        if not task:
            task = Task(
                name=task_name,
                description=f"Auto-created task: {task_name}",
                max_execution_time=300,
                heartbeat_interval=30,
                is_active=True
            )
            self.db.add(task)
            self.db.commit()
            self.db.refresh(task)

        if not task.is_active:
            return False, "Task is not active", None

        now = self._now()

        if self.check_for_duplicate_execution(task.id, instance_id):
            self._record_lock_failure(
                task_id=task.id,
                instance_id=instance_id,
                reason="Duplicate execution detected: another instance completed successfully in the last 5 minutes"
            )
            return False, "Duplicate execution blocked", None

        active_locks = self.db.query(Lock).filter(
            and_(
                Lock.task_id == task.id,
                Lock.status == LockStatus.ACQUIRED,
                Lock.expires_at > now
            )
        ).all()

        for lock in active_locks:
            if lock.instance_id == instance_id:
                lock.last_heartbeat_at = now
                lock.expires_at = now + timedelta(seconds=task.max_execution_time)
                self.db.commit()
                self.db.refresh(lock)
                return True, "Lock refreshed (same instance)", lock
            else:
                self._record_lock_failure(
                    task_id=task.id,
                    instance_id=instance_id,
                    reason=f"Lock held by another instance: {lock.instance_id}"
                )
                return False, f"Lock already held by {lock.instance_id}", None

        expired_locks = self.db.query(Lock).filter(
            and_(
                Lock.task_id == task.id,
                Lock.status == LockStatus.ACQUIRED,
                Lock.expires_at <= now
            )
        ).all()

        for lock in expired_locks:
            lock.status = LockStatus.EXPIRED
            self._add_abnormal_queue(
                task_id=task.id,
                lock_id=lock.id,
                instance_id=lock.instance_id,
                abnormal_type="lock_timeout",
                description=f"Lock expired without release. Held by {lock.instance_id}",
                severity="error"
            )

        new_lock = Lock(
            task_id=task.id,
            instance_id=instance_id,
            status=LockStatus.ACQUIRED,
            acquired_at=now,
            expires_at=now + timedelta(seconds=task.max_execution_time),
            last_heartbeat_at=now,
            execution_window_start=execution_window_start,
            execution_window_end=execution_window_end,
            acquire_attempts=1
        )
        self.db.add(new_lock)
        self.db.commit()
        self.db.refresh(new_lock)

        execution_log = ExecutionLog(
            task_id=task.id,
            lock_id=new_lock.id,
            instance_id=instance_id,
            status=TaskStatus.RUNNING
        )
        self.db.add(execution_log)
        self.db.commit()

        return True, "Lock acquired successfully", new_lock

    def heartbeat(self, task_name: str, instance_id: str) -> Tuple[bool, str]:
        task = self.db.query(Task).filter(Task.name == task_name).first()
        if not task:
            return False, "Task not found"

        now = self._now()
        lock = self.db.query(Lock).filter(
            and_(
                Lock.task_id == task.id,
                Lock.instance_id == instance_id,
                Lock.status == LockStatus.ACQUIRED
            )
        ).first()

        if not lock:
            return False, "No active lock found for this instance"

        if lock.expires_at <= now:
            lock.status = LockStatus.EXPIRED
            self.db.commit()
            return False, "Lock already expired"

        lock.last_heartbeat_at = now
        lock.expires_at = now + timedelta(seconds=task.max_execution_time)
        self.db.commit()

        return True, "Heartbeat updated successfully"

    def release_lock(
        self,
        task_name: str,
        instance_id: str,
        success: bool = True,
        result: Optional[str] = None,
        error_message: Optional[str] = None
    ) -> Tuple[bool, str]:
        task = self.db.query(Task).filter(Task.name == task_name).first()
        if not task:
            return False, "Task not found"

        now = self._now()
        lock = self.db.query(Lock).filter(
            and_(
                Lock.task_id == task.id,
                Lock.instance_id == instance_id,
                Lock.status == LockStatus.ACQUIRED
            )
        ).first()

        if not lock:
            return False, "No active lock found for this instance"

        lock.status = LockStatus.RELEASED
        lock.released_at = now

        execution_log = self.db.query(ExecutionLog).filter(
            and_(
                ExecutionLog.lock_id == lock.id,
                ExecutionLog.instance_id == instance_id
            )
        ).order_by(ExecutionLog.started_at.desc()).first()

        if execution_log:
            duration = (now - execution_log.started_at).total_seconds()
            execution_log.completed_at = now
            execution_log.duration_seconds = duration
            execution_log.status = TaskStatus.SUCCESS if success else TaskStatus.FAILED
            execution_log.result = result
            execution_log.error_message = error_message

        self.db.commit()
        return True, "Lock released successfully"

    def force_release_lock(self, lock_id: int, reason: str = "Manual release") -> Tuple[bool, str]:
        lock = self.db.query(Lock).filter(Lock.id == lock_id).first()
        if not lock:
            return False, "Lock not found"

        now = self._now()
        lock.status = LockStatus.RELEASED
        lock.released_at = now
        lock.failed_reason = reason

        execution_log = self.db.query(ExecutionLog).filter(
            ExecutionLog.lock_id == lock.id
        ).order_by(ExecutionLog.started_at.desc()).first()

        if execution_log and execution_log.status == TaskStatus.RUNNING:
            execution_log.status = TaskStatus.ABORTED
            execution_log.completed_at = now
            execution_log.duration_seconds = (now - execution_log.started_at).total_seconds()

        self._add_abnormal_queue(
            task_id=lock.task_id,
            lock_id=lock.id,
            instance_id=lock.instance_id,
            abnormal_type="manual_release",
            description=f"Lock manually released: {reason}",
            severity="warning"
        )

        self.db.commit()
        return True, "Lock force released"

    def _record_lock_failure(self, task_id: int, instance_id: str, reason: str):
        failed_lock = Lock(
            task_id=task_id,
            instance_id=instance_id,
            status=LockStatus.FAILED,
            failed_reason=reason,
            acquire_attempts=1
        )
        self.db.add(failed_lock)

        duplicate_log = ExecutionLog(
            task_id=task_id,
            instance_id=instance_id,
            status=TaskStatus.FAILED,
            is_duplicate=True,
            error_message=reason
        )
        self.db.add(duplicate_log)

        self._add_abnormal_queue(
            task_id=task_id,
            instance_id=instance_id,
            abnormal_type="lock_acquire_failed",
            description=reason,
            severity="warning"
        )

    def _add_abnormal_queue(
        self,
        task_id: int,
        instance_id: str,
        abnormal_type: str,
        description: str,
        severity: str = "warning",
        execution_log_id: Optional[int] = None,
        lock_id: Optional[int] = None
    ):
        abnormal = AbnormalQueue(
            task_id=task_id,
            execution_log_id=execution_log_id,
            lock_id=lock_id,
            instance_id=instance_id,
            abnormal_type=abnormal_type,
            description=description,
            severity=severity
        )
        self.db.add(abnormal)

    def check_for_duplicate_execution(self, task_id: int, instance_id: str) -> bool:
        now = self._now()
        recent_window = now - timedelta(minutes=5)
        
        recent_success = self.db.query(ExecutionLog).filter(
            and_(
                ExecutionLog.task_id == task_id,
                ExecutionLog.instance_id != instance_id,
                ExecutionLog.status == TaskStatus.SUCCESS,
                ExecutionLog.completed_at >= recent_window
            )
        ).first()

        return recent_success is not None

    def get_active_locks(self, task_id: Optional[int] = None):
        query = self.db.query(Lock).filter(Lock.status == LockStatus.ACQUIRED)
        if task_id:
            query = query.filter(Lock.task_id == task_id)
        return query.all()

    def cleanup_expired_locks(self):
        now = self._now()
        expired_locks = self.db.query(Lock).filter(
            and_(
                Lock.status == LockStatus.ACQUIRED,
                Lock.expires_at <= now
            )
        ).all()

        for lock in expired_locks:
            lock.status = LockStatus.EXPIRED
            self._add_abnormal_queue(
                task_id=lock.task_id,
                lock_id=lock.id,
                instance_id=lock.instance_id,
                abnormal_type="lock_timeout",
                description=f"Lock expired during cleanup. Held by {lock.instance_id}",
                severity="error"
            )

        self.db.commit()
