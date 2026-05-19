from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from models import (
    TrialRecord, Tenant, RecycleTask, EquitySnapshot, OperationLog,
    TrialStatus, SourceType, FeaturePackage
)


class TrialStateMachine:
    STATE_TRANSITIONS = {
        TrialStatus.PENDING: [TrialStatus.ACTIVE, TrialStatus.CLOSED],
        TrialStatus.ACTIVE: [TrialStatus.EXPIRING, TrialStatus.EXPIRED, TrialStatus.CLOSED],
        TrialStatus.EXPIRING: [TrialStatus.EXPIRED, TrialStatus.CLOSED],
        TrialStatus.EXPIRED: [TrialStatus.RECYCLING, TrialStatus.CLOSED],
        TrialStatus.RECYCLING: [TrialStatus.RECYCLED, TrialStatus.CLOSED],
        TrialStatus.RECYCLED: [TrialStatus.CLOSED],
        TrialStatus.CLOSED: []
    }

    @classmethod
    def can_transition(cls, from_status: TrialStatus, to_status: TrialStatus) -> bool:
        return to_status in cls.STATE_TRANSITIONS.get(from_status, [])

    @classmethod
    def get_next_state(cls, current_status: TrialStatus) -> Optional[TrialStatus]:
        progression = [
            TrialStatus.PENDING,
            TrialStatus.ACTIVE,
            TrialStatus.EXPIRING,
            TrialStatus.EXPIRED,
            TrialStatus.RECYCLING,
            TrialStatus.RECYCLED
        ]
        try:
            current_index = progression.index(current_status)
            if current_index + 1 < len(progression):
                return progression[current_index + 1]
        except ValueError:
            pass
        return None


