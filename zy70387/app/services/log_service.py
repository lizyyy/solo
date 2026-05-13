from typing import Tuple, List, Optional
from datetime import datetime, date
from sqlalchemy.orm import Session

from app.models import TaskLog, LogStatistics, DroppedLog
from app.schemas import TaskLogCreate, LogWriteResult
from app.services.sampling_engine import SamplingEngine, SamplingDecision


class LogService:
    def __init__(self, db: Session):
        self.db = db
        self.engine = SamplingEngine(db)

    def _update_statistics(
        self,
        tenant_id: str,
        task_type: str,
        is_sampled: bool,
        is_dropped: bool,
        is_duplicate: bool,
        is_failure: bool,
        is_failure_context: bool,
        rule_id: Optional[int] = None,
        rule_version: Optional[int] = None,
        stat_date: Optional[date] = None
    ):
        if stat_date is None:
            stat_date = datetime.utcnow().date()
        
        stats = (
            self.db.query(LogStatistics)
            .filter(
                LogStatistics.stat_date == stat_date,
                LogStatistics.tenant_id == tenant_id,
                LogStatistics.task_type == task_type
            )
            .first()
        )
        
        if stats is None:
            stats = LogStatistics(
                stat_date=stat_date,
                tenant_id=tenant_id,
                task_type=task_type,
                total_logs=0,
                sampled_logs=0,
                dropped_logs=0,
                duplicate_logs=0,
                failure_logs=0,
                failure_context_logs=0,
                rule_id=rule_id,
                rule_version=rule_version
            )
            self.db.add(stats)
        
        stats.total_logs += 1
        if is_sampled:
            stats.sampled_logs += 1
        if is_dropped:
            stats.dropped_logs += 1
        if is_duplicate:
            stats.duplicate_logs += 1
        if is_failure:
            stats.failure_logs += 1
        if is_failure_context:
            stats.failure_context_logs += 1
        
        self.db.commit()

    def _record_dropped_log(
        self,
        tenant_id: str,
        task_type: str,
        drop_reason: str,
        rule_id: Optional[int] = None,
        rule_version: Optional[int] = None
    ):
        dropped = DroppedLog(
            tenant_id=tenant_id,
            task_type=task_type,
            drop_reason=drop_reason,
            drop_count=1,
            rule_id=rule_id,
            rule_version=rule_version
        )
        self.db.add(dropped)
        self.db.commit()

    def write_log(self, log_data: TaskLogCreate) -> LogWriteResult:
        current_time = log_data.timestamp or datetime.utcnow()
        
        decision = self.engine.decide(log_data, current_time)
        
        rule_id = decision.rule.id if decision.rule and decision.rule.id != 0 else None
        rule_version = decision.rule.version if decision.rule else 1
        rule_name = decision.rule.name if decision.rule else "默认规则"
        
        self._update_statistics(
            tenant_id=log_data.tenant_id,
            task_type=log_data.task_type,
            is_sampled=decision.is_sampled,
            is_dropped=not decision.should_save,
            is_duplicate=decision.reason == "duplicate_log",
            is_failure=log_data.is_failure,
            is_failure_context=False,
            rule_id=rule_id,
            rule_version=rule_version,
            stat_date=current_time.date()
        )
        
        if not decision.should_save:
            self._record_dropped_log(
                tenant_id=log_data.tenant_id,
                task_type=log_data.task_type,
                drop_reason=decision.reason,
                rule_id=rule_id,
                rule_version=rule_version
            )
            return LogWriteResult(
                success=True,
                saved=False,
                reason=decision.reason,
                rule_id=rule_id,
                rule_name=rule_name,
                is_sampled=False,
                is_failure_context=False,
                message=decision.explanation
            )
        
        content_hash = self.engine._calculate_hash(log_data)
        
        task_log = TaskLog(
            task_id=log_data.task_id,
            tenant_id=log_data.tenant_id,
            task_type=log_data.task_type,
            log_level=log_data.log_level,
            message=log_data.message,
            timestamp=current_time,
            is_success=log_data.is_success,
            is_failure=log_data.is_failure,
            is_sampled=decision.is_sampled,
            is_failure_context=False,
            rule_id=rule_id,
            rule_version=rule_version,
            content_hash=content_hash
        )
        
        self.db.add(task_log)
        self.db.commit()
        self.db.refresh(task_log)
        
        if log_data.is_failure and decision.rule:
            contexts = self.engine.get_failure_context_to_save(
                log_data, decision.rule
            )
            for ctx_log, explanation in contexts:
                ctx_log.is_failure_context = True
                ctx_log.context_for_failure_id = task_log.id
                self._update_statistics(
                    tenant_id=ctx_log.tenant_id,
                    task_type=ctx_log.task_type,
                    is_sampled=False,
                    is_dropped=False,
                    is_duplicate=False,
                    is_failure=False,
                    is_failure_context=True,
                    rule_id=rule_id,
                    rule_version=rule_version,
                    stat_date=ctx_log.timestamp.date() if ctx_log.timestamp else current_time.date()
                )
            self.db.commit()
        
        return LogWriteResult(
            success=True,
            saved=True,
            reason=decision.reason,
            rule_id=rule_id,
            rule_name=rule_name,
            is_sampled=decision.is_sampled,
            is_failure_context=False,
            message=decision.explanation
        )

    def get_logs(
        self,
        tenant_id: Optional[str] = None,
        task_type: Optional[str] = None,
        task_id: Optional[str] = None,
        is_sampled: Optional[bool] = None,
        is_failure: Optional[bool] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Tuple[List[TaskLog], int]:
        query = self.db.query(TaskLog)
        
        if tenant_id:
            query = query.filter(TaskLog.tenant_id == tenant_id)
        if task_type:
            query = query.filter(TaskLog.task_type == task_type)
        if task_id:
            query = query.filter(TaskLog.task_id == task_id)
        if is_sampled is not None:
            query = query.filter(TaskLog.is_sampled == is_sampled)
        if is_failure is not None:
            query = query.filter(TaskLog.is_failure == is_failure)
        if start_time:
            query = query.filter(TaskLog.timestamp >= start_time)
        if end_time:
            query = query.filter(TaskLog.timestamp <= end_time)
        
        total = query.count()
        logs = (
            query.order_by(TaskLog.timestamp.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        
        return logs, total

    def get_failure_context(self, failure_log_id: int) -> List[TaskLog]:
        return (
            self.db.query(TaskLog)
            .filter(TaskLog.context_for_failure_id == failure_log_id)
            .order_by(TaskLog.timestamp.asc())
            .all()
        )
