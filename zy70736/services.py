from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from models import Domain, SwitchRecord, HealthCheck, OperationLog
from models import SwitchStatus, HealthStatus
import schemas


class SwitchStateMachine:
    VALID_TRANSITIONS = {
        SwitchStatus.PENDING: [SwitchStatus.SWITCHED, SwitchStatus.CANCELLED],
        SwitchStatus.SWITCHED: [SwitchStatus.HEALTH_CHECKING, SwitchStatus.CLOSED, SwitchStatus.CANCELLED],
        SwitchStatus.HEALTH_CHECKING: [SwitchStatus.READY_TO_RESTORE, SwitchStatus.SWITCHED, SwitchStatus.CLOSED],
        SwitchStatus.READY_TO_RESTORE: [SwitchStatus.RESTORED, SwitchStatus.SWITCHED, SwitchStatus.CLOSED],
        SwitchStatus.RESTORED: [SwitchStatus.CLOSED],
        SwitchStatus.CANCELLED: [],
        SwitchStatus.CLOSED: []
    }

    @classmethod
    def can_transition(cls, current_status: SwitchStatus, target_status: SwitchStatus) -> bool:
        return target_status in cls.VALID_TRANSITIONS.get(current_status, [])


def check_idempotency(db: Session, domain_id: int, created_by: str, switch_reason: str) -> Optional[SwitchRecord]:
    five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
    existing = db.query(SwitchRecord).filter(
        SwitchRecord.domain_id == domain_id,
        SwitchRecord.created_by == created_by,
        SwitchRecord.switch_reason == switch_reason,
        SwitchRecord.created_at >= five_minutes_ago
    ).first()
    return existing


def create_switch_record(db: Session, switch: schemas.SwitchRecordCreate) -> SwitchRecord:
    existing = check_idempotency(db, switch.domain_id, switch.created_by, switch.switch_reason)
    if existing:
        return existing

    db_switch = SwitchRecord(**switch.dict())
    db.add(db_switch)
    db.commit()
    db.refresh(db_switch)
    return db_switch


def transition_status(
    db: Session,
    switch_record: SwitchRecord,
    target_status: SwitchStatus,
    operator: str,
    reason: str,
    original_input: Optional[str] = None
) -> Optional[SwitchRecord]:
    current_status = SwitchStatus(switch_record.status)
    
    if not SwitchStateMachine.can_transition(current_status, target_status):
        return None

    switch_record.status = target_status
    
    if target_status == SwitchStatus.SWITCHED and not switch_record.switched_at:
        switch_record.switched_at = datetime.utcnow()
    elif target_status == SwitchStatus.RESTORED and not switch_record.restored_at:
        switch_record.restored_at = datetime.utcnow()

    log_operation(db, switch_record.id, f"STATUS_TRANSITION", operator, original_input, reason)
    db.commit()
    db.refresh(switch_record)
    return switch_record


def force_transition_status(
    db: Session,
    switch_record: SwitchRecord,
    target_status: SwitchStatus,
    operator: str,
    reason: str,
    original_input: Optional[str] = None
) -> SwitchRecord:
    current_status = SwitchStatus(switch_record.status)
    
    switch_record.status = target_status
    
    if target_status == SwitchStatus.SWITCHED and not switch_record.switched_at:
        switch_record.switched_at = datetime.utcnow()
    elif target_status == SwitchStatus.RESTORED and not switch_record.restored_at:
        switch_record.restored_at = datetime.utcnow()

    log_operation(db, switch_record.id, "MANUAL_CORRECT", operator, original_input, reason)
    db.commit()
    db.refresh(switch_record)
    return switch_record