class TrialService:
    def __init__(self, db: Session):
        self.db = db

    def _ensure_tenant_exists(self, tenant_id: str, tenant_name: str = None) -> Tenant:
        tenant = self.db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            tenant = Tenant(tenant_id=tenant_id, tenant_name=tenant_name or tenant_id)
            self.db.add(tenant)
            self.db.flush()
        return tenant

    def _log_operation(
        self,
        trial_id: int,
        operation_type: str,
        operated_by: str,
        old_status: str = None,
        new_status: str = None,
        original_input: Dict[str, Any] = None,
        reason: str = None,
        conclusion: str = None
    ):
        log = OperationLog(
            trial_id=trial_id,
            operation_type=operation_type,
            old_status=old_status,
            new_status=new_status,
            original_input=original_input,
            operated_by=operated_by,
            reason=reason,
            conclusion=conclusion
        )
        self.db.add(log)
        self.db.flush()

    def create_trial(
        self,
        tenant_id: str,
        feature_package: str,
        trial_days: int,
        source: str,
        source_id: str,
        created_by: str,
        tenant_name: str = None,
        start_date: datetime = None,
        remarks: str = None
    ) -> tuple[TrialRecord, bool]:
        existing_trial = self.db.query(TrialRecord).filter(
            TrialRecord.tenant_id == tenant_id,
            TrialRecord.feature_package == feature_package,
            TrialRecord.source == source,
            TrialRecord.source_id == source_id,
            TrialRecord.status != TrialStatus.CLOSED.value
        ).first()

        if existing_trial:
            self._log_operation(
                trial_id=existing_trial.id,
                operation_type="DUPLICATE_CREATE",
                operated_by=created_by,
                old_status=existing_trial.status,
                new_status=existing_trial.status,
                original_input={
                    "tenant_id": tenant_id,
                    "feature_package": feature_package,
                    "trial_days": trial_days,
                    "source": source,
                    "source_id": source_id
                },
                conclusion="幂等处理：返回已存在记录"
            )
            return existing_trial, False

        self._ensure_tenant_exists(tenant_id, tenant_name)

        trial = TrialRecord(
            tenant_id=tenant_id,
            feature_package=feature_package,
            trial_days=trial_days,
            source=source,
            source_id=source_id,
            created_by=created_by,
            status=TrialStatus.PENDING.value,
            start_date=start_date or datetime.utcnow(),
            remarks=remarks
        )
        trial.calculate_end_date()

        self.db.add(trial)
        self.db.flush()

        self._log_operation(
            trial_id=trial.id,
            operation_type="CREATE",
            operated_by=created_by,
            new_status=trial.status,
            original_input={
                "tenant_id": tenant_id,
                "feature_package": feature_package,
                "trial_days": trial_days,
                "source": source,
                "source_id": source_id
            },
            conclusion="试用创建成功"
        )

        return trial, True

    def advance_status(self, trial_id: int, operated_by: str) -> TrialRecord:
        trial = self.db.query(TrialRecord).filter(TrialRecord.id == trial_id).first()
        if not trial:
            raise ValueError(f"Trial record {trial_id} not found")

        current_status = TrialStatus(trial.status)
        next_status = TrialStateMachine.get_next_state(current_status)

        if not next_status:
            raise ValueError(f"Cannot advance from status {current_status}")

        if not TrialStateMachine.can_transition(current_status, next_status):
            raise ValueError(f"Invalid state transition: {current_status} -> {next_status}")

        old_status = trial.status
        trial.status = next_status.value
        trial.updated_at = datetime.utcnow()

        self._log_operation(
            trial_id=trial.id,
            operation_type="STATUS_ADVANCE",
            operated_by=operated_by,
            old_status=old_status,
            new_status=trial.status,
            conclusion=f"状态自动推进: {old_status} -> {trial.status}"
        )

        if next_status == TrialStatus.EXPIRED:
            self._create_recycle_task(trial_id, operated_by)

        self.db.flush()
        return trial

    def _create_recycle_task(self, trial_id: int, operated_by: str):
        task = RecycleTask(
            trial_id=trial_id,
            scheduled_time=datetime.utcnow() + timedelta(hours=24),
            executed_by=operated_by
        )
        self.db.add(task)

    def correct_status(
        self,
        trial_id: int,
        new_status: str,
        reason: str,
        operated_by: str
    ) -> TrialRecord:
        trial = self.db.query(TrialRecord).filter(TrialRecord.id == trial_id).first()
        if not trial:
            raise ValueError(f"Trial record {trial_id} not found")

        old_status = trial.status
        trial.status = new_status
        trial.updated_at = datetime.utcnow()

        self._log_operation(
            trial_id=trial.id,
            operation_type="MANUAL_CORRECTION",
            operated_by=operated_by,
            old_status=old_status,
            new_status=new_status,
            reason=reason,
            conclusion=f"人工修正状态: {old_status} -> {new_status}"
        )

        self.db.flush()
        return trial

    def close_trial(self, trial_id: int, reason: str, operated_by: str) -> TrialRecord:
        trial = self.db.query(TrialRecord).filter(TrialRecord.id == trial_id).first()
        if not trial:
            raise ValueError(f"Trial record {trial_id} not found")

        if trial.status == TrialStatus.CLOSED.value:
            raise ValueError(f"Trial record {trial_id} is already closed")

        old_status = trial.status
        trial.status = TrialStatus.CLOSED.value
        trial.updated_at = datetime.utcnow()

        self._log_operation(
            trial_id=trial.id,
            operation_type="CLOSE",
            operated_by=operated_by,
            old_status=old_status,
            new_status=TrialStatus.CLOSED.value,
            reason=reason,
            conclusion="试用已关闭/撤回"
        )

        self.db.flush()
        return trial

    def get_trial(self, trial_id: int) -> Optional[TrialRecord]:
        return self.db.query(TrialRecord).filter(TrialRecord.id == trial_id).first()

    def list_trials(
        self,
        tenant_id: str = None,
        status: str = None,
        source: str = None,
        feature_package: str = None,
        skip: int = 0,
        limit: int = 100
    ):
        query = self.db.query(TrialRecord)

        if tenant_id:
            query = query.filter(TrialRecord.tenant_id == tenant_id)
        if status:
            query = query.filter(TrialRecord.status == status)
        if source:
            query = query.filter(TrialRecord.source == source)
        if feature_package:
            query = query.filter(TrialRecord.feature_package == feature_package)

        return query.order_by(TrialRecord.created_at.desc()).offset(skip).limit(limit).all()

    def create_snapshot(self, trial_id: int, generated_by: str) -> EquitySnapshot:
        trial = self.db.query(TrialRecord).filter(TrialRecord.id == trial_id).first()
        if not trial:
            raise ValueError(f"Trial record {trial_id} not found")

        snapshot_data = {
            "trial_id": trial.id,
            "tenant_id": trial.tenant_id,
            "feature_package": trial.feature_package,
            "status": trial.status,
            "trial_days": trial.trial_days,
            "start_date": trial.start_date.isoformat() if trial.start_date else None,
            "end_date": trial.end_date.isoformat() if trial.end_date else None,
            "source": trial.source,
            "source_id": trial.source_id,
            "created_by": trial.created_by,
            "created_at": trial.created_at.isoformat() if trial.created_at else None,
            "snapshot_time": datetime.utcnow().isoformat()
        }

        snapshot = EquitySnapshot(
            trial_id=trial_id,
            snapshot_type="FULL_EXPORT",
            snapshot_data=snapshot_data,
            generated_by=generated_by
        )

        self.db.add(snapshot)
        self.db.flush()

        self._log_operation(
            trial_id=trial_id,
            operation_type="SNAPSHOT",
            operated_by=generated_by,
            old_status=trial.status,
            new_status=trial.status,
            conclusion="权益快照已生成"
        )

        return snapshot

    def get_operation_logs(self, trial_id: int, skip: int = 0, limit: int = 100):
        return self.db.query(OperationLog).filter(
            OperationLog.trial_id == trial_id
        ).order_by(OperationLog.created_at.desc()).offset(skip).limit(limit).all()

    def execute_recycle_task(self, task_id: int, operated_by: str) -> RecycleTask:
        task = self.db.query(RecycleTask).filter(RecycleTask.id == task_id).first()
        if not task:
            raise ValueError(f"Recycle task {task_id} not found")

        if task.task_status != "PENDING":
            raise ValueError(f"Recycle task {task_id} is not pending")

        trial = self.db.query(TrialRecord).filter(TrialRecord.id == task.trial_id).first()
        if trial and trial.status != TrialStatus.RECYCLING.value:
            trial.status = TrialStatus.RECYCLING.value

        task.executed_time = datetime.utcnow()
        task.executed_by = operated_by
        task.task_status = "COMPLETED"
        task.result = "回收任务执行成功，权益已回收"

        if trial:
            trial.status = TrialStatus.RECYCLED.value
            self._log_operation(
                trial_id=trial.id,
                operation_type="RECYCLE",
                operated_by=operated_by,
                old_status=TrialStatus.RECYCLING.value,
                new_status=TrialStatus.RECYCLED.value,
                conclusion="权益回收完成"
            )

        self.db.flush()
        return task
