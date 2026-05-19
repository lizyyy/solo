from datetime import datetime, timedelta, date
from typing import List, Optional, Tuple
from dataclasses import asdict

from app.models.database import db, Schedule, Task, LockRecord, ExceptionRecord, DailyReport
from app.schemas.schedule import (
    ScheduleCreate, ScheduleBatchCreate,
    TaskCreate, TaskBatchCreate,
    LockResource, UnlockResource,
    ExceptionCreate, ExceptionResolve,
    DailyReportRequest
)
from app.schemas.common import BatchResult


class ScheduleService:
    def __init__(self):
        self.db = db
    
    def _find_existing_schedule_by_idempotency(self, idempotency_key: str) -> Optional[Schedule]:
        for schedule in self.db.schedules.values():
            if schedule.idempotency_key == idempotency_key:
                return schedule
        return None
    
    def _find_existing_task_by_idempotency(self, idempotency_key: str) -> Optional[Task]:
        for task in self.db.tasks.values():
            if task.idempotency_key == idempotency_key:
                return task
        return None
    
    def _validate_schedule(self, schedule_data: ScheduleCreate) -> Tuple[bool, str]:
        if schedule_data.driver_id not in self.db.drivers:
            return False, f"司机 {schedule_data.driver_id} 不存在"
        if schedule_data.forklift_id not in self.db.forklifts:
            return False, f"叉车 {schedule_data.forklift_id} 不存在"
        
        for task_id in schedule_data.task_ids:
            if task_id not in self.db.tasks:
                return False, f"任务 {task_id} 不存在"
        
        existing = [
            s for s in self.db.schedules.values()
            if s.schedule_date == schedule_data.schedule_date
            and s.shift == schedule_data.shift
            and (s.driver_id == schedule_data.driver_id or s.forklift_id == schedule_data.forklift_id)
            and s.status in ["scheduled", "in_progress"]
        ]
        if existing:
            return False, "该司机或叉车在同一班次已有排班"
        
        if self.db.forklifts[schedule_data.forklift_id].battery_level < 20:
            return False, "叉车电量不足，无法排班"
        
        return True, ""
    
    def create_schedule(self, schedule_data: ScheduleCreate, created_by: str = "system") -> dict:
        existing = self._find_existing_schedule_by_idempotency(schedule_data.idempotency_key)
        if existing:
            return asdict(existing)
        
        is_valid, error_msg = self._validate_schedule(schedule_data)
        if not is_valid:
            raise ValueError(error_msg)
        
        schedule = Schedule(
            schedule_date=schedule_data.schedule_date,
            shift=schedule_data.shift,
            driver_id=schedule_data.driver_id,
            forklift_id=schedule_data.forklift_id,
            task_ids=schedule_data.task_ids.copy(),
            created_by=created_by,
            idempotency_key=schedule_data.idempotency_key
        )
        
        self.db.schedules[schedule.id] = schedule
        
        for task_id in schedule_data.task_ids:
            task = self.db.tasks[task_id]
            task.assigned_to = schedule.driver_id
            task.schedule_id = schedule.id
            task.status = "assigned"
        
        self.db.drivers[schedule.driver_id].status = "scheduled"
        self.db.forklifts[schedule.forklift_id].status = "scheduled"
        
        return asdict(schedule)
    
    def batch_create_schedules(self, batch_data: ScheduleBatchCreate, created_by: str = "system") -> BatchResult:
        result = BatchResult()
        
        for idx, schedule_data in enumerate(batch_data.schedules):
            try:
                schedule = self.create_schedule(schedule_data, created_by)
                result.successful.append(schedule)
                result.success_count += 1
            except Exception as e:
                result.failed.append({
                    "index": idx,
                    "data": schedule_data.model_dump(),
                    "error": str(e)
                })
                result.failure_count += 1
        
        return result
    
    def get_schedules(self, schedule_date: Optional[date] = None, shift: Optional[str] = None) -> List[dict]:
        schedules = list(self.db.schedules.values())
        if schedule_date:
            schedules = [s for s in schedules if s.schedule_date == schedule_date]
        if shift:
            schedules = [s for s in schedules if s.shift == shift]
        return [asdict(s) for s in schedules]
    
    def create_task(self, task_data: TaskCreate) -> dict:
        existing = self._find_existing_task_by_idempotency(task_data.idempotency_key)
        if existing:
            return asdict(existing)
        
        task = Task(
            name=task_data.name,
            description=task_data.description,
            priority=task_data.priority,
            estimated_duration=task_data.estimated_duration,
            idempotency_key=task_data.idempotency_key
        )
        self.db.tasks[task.id] = task
        return asdict(task)
    
    def batch_create_tasks(self, batch_data: TaskBatchCreate) -> BatchResult:
        result = BatchResult()
        
        for idx, task_data in enumerate(batch_data.tasks):
            try:
                task = self.create_task(task_data)
                result.successful.append(task)
                result.success_count += 1
            except Exception as e:
                result.failed.append({
                    "index": idx,
                    "data": task_data.model_dump(),
                    "error": str(e)
                })
                result.failure_count += 1
        
        return result
    
    def get_tasks(self, status: Optional[str] = None) -> List[dict]:
        tasks = list(self.db.tasks.values())
        if status:
            tasks = [t for t in tasks if t.status == status]
        return [asdict(t) for t in tasks]