def log_operation(
    db: Session,
    switch_record_id: int,
    operation_type: str,
    operator: str,
    original_input: Optional[str] = None,
    conclusion: Optional[str] = None
) -> OperationLog:
    db_log = OperationLog(
        switch_record_id=switch_record_id,
        operation_type=operation_type,
        operator=operator,
        original_input=original_input,
        conclusion=conclusion
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


def add_health_check(db: Session, health_check: schemas.HealthCheckCreate) -> HealthCheck:
    db_check = HealthCheck(**health_check.dict())
    db.add(db_check)
    db.commit()
    db.refresh(db_check)
    return db_check


def evaluate_health_status(db: Session, switch_record: SwitchRecord) -> HealthStatus:
    domain = db.query(Domain).filter(Domain.id == switch_record.domain_id).first()
    if not domain:
        return HealthStatus.UNKNOWN

    recent_checks = db.query(HealthCheck).filter(
        HealthCheck.switch_record_id == switch_record.id,
        HealthCheck.target_origin == domain.primary_origin
    ).order_by(HealthCheck.check_time.desc()).limit(domain.success_threshold).all()

    if len(recent_checks) < domain.success_threshold:
        return HealthStatus.UNKNOWN

    successful = sum(1 for check in recent_checks if check.status == HealthStatus.HEALTHY)
    if successful >= domain.success_threshold:
        return HealthStatus.HEALTHY

    failed = sum(1 for check in recent_checks if check.status == HealthStatus.UNHEALTHY)
    if failed >= domain.failure_threshold:
        return HealthStatus.UNHEALTHY

    return HealthStatus.UNKNOWN


def should_restore(db: Session, switch_record: SwitchRecord) -> bool:
    if switch_record.status != SwitchStatus.HEALTH_CHECKING:
        return False

    health_status = evaluate_health_status(db, switch_record)
    return health_status == HealthStatus.HEALTHY


def get_switch_report(db: Session, switch_record_id: int) -> Optional[schemas.SwitchReport]:
    switch_record = db.query(SwitchRecord).filter(SwitchRecord.id == switch_record_id).first()
    if not switch_record:
        return None

    domain = db.query(Domain).filter(Domain.id == switch_record.domain_id).first()
    health_checks = db.query(HealthCheck).filter(HealthCheck.switch_record_id == switch_record_id).all()
    operations = db.query(OperationLog).filter(OperationLog.switch_record_id == switch_record_id).all()

    total_checks = len(health_checks)
    successful_checks = sum(1 for c in health_checks if c.status == HealthStatus.HEALTHY)
    failed_checks = total_checks - successful_checks

    return schemas.SwitchReport(
        switch_record_id=switch_record.id,
        domain_name=domain.domain_name,
        primary_origin=domain.primary_origin,
        backup_origin=domain.backup_origin,
        switch_reason=switch_record.switch_reason,
        restore_condition=switch_record.restore_condition,
        status=SwitchStatus(switch_record.status),
        created_by=switch_record.created_by,
        created_at=switch_record.created_at,
        switched_at=switch_record.switched_at,
        restored_at=switch_record.restored_at,
        total_health_checks=total_checks,
        successful_checks=successful_checks,
        failed_checks=failed_checks,
        operations=operations
    )


def get_active_switch_for_domain(db: Session, domain_id: int) -> Optional[SwitchRecord]:
    return db.query(SwitchRecord).filter(
        SwitchRecord.domain_id == domain_id,
        SwitchRecord.status.in_([
            SwitchStatus.PENDING,
            SwitchStatus.SWITCHED,
            SwitchStatus.HEALTH_CHECKING,
            SwitchStatus.READY_TO_RESTORE
        ])
    ).first()


def check_restore_reminders(db: Session) -> List[SwitchRecord]:
    ready_switches = db.query(SwitchRecord).filter(
        SwitchRecord.status == SwitchStatus.READY_TO_RESTORE
    ).all()

    health_checking = db.query(SwitchRecord).filter(
        SwitchRecord.status == SwitchStatus.HEALTH_CHECKING
    ).all()

    ready_to_restore = []
    for switch in health_checking:
        if should_restore(db, switch):
            ready_to_restore.append(switch)

    return ready_switches + ready_to_restore