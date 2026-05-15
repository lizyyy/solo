from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timedelta
from typing import Optional, List
from .models import Task, Timeline, ArchiveRecord, CleanupRecord, TaskStatus, ArchiveStrategy
from .schemas import TaskCreate, TaskRegister, TaskArchive, TaskRevoke
from .config import settings


class TaskService:
    def __init__(self, db: Session):
        self.db = db

    def _add_timeline(self, task_id: int, action: str, status_before: Optional[str], 
                     status_after: Optional[str], operator: Optional[str], 
                     description: Optional[str] = None, details: Optional[dict] = None):
        timeline = Timeline(
            task_id=task_id,
            action=action,
            status_before=status_before,
            status_after=status_after,
            operator=operator,
            description=description,
            details=details
        )
        self.db.add(timeline)
        self.db.flush()

    def _check_permission(self, task: Task, operator: str, require_level: str = "read") -> bool:
        """
        权限校验：
        - read: 仅查询，任何用户均可查看
        - write: 可登记、归档等修改操作，非 owner 无 write 权限
        - admin: 可撤销、清理等高危操作，只有 owner 有权限
        """
        if not operator:
            raise PermissionError("操作人不能为空")
        
        if require_level == "read":
            return True
        
        if operator == task.owner:
            return True
        
        raise PermissionError(f"用户 {operator} 无 {require_level} 权限操作任务 {task.task_number}")

    def get_task_by_number(self, task_number: str) -> Optional[Task]:
        return self.db.query(Task).filter(Task.task_number == task_number).first()

    def create_task(self, task_in: TaskCreate) -> Task:
        existing_task = self.get_task_by_number(task_in.task_number)
        if existing_task:
            raise ValueError(f"任务编号 {task_in.task_number} 已存在")

        expire_at = datetime.now() + timedelta(days=task_in.expire_days or settings.DEFAULT_ARCHIVE_DAYS)
        
        task = Task(
            task_number=task_in.task_number,
            task_name=task_in.task_name,
            description=task_in.description,
            status=TaskStatus.CREATED,
            archive_strategy=task_in.archive_strategy,
            access_level=task_in.access_level,
            owner=task_in.owner,
            expire_at=expire_at
        )
        self.db.add(task)
        self.db.flush()
        
        self._add_timeline(
            task_id=task.id,
            action="CREATE",
            status_before=None,
            status_after=TaskStatus.CREATED,
            operator=task_in.owner,
            description="创建任务",
            details={"archive_strategy": task_in.archive_strategy, "expire_days": task_in.expire_days}
        )
        
        self.db.commit()
        self.db.refresh(task)
        return task

    def register_output(self, task_number: str, register_in: TaskRegister) -> Task:
        task = self.get_task_by_number(task_number)
        if not task:
            raise ValueError(f"任务编号 {task_number} 不存在")

        if register_in.output_file_size <= 0:
            raise ValueError(f"文件大小必须为正数，当前值: {register_in.output_file_size}")

        if task.status in [TaskStatus.REGISTERED, TaskStatus.ARCHIVED]:
            if task.output_file_hash == register_in.output_file_hash:
                return task
            raise ValueError(f"任务 {task_number} 已登记输出，不允许重复提交不同文件")

        if task.status == TaskStatus.REVOKED:
            raise ValueError(f"任务 {task_number} 已撤销，不允许重新登记输出")

        if task.status != TaskStatus.CREATED:
            raise ValueError(f"任务 {task_number} 当前状态 {task.status} 不允许登记输出")

        self._check_permission(task, register_in.operator, "write")

        status_before = task.status
        
        task.output_file_path = register_in.output_file_path
        task.output_file_name = register_in.output_file_name
        task.output_file_size = register_in.output_file_size
        task.output_file_hash = register_in.output_file_hash
        task.status = TaskStatus.REGISTERED
        
        self.db.flush()
        
        self._add_timeline(
            task_id=task.id,
            action="REGISTER",
            status_before=status_before,
            status_after=TaskStatus.REGISTERED,
            operator=register_in.operator or task.owner,
            description="登记任务输出文件",
            details={
                "file_name": register_in.output_file_name,
                "file_size": register_in.output_file_size,
                "file_hash": register_in.output_file_hash
            }
        )
        
        if task.archive_strategy == ArchiveStrategy.IMMEDIATE:
            pass
        
        self.db.commit()
        self.db.refresh(task)
        return task

    def archive_task(self, task_number: str, archive_in: TaskArchive) -> Task:
        task = self.get_task_by_number(task_number)
        if not task:
            raise ValueError(f"任务编号 {task_number} 不存在")

        if task.status == TaskStatus.ARCHIVED:
            return task

        if task.status != TaskStatus.REGISTERED:
            raise ValueError(f"任务 {task_number} 当前状态 {task.status} 不允许归档")

        self._check_permission(task, archive_in.operator, "write")

        status_before = task.status
        
        archive_record = ArchiveRecord(
            task_id=task.id,
            source_location=task.output_file_path,
            target_location=archive_in.target_location,
            archive_size=task.output_file_size,
            operator=archive_in.operator or task.owner,
            is_successful=True
        )
        self.db.add(archive_record)
        
        task.archive_location = archive_in.target_location
        task.status = TaskStatus.ARCHIVED
        
        self.db.flush()
        
        self._add_timeline(
            task_id=task.id,
            action="ARCHIVE",
            status_before=status_before,
            status_after=TaskStatus.ARCHIVED,
            operator=archive_in.operator or task.owner,
            description="归档任务输出",
            details={
                "source_location": task.output_file_path,
                "target_location": archive_in.target_location,
                "archive_record_id": archive_record.id
            }
        )
        
        self.db.commit()
        self.db.refresh(task)
        return task

    def revoke_task(self, task_number: str, revoke_in: TaskRevoke) -> Task:
        task = self.get_task_by_number(task_number)
        if not task:
            raise ValueError(f"任务编号 {task_number} 不存在")

        if task.status == TaskStatus.REVOKED:
            return task

        if task.status not in [TaskStatus.CREATED, TaskStatus.REGISTERED, TaskStatus.ARCHIVED]:
            raise ValueError(f"任务 {task_number} 当前状态 {task.status} 不允许撤销")

        self._check_permission(task, revoke_in.operator, "admin")

        status_before = task.status
        task.status = TaskStatus.REVOKED
        
        self.db.flush()
        
        self._add_timeline(
            task_id=task.id,
            action="REVOKE",
            status_before=status_before,
            status_after=TaskStatus.REVOKED,
            operator=revoke_in.operator or task.owner,
            description=f"撤销任务: {revoke_in.reason}",
            details={"reason": revoke_in.reason}
        )
        
        self.db.commit()
        self.db.refresh(task)
        return task

    def get_task_detail(self, task_number: str, operator: Optional[str] = None) -> Task:
        task = self.get_task_by_number(task_number)
        if not task:
            raise ValueError(f"任务编号 {task_number} 不存在")

        return task

    def list_tasks(self, skip: int = 0, limit: int = 100, status: Optional[TaskStatus] = None,
                   owner: Optional[str] = None) -> tuple[int, List[Task]]:
        query = self.db.query(Task)
        
        if status:
            query = query.filter(Task.status == status)
        if owner:
            query = query.filter(Task.owner == owner)
            
        total = query.count()
        tasks = query.order_by(Task.created_at.desc()).offset(skip).limit(limit).all()
        
        return total, tasks

    def get_timelines(self, task_number: str) -> List[Timeline]:
        task = self.get_task_by_number(task_number)
        if not task:
            raise ValueError(f"任务编号 {task_number} 不存在")
        
        return self.db.query(Timeline).filter(Timeline.task_id == task.id).order_by(Timeline.timestamp.desc()).all()

    def expire_task(self, task_number: str, operator: Optional[str] = None) -> Task:
        task = self.get_task_by_number(task_number)
        if not task:
            raise ValueError(f"任务编号 {task_number} 不存在")

        if task.status == TaskStatus.EXPIRED:
            return task

        if task.status != TaskStatus.ARCHIVED:
            raise ValueError(f"任务 {task_number} 当前状态 {task.status} 不允许标记过期")

        if operator != "system":
            self._check_permission(task, operator, "write")

        status_before = task.status
        task.status = TaskStatus.EXPIRED
        
        self.db.flush()
        
        self._add_timeline(
            task_id=task.id,
            action="EXPIRE",
            status_before=status_before,
            status_after=TaskStatus.EXPIRED,
            operator=operator or "system",
            description="任务归档已过期"
        )
        
        self.db.commit()
        self.db.refresh(task)
        return task

    def cleanup_task(self, task_number: str, operator: Optional[str] = None, reason: str = "expired") -> Task:
        task = self.get_task_by_number(task_number)
        if not task:
            raise ValueError(f"任务编号 {task_number} 不存在")

        if task.status == TaskStatus.CLEANED:
            return task

        if task.status not in [TaskStatus.EXPIRED, TaskStatus.REVOKED]:
            raise ValueError(f"任务 {task_number} 当前状态 {task.status} 不允许清理")

        if operator != "system":
            self._check_permission(task, operator, "admin")

        status_before = task.status
        
        cleanup_record = CleanupRecord(
            task_id=task.id,
            cleaned_location=task.archive_location or task.output_file_path,
            cleanup_reason=reason,
            operator=operator or "system",
            is_successful=True
        )
        self.db.add(cleanup_record)
        
        task.status = TaskStatus.CLEANED
        
        self.db.flush()
        
        self._add_timeline(
            task_id=task.id,
            action="CLEANUP",
            status_before=status_before,
            status_after=TaskStatus.CLEANED,
            operator=operator or "system",
            description=f"清理任务文件: {reason}",
            details={"cleanup_record_id": cleanup_record.id, "reason": reason}
        )
        
        self.db.commit()
        self.db.refresh(task)
        return task

    def batch_cleanup_expired(self, operator: str = "system") -> List[Task]:
        now = datetime.now()
        expired_tasks = self.db.query(Task).filter(
            and_(
                Task.status == TaskStatus.ARCHIVED,
                Task.expire_at <= now
            )
        ).limit(settings.CLEANUP_BATCH_SIZE).all()
        
        cleaned_tasks = []
        for task in expired_tasks:
            try:
                self.expire_task(task.task_number, operator)
                cleaned_task = self.cleanup_task(task.task_number, operator, "auto_expired")
                cleaned_tasks.append(cleaned_task)
            except Exception as e:
                self.db.rollback()
                continue
        
        return cleaned_tasks