class LockService:
    def __init__(self):
        self.db = db
    
    def _is_resource_locked(self, resource_type: str, resource_id: str) -> bool:
        for lock in self.db.lock_records.values():
            if (lock.resource_type == resource_type 
                and lock.resource_id == resource_id 
                and lock.is_active):
                if lock.expires_at and lock.expires_at < datetime.now():
                    lock.is_active = False
                else:
                    return True
        return False
    
    def lock_resource(self, lock_data: LockResource, locked_by: str = "system") -> dict:
        if self._is_resource_locked(lock_data.resource_type, lock_data.resource_id):
            raise ValueError(f"资源 {lock_data.resource_type}:{lock_data.resource_id} 已被锁定")
        
        expires_at = None
        if lock_data.expire_seconds:
            expires_at = datetime.now() + timedelta(seconds=lock_data.expire_seconds)
        
        lock = LockRecord(
            resource_type=lock_data.resource_type,
            resource_id=lock_data.resource_id,
            locked_by=locked_by,
            reason=lock_data.reason,
            expires_at=expires_at
        )
        self.db.lock_records[lock.id] = lock
        return asdict(lock)
    
    def unlock_resource(self, unlock_data: UnlockResource) -> bool:
        for lock in self.db.lock_records.values():
            if (lock.resource_type == unlock_data.resource_type 
                and lock.resource_id == unlock_data.resource_id 
                and lock.is_active):
                lock.is_active = False
                return True
        return False
    
    def get_active_locks(self) -> List[dict]:
        return [asdict(lock) for lock in self.db.lock_records.values() if lock.is_active]


class ExceptionService:
    def __init__(self):
        self.db = db
    
    def create_exception(self, exception_data: ExceptionCreate, reported_by: str = "system") -> dict:
        exception = ExceptionRecord(
            schedule_id=exception_data.schedule_id,
            task_id=exception_data.task_id,
            forklift_id=exception_data.forklift_id,
            driver_id=exception_data.driver_id,
            exception_type=exception_data.exception_type,
            description=exception_data.description,
            severity=exception_data.severity,
            reported_by=reported_by
        )
        self.db.exception_records[exception.id] = exception
        
        if exception_data.task_id and exception_data.task_id in self.db.tasks:
            self.db.tasks[exception_data.task_id].status = "exception"
        
        return asdict(exception)
    
    def resolve_exception(self, exception_id: str, resolve_data: ExceptionResolve, resolved_by: str = "system") -> dict:
        if exception_id not in self.db.exception_records:
            raise ValueError("异常记录不存在")
        
        exception = self.db.exception_records[exception_id]
        exception.status = "resolved"
        exception.resolved_at = datetime.now()
        exception.resolved_by = resolved_by
        exception.resolution = resolve_data.resolution
        
        if exception.task_id and exception.task_id in self.db.tasks:
            self.db.tasks[exception.task_id].status = "pending"
        
        return asdict(exception)
    
    def get_exceptions(self, status: Optional[str] = None) -> List[dict]:
        exceptions = list(self.db.exception_records.values())
        if status:
            exceptions = [e for e in exceptions if e.status == status]
        return [asdict(e) for e in exceptions]


class ReportService:
    def __init__(self):
        self.db = db
    
    def generate_daily_report(self, report_data: DailyReportRequest, generated_by: str = "system") -> dict:
        report_date = report_data.report_date
        shift = report_data.shift
        
        schedules = [
            s for s in self.db.schedules.values()
            if s.schedule_date == report_date and s.shift == shift
        ]
        
        tasks = [
            t for t in self.db.tasks.values()
            if t.schedule_id in [s.id for s in schedules]
        ]
        completed_tasks = [t for t in tasks if t.status == "completed"]
        
        exceptions = [
            e for e in self.db.exception_records.values()
            if e.reported_at.date() == report_date
        ]
        resolved_exceptions = [e for e in exceptions if e.status == "resolved"]
        
        active_locks = [lock for lock in self.db.lock_records.values() if lock.is_active]
        charging_stations_used = len([
            s for s in self.db.charging_stations.values()
            if s.status == "charging"
        ])
        
        details = {
            "schedule_ids": [s.id for s in schedules],
            "task_status_distribution": self._get_task_status_distribution(tasks),
            "exception_types": list(set(e.exception_type for e in exceptions)),
            "active_locks_count": len(active_locks)
        }
        
        report = DailyReport(
            report_date=report_date,
            shift=shift,
            total_tasks=len(tasks),
            completed_tasks=len(completed_tasks),
            total_drivers=len(self.db.drivers),
            active_drivers=len([d for d in self.db.drivers.values() if d.status != "idle"]),
            total_forklifts=len(self.db.forklifts),
            active_forklifts=len([f for f in self.db.forklifts.values() if f.status != "idle"]),
            total_exceptions=len(exceptions),
            resolved_exceptions=len(resolved_exceptions),
            charging_stations_used=charging_stations_used,
            generated_by=generated_by,
            details=details
        )
        self.db.daily_reports[report.id] = report
        return asdict(report)
    
    def _get_task_status_distribution(self, tasks: List[Task]) -> dict:
        distribution = {}
        for task in tasks:
            distribution[task.status] = distribution.get(task.status, 0) + 1
        return distribution
    
    def get_reports(self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[dict]:
        reports = list(self.db.daily_reports.values())
        if start_date:
            reports = [r for r in reports if r.report_date >= start_date]
        if end_date:
            reports = [r for r in reports if r.report_date <= end_date]
        return [asdict(r) for r in reports]


schedule_service = ScheduleService()
lock_service = LockService()
exception_service = ExceptionService()
report_service = ReportService()
