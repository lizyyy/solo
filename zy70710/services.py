from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from models import BatchTask, ImpactItem, RecoveryLock, TaskStatus, RecoveryAction
from schemas import BatchTaskCreate, BatchTaskUpdateStatus, BatchTaskMarkMissed, BatchTaskRecover, ImpactItemCreate
from exceptions import (
    InvalidStatusException,
    NeedsReviewException,
    AlreadyProcessedException,
    RecoveryLockException,
    TaskNotFoundException,
    MissingFieldException
)


class TaskService:
    def __init__(self, db: Session):
        self.db = db

    def create_task(self, task_data: BatchTaskCreate) -> BatchTask:
        task = BatchTask(
            task_name=task_data.task_name,
            planned_time=task_data.planned_time,
            status=TaskStatus.PENDING
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def get_task(self, task_id: int) -> Optional[BatchTask]:
        return self.db.query(BatchTask).filter(BatchTask.id == task_id).first()

    def get_task_or_404(self, task_id: int) -> BatchTask:
        task = self.get_task(task_id)
        if not task:
            raise TaskNotFoundException(task_id)
        return task

    def list_tasks(
        self,
        status: Optional[TaskStatus] = None,
        task_name: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100
    ) -> tuple[List[BatchTask], int]:
        query = self.db.query(BatchTask)

        if status:
            query = query.filter(BatchTask.status == status)
        if task_name:
            query = query.filter(BatchTask.task_name.contains(task_name))
        if start_time:
            query = query.filter(BatchTask.planned_time >= start_time)
        if end_time:
            query = query.filter(BatchTask.planned_time <= end_time)

        total = query.count()
        tasks = query.order_by(BatchTask.planned_time.desc()).offset(skip).limit(limit).all()
        return tasks, total

    def update_task_status(self, task_id: int, status_data: BatchTaskUpdateStatus) -> BatchTask:
        task = self.get_task_or_404(task_id)

        allowed_transitions = {
            TaskStatus.PENDING: [TaskStatus.RUNNING, TaskStatus.MISSED],
            TaskStatus.RUNNING: [TaskStatus.COMPLETED, TaskStatus.FAILED],
            TaskStatus.FAILED: [TaskStatus.MISSED, TaskStatus.RUNNING],
            TaskStatus.MISSED: [TaskStatus.RECOVERING],
            TaskStatus.RECOVERING: [TaskStatus.RECOVERED, TaskStatus.NEEDS_REVIEW],
            TaskStatus.NEEDS_REVIEW: [TaskStatus.RECOVERING, TaskStatus.RECOVERED],
        }

        if task.status not in allowed_transitions:
            raise InvalidStatusException(task.status, list(allowed_transitions.keys()))

        if status_data.status not in allowed_transitions.get(task.status, []):
            raise InvalidStatusException(status_data.status, allowed_transitions.get(task.status, []))

        task.status = status_data.status
        if status_data.actual_start_time:
            task.actual_start_time = status_data.actual_start_time
        if status_data.actual_end_time:
            task.actual_end_time = status_data.actual_end_time

        self.db.commit()
        self.db.refresh(task)
        return task

    def detect_missed_tasks(self, grace_minutes: int = 30) -> List[BatchTask]:
        cutoff_time = datetime.now() - timedelta(minutes=grace_minutes)

        missed_tasks = self.db.query(BatchTask).filter(
            and_(
                BatchTask.status.in_([TaskStatus.PENDING, TaskStatus.RUNNING]),
                BatchTask.planned_time < cutoff_time
            )
        ).all()

        for task in missed_tasks:
            task.status = TaskStatus.MISSED
            task.missed_reason = "自动检测: 任务未在计划时间后30分钟内完成"

        self.db.commit()
        return missed_tasks

    def mark_task_missed(self, task_id: int, missed_data: BatchTaskMarkMissed) -> BatchTask:
        task = self.get_task_or_404(task_id)

        if task.status in [TaskStatus.RECOVERED, TaskStatus.MISSED]:
            raise AlreadyProcessedException(task.task_name)

        if task.status not in [TaskStatus.PENDING, TaskStatus.RUNNING, TaskStatus.FAILED]:
            raise InvalidStatusException(task.status, [TaskStatus.PENDING, TaskStatus.RUNNING, TaskStatus.FAILED])

        task.status = TaskStatus.MISSED
        task.missed_reason = missed_data.missed_reason

        self.db.commit()
        self.db.refresh(task)
        return task

    def acquire_recovery_lock(self, task_name: str, locked_by: str, lock_duration_minutes: int = 30) -> bool:
        now = datetime.now()
        existing_lock = self.db.query(RecoveryLock).filter(
            and_(
                RecoveryLock.task_name == task_name,
                RecoveryLock.lock_expire_at > now
            )
        ).first()

        if existing_lock:
            raise RecoveryLockException(
                task_name=task_name,
                locked_by=existing_lock.locked_by,
                locked_at=existing_lock.locked_at.isoformat()
            )

        self.db.query(RecoveryLock).filter(RecoveryLock.task_name == task_name).delete()

        new_lock = RecoveryLock(
            task_name=task_name,
            locked_by=locked_by,
            lock_expire_at=now + timedelta(minutes=lock_duration_minutes)
        )
        self.db.add(new_lock)
        self.db.commit()
        return True

    def release_recovery_lock(self, task_name: str) -> None:
        self.db.query(RecoveryLock).filter(RecoveryLock.task_name == task_name).delete()
        self.db.commit()

    def recover_task(self, task_id: int, recover_data: BatchTaskRecover) -> BatchTask:
        task = self.get_task_or_404(task_id)

        if task.status == TaskStatus.RECOVERED:
            raise AlreadyProcessedException(task.task_name)

        if task.status == TaskStatus.RECOVERING:
            raise InvalidStatusException(
                task.status,
                [TaskStatus.MISSED, TaskStatus.NEEDS_REVIEW],
                "任务正在恢复中，请等待完成或先释放锁"
            )

        if task.status not in [TaskStatus.MISSED, TaskStatus.NEEDS_REVIEW]:
            raise InvalidStatusException(task.status, [TaskStatus.MISSED, TaskStatus.NEEDS_REVIEW])

        self.acquire_recovery_lock(task.task_name, recover_data.recovered_by)

        try:
            task.status = TaskStatus.RECOVERING
            task.recovery_action = recover_data.recovery_action
            task.recovered_by = recover_data.recovered_by
            task.recovery_time = datetime.now()

            self.db.commit()

            if recover_data.impact_items:
                for item_data in recover_data.impact_items:
                    impact_item = ImpactItem(
                        batch_task_id=task.id,
                        impact_type=item_data.impact_type,
                        impact_description=item_data.impact_description,
                        affected_data=item_data.affected_data,
                        affected_range=item_data.affected_range,
                        severity=item_data.severity,
                        resolution_note=item_data.resolution_note
                    )
                    self.db.add(impact_item)

            task.is_impact_calculated = recover_data.impact_items is not None and len(recover_data.impact_items) > 0
            task.status = TaskStatus.RECOVERED

            self.db.commit()
            self.db.refresh(task)

        finally:
            self.release_recovery_lock(task.task_name)

        return task

    def request_review(self, task_id: int, reason: str) -> BatchTask:
        task = self.get_task_or_404(task_id)

        if task.status not in [TaskStatus.RECOVERING, TaskStatus.MISSED]:
            raise InvalidStatusException(task.status, [TaskStatus.RECOVERING, TaskStatus.MISSED])

        task.status = TaskStatus.NEEDS_REVIEW

        self.db.commit()
        self.db.refresh(task)

        raise NeedsReviewException(task.task_name, reason)

    def calculate_impact(self, task_id: int) -> List[ImpactItem]:
        task = self.get_task_or_404(task_id)

        if task.status not in [TaskStatus.MISSED, TaskStatus.RECOVERING, TaskStatus.NEEDS_REVIEW]:
            raise InvalidStatusException(task.status, [TaskStatus.MISSED, TaskStatus.RECOVERING, TaskStatus.NEEDS_REVIEW])

        existing_impacts = self.db.query(ImpactItem).filter(ImpactItem.batch_task_id == task_id).all()
        if existing_impacts:
            return existing_impacts

        impact_items = []

        if "日结" in task.task_name or "日报" in task.task_name:
            impact_items.append(ImpactItem(
                batch_task_id=task.id,
                impact_type="数据延迟",
                impact_description="财务日报数据延迟生成，可能影响管理层决策",
                affected_range="全公司",
                severity="high"
            ))
            impact_items.append(ImpactItem(
                batch_task_id=task.id,
                impact_type="报表延迟",
                impact_description="相关财务报表无法按时生成",
                affected_range="财务部门",
                severity="medium"
            ))

        if "对账" in task.task_name or "核算" in task.task_name:
            impact_items.append(ImpactItem(
                batch_task_id=task.id,
                impact_type="对账延迟",
                impact_description="账目核对延迟，可能影响结账时间",
                affected_range="财务核算组",
                severity="high"
            ))

        if "支付" in task.task_name or "付款" in task.task_name:
            impact_items.append(ImpactItem(
                batch_task_id=task.id,
                impact_type="付款延迟",
                impact_description="供应商付款可能延迟，影响供应商关系",
                affected_range="供应商",
                severity="high"
            ))

        if not impact_items:
            impact_items.append(ImpactItem(
                batch_task_id=task.id,
                impact_type="任务执行失败",
                impact_description=f"任务 '{task.task_name}' 漏跑，需要评估具体影响",
                affected_range="待评估",
                severity="medium"
            ))

        for item in impact_items:
            self.db.add(item)

        task.is_impact_calculated = True
        self.db.commit()

        return impact_items

    def generate_recovery_report(self, task_id: int) -> dict:
        task = self.get_task_or_404(task_id)

        if task.status != TaskStatus.RECOVERED:
            raise InvalidStatusException(task.status, [TaskStatus.RECOVERED], "只能对已恢复的任务生成报告")

        impact_items = self.db.query(ImpactItem).filter(ImpactItem.batch_task_id == task_id).all()

        impact_summary = {}
        for item in impact_items:
            severity = item.severity
            if severity not in impact_summary:
                impact_summary[severity] = {"count": 0, "types": []}
            impact_summary[severity]["count"] += 1
            if item.impact_type not in impact_summary[severity]["types"]:
                impact_summary[severity]["types"].append(item.impact_type)

        return {
            "task_id": task.id,
            "task_name": task.task_name,
            "planned_time": task.planned_time,
            "missed_reason": task.missed_reason,
            "recovery_action": task.recovery_action,
            "recovery_time": task.recovery_time,
            "recovered_by": task.recovered_by,
            "impact_count": len(impact_items),
            "impact_summary": impact_summary
        }

    def add_impact_item(self, task_id: int, impact_data: ImpactItemCreate) -> ImpactItem:
        task = self.get_task_or_404(task_id)

        impact_item = ImpactItem(
            batch_task_id=task.id,
            impact_type=impact_data.impact_type,
            impact_description=impact_data.impact_description,
            affected_data=impact_data.affected_data,
            affected_range=impact_data.affected_range,
            severity=impact_data.severity,
            resolution_note=impact_data.resolution_note
        )

        self.db.add(impact_item)
        task.is_impact_calculated = True
        self.db.commit()
        self.db.refresh(impact_item)

        return impact_item

    def bulk_import_tasks(self, tasks_data: List[BatchTaskCreate]) -> List[BatchTask]:
        tasks = []
        for task_data in tasks_data:
            task = BatchTask(
                task_name=task_data.task_name,
                planned_time=task_data.planned_time,
                status=TaskStatus.PENDING
            )
            self.db.add(task)
            tasks.append(task)

        self.db.commit()
        for task in tasks:
            self.db.refresh(task)

        return tasks
