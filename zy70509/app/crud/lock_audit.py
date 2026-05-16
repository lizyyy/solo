from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func, text
from app.models.lock_audit import (
    LockAudit, RenewHistory, PhaseHistory, FailureRecord, ManualCorrection,
    LockStatus, ExecutionPhase, ReleaseReason
)
from app.schemas.lock_audit import (
    LockAuditCreate, RenewRequest, PhaseUpdateRequest, FailureRecordRequest,
    ManualCorrectionRequest, LockReleaseRequest, LockAuditQuery, ExportRequest
)


def create_lock_audit(db: Session, audit_in: LockAuditCreate) -> LockAudit:
    now = datetime.now()
    expired_at = now + timedelta(seconds=audit_in.ttl_seconds)
    
    db_audit = LockAudit(
        task_name=audit_in.task_name,
        lock_key=audit_in.lock_key,
        status=LockStatus.ACQUIRED,
        execution_phase=ExecutionPhase.LOCK_ACQUIRE,
        acquired_at=now,
        last_renewed_at=now,
        expired_at=expired_at
    )
    db.add(db_audit)
    db.flush()
    
    phase_history = PhaseHistory(
        lock_audit_id=db_audit.id,
        phase=ExecutionPhase.LOCK_ACQUIRE,
        phase_data={"client_info": audit_in.client_info, "ttl_seconds": audit_in.ttl_seconds}
    )
    db.add(phase_history)
    db.commit()
    db.refresh(db_audit)
    return db_audit


def get_lock_audit(db: Session, audit_id: int) -> Optional[LockAudit]:
    return db.query(LockAudit).filter(LockAudit.id == audit_id).first()


def get_lock_audit_by_lock_key(db: Session, lock_key: str) -> Optional[LockAudit]:
    return db.query(LockAudit).filter(
        and_(
            LockAudit.lock_key == lock_key,
            LockAudit.status.not_in([LockStatus.RELEASED, LockStatus.TIMEOUT_RELEASED, 
                                    LockStatus.MANUALLY_RELEASED, LockStatus.EXPIRED])
        )
    ).order_by(desc(LockAudit.acquired_at)).first()


def list_lock_audits(db: Session, query: LockAuditQuery) -> Tuple[List[LockAudit], int]:
    q = db.query(LockAudit)
    
    if query.task_name:
        q = q.filter(LockAudit.task_name.contains(query.task_name))
    if query.lock_key:
        q = q.filter(LockAudit.lock_key.contains(query.lock_key))
    if query.status:
        q = q.filter(LockAudit.status == query.status)
    if query.execution_phase:
        q = q.filter(LockAudit.execution_phase == query.execution_phase)
    if query.start_time:
        q = q.filter(LockAudit.acquired_at >= query.start_time)
    if query.end_time:
        q = q.filter(LockAudit.acquired_at <= query.end_time)
    if query.has_failure is not None:
        if query.has_failure:
            q = q.filter(LockAudit.failure_records.any())
        else:
            q = q.filter(~LockAudit.failure_records.any())
    
    total = q.count()
    items = q.order_by(desc(LockAudit.acquired_at)).offset(
        (query.page - 1) * query.page_size
    ).limit(query.page_size).all()
    
    return items, total


def renew_lock(db: Session, audit_id: int, renew_in: RenewRequest) -> Tuple[LockAudit, bool, str]:
    db_audit = get_lock_audit(db, audit_id)
    if not db_audit:
        return None, False, "锁审计记录不存在"
    
    now = datetime.now()
    previous_expire_time = db_audit.expired_at
    
    if db_audit.status in [LockStatus.RELEASED, LockStatus.TIMEOUT_RELEASED, 
                          LockStatus.MANUALLY_RELEASED, LockStatus.EXPIRED]:
        renew_history = RenewHistory(
            lock_audit_id=audit_id,
            renew_time=now,
            success=False,
            previous_expire_time=previous_expire_time,
            error_message=f"锁已处于{db_audit.status.value}状态，无法续约",
            client_info=renew_in.client_info
        )
        db.add(renew_history)
        db.commit()
        return db_audit, False, "锁已释放或过期"
    
    if now > db_audit.expired_at:
        db_audit.status = LockStatus.EXPIRED
        db_audit.release_reason = ReleaseReason.TIMEOUT
        renew_history = RenewHistory(
            lock_audit_id=audit_id,
            renew_time=now,
            success=False,
            previous_expire_time=previous_expire_time,
            error_message="锁已超时过期",
            client_info=renew_in.client_info
        )
        db.add(renew_history)
        db.commit()
        return db_audit, False, "锁已超时过期"
    
    new_expire_time = now + timedelta(seconds=renew_in.ttl_seconds)
    db_audit.status = LockStatus.RENEWING
    db_audit.last_renewed_at = now
    db_audit.expired_at = new_expire_time
    
    renew_history = RenewHistory(
        lock_audit_id=audit_id,
        renew_time=now,
        success=True,
        previous_expire_time=previous_expire_time,
        new_expire_time=new_expire_time,
        client_info=renew_in.client_info
    )
    db.add(renew_history)
    
    db_audit.execution_phase = ExecutionPhase.LOCK_RENEW
    
    db.commit()
    db.refresh(db_audit)
    return db_audit, True, "续约成功"


def update_phase(db: Session, audit_id: int, phase_in: PhaseUpdateRequest) -> Optional[LockAudit]:
    db_audit = get_lock_audit(db, audit_id)
    if not db_audit:
        return None
    
    now = datetime.now()
    
    if db_audit.execution_phase:
        old_phase = db.query(PhaseHistory).filter(
            and_(
                PhaseHistory.lock_audit_id == audit_id,
                PhaseHistory.phase == db_audit.execution_phase,
                PhaseHistory.exited_at.is_(None)
            )
        ).first()
        if old_phase:
            old_phase.exited_at = now
            old_phase.duration_seconds = int((now - old_phase.entered_at).total_seconds())
    
    phase_history = PhaseHistory(
        lock_audit_id=audit_id,
        phase=phase_in.phase,
        phase_data=phase_in.phase_data
    )
    db.add(phase_history)
    
    db_audit.execution_phase = phase_in.phase
    
    if phase_in.mark_dangerous_step:
        db_audit.is_dangerous_step_executed = True
        db_audit.dangerous_step_executed_at = now
    
    if phase_in.phase == ExecutionPhase.BUSINESS_LOGIC:
        db_audit.status = LockStatus.EXECUTING
    elif phase_in.phase == ExecutionPhase.LOCK_RELEASE:
        db_audit.status = LockStatus.RELEASING
    
    db.commit()
    db.refresh(db_audit)
    return db_audit


def record_failure(db: Session, audit_id: int, failure_in: FailureRecordRequest) -> Optional[FailureRecord]:
    db_audit = get_lock_audit(db, audit_id)
    if not db_audit:
        return None
    
    failure_record = FailureRecord(
        lock_audit_id=audit_id,
        failure_type=failure_in.failure_type,
        original_input=failure_in.original_input,
        processing_basis=failure_in.processing_basis,
        final_conclusion=failure_in.final_conclusion,
        error_message=failure_in.error_message,
        stack_trace=failure_in.stack_trace
    )
    db.add(failure_record)
    
    if "renew" in failure_in.failure_type.lower():
        db_audit.status = LockStatus.RENEW_FAILED
    
    db.commit()
    db.refresh(failure_record)
    return failure_record


def manual_correction(db: Session, audit_id: int, correction_in: ManualCorrectionRequest) -> Optional[LockAudit]:
    db_audit = get_lock_audit(db, audit_id)
    if not db_audit:
        return None
    
    previous_status = db_audit.status
    previous_phase = db_audit.execution_phase
    
    correction = ManualCorrection(
        lock_audit_id=audit_id,
        corrected_by=correction_in.corrected_by,
        correction_type=correction_in.correction_type,
        previous_status=previous_status,
        previous_phase=previous_phase,
        reason=correction_in.reason,
        correction_data=correction_in.correction_data
    )
    
    if correction_in.new_status:
        db_audit.status = correction_in.new_status
        correction.new_status = correction_in.new_status
    
    if correction_in.new_phase:
        db_audit.execution_phase = correction_in.new_phase
        correction.new_phase = correction_in.new_phase
    
    if correction_in.mark_dangerous_step is not None:
        db_audit.is_dangerous_step_executed = correction_in.mark_dangerous_step
        if correction_in.mark_dangerous_step:
            db_audit.dangerous_step_executed_at = datetime.now()
    
    db.add(correction)
    db.commit()
    db.refresh(db_audit)
    return db_audit


def release_lock(db: Session, audit_id: int, release_in: LockReleaseRequest) -> Optional[LockAudit]:
    db_audit = get_lock_audit(db, audit_id)
    if not db_audit:
        return None
    
    now = datetime.now()
    
    db_audit.status = LockStatus.RELEASED
    db_audit.release_reason = release_in.release_reason
    db_audit.release_time = now
    db_audit.audit_summary = release_in.audit_summary
    
    if db_audit.execution_phase:
        old_phase = db.query(PhaseHistory).filter(
            and_(
                PhaseHistory.lock_audit_id == audit_id,
                PhaseHistory.phase == db_audit.execution_phase,
                PhaseHistory.exited_at.is_(None)
            )
        ).first()
        if old_phase:
            old_phase.exited_at = now
            old_phase.duration_seconds = int((now - old_phase.entered_at).total_seconds())
    
    db_audit.execution_phase = None
    
    db.commit()
    db.refresh(db_audit)
    return db_audit


def get_renew_history(db: Session, audit_id: int) -> List[RenewHistory]:
    return db.query(RenewHistory).filter(
        RenewHistory.lock_audit_id == audit_id
    ).order_by(RenewHistory.renew_time).all()


def get_phase_history(db: Session, audit_id: int) -> List[PhaseHistory]:
    return db.query(PhaseHistory).filter(
        PhaseHistory.lock_audit_id == audit_id
    ).order_by(PhaseHistory.entered_at).all()


def get_failure_records(db: Session, audit_id: int) -> List[FailureRecord]:
    return db.query(FailureRecord).filter(
        FailureRecord.lock_audit_id == audit_id
    ).order_by(FailureRecord.occurred_at).all()


def get_manual_corrections(db: Session, audit_id: int) -> List[ManualCorrection]:
    return db.query(ManualCorrection).filter(
        ManualCorrection.lock_audit_id == audit_id
    ).order_by(ManualCorrection.created_at).all()


def export_audits(db: Session, export_in: ExportRequest) -> List[Dict[str, Any]]:
    q = db.query(LockAudit)
    
    if export_in.task_name:
        q = q.filter(LockAudit.task_name.contains(export_in.task_name))
    if export_in.lock_key:
        q = q.filter(LockAudit.lock_key.contains(export_in.lock_key))
    if export_in.status:
        q = q.filter(LockAudit.status == export_in.status)
    if export_in.start_time:
        q = q.filter(LockAudit.acquired_at >= export_in.start_time)
    if export_in.end_time:
        q = q.filter(LockAudit.acquired_at <= export_in.end_time)
    
    audits = q.order_by(desc(LockAudit.acquired_at)).all()
    
    result = []
    for audit in audits:
        renew_history = get_renew_history(db, audit.id)
        phase_history = get_phase_history(db, audit.id)
        failure_records = get_failure_records(db, audit.id)
        
        result.append({
            "id": audit.id,
            "task_name": audit.task_name,
            "lock_key": audit.lock_key,
            "status": audit.status.value if audit.status else None,
            "execution_phase": audit.execution_phase.value if audit.execution_phase else None,
            "acquired_at": audit.acquired_at.isoformat() if audit.acquired_at else None,
            "last_renewed_at": audit.last_renewed_at.isoformat() if audit.last_renewed_at else None,
            "expired_at": audit.expired_at.isoformat() if audit.expired_at else None,
            "release_reason": audit.release_reason.value if audit.release_reason else None,
            "release_time": audit.release_time.isoformat() if audit.release_time else None,
            "audit_summary": audit.audit_summary,
            "is_dangerous_step_executed": audit.is_dangerous_step_executed,
            "dangerous_step_executed_at": audit.dangerous_step_executed_at.isoformat() if audit.dangerous_step_executed_at else None,
            "renew_count": len(renew_history),
            "renew_success_count": sum(1 for r in renew_history if r.success),
            "renew_failure_count": sum(1 for r in renew_history if not r.success),
            "phase_count": len(phase_history),
            "has_failure": len(failure_records) > 0,
            "failure_count": len(failure_records)
        })
    
    return result


def run_self_check(db: Session) -> List[Dict[str, Any]]:
    checks = []
    
    now = datetime.now()
    
    expired_active = db.query(LockAudit).filter(
        and_(
            LockAudit.expired_at < now,
            LockAudit.status.not_in([LockStatus.RELEASED, LockStatus.TIMEOUT_RELEASED, 
                                    LockStatus.MANUALLY_RELEASED, LockStatus.EXPIRED])
        )
    ).count()
    checks.append({
        "check_name": "超时锁检查",
        "passed": expired_active == 0,
        "message": f"发现 {expired_active} 个已超时但未标记的锁",
        "details": {"expired_count": expired_active}
    })
    
    phase_mismatch = db.query(LockAudit).filter(
        and_(
            LockAudit.execution_phase.is_not(None),
            LockAudit.status == LockStatus.RELEASED
        )
    ).count()
    checks.append({
        "check_name": "状态-阶段一致性检查",
        "passed": phase_mismatch == 0,
        "message": f"发现 {phase_mismatch} 个已释放锁仍保留执行阶段",
        "details": {"mismatch_count": phase_mismatch}
    })
    
    missing_phase_exit = db.query(PhaseHistory).filter(
        PhaseHistory.exited_at.is_(None)
    ).count()
    checks.append({
        "check_name": "阶段退出完整性检查",
        "passed": missing_phase_exit == 0,
        "message": f"发现 {missing_phase_exit} 个阶段未正常退出",
        "details": {"incomplete_phases": missing_phase_exit}
    })
    
    renew_conflicts = db.execute(
        text("""
        SELECT rh1.lock_audit_id, COUNT(*) as conflict_count
        FROM renew_history rh1
        INNER JOIN renew_history rh2 
        ON rh1.lock_audit_id = rh2.lock_audit_id 
        AND rh1.id != rh2.id
        AND ABS((strftime('%s', rh1.renew_time) - strftime('%s', rh2.renew_time))) < 5
        GROUP BY rh1.lock_audit_id
        HAVING conflict_count > 1
        """)
    ).fetchall()
    conflict_count = len(renew_conflicts)
    checks.append({
        "check_name": "续约冲突检查",
        "passed": conflict_count == 0,
        "message": f"发现 {conflict_count} 个锁存在5秒内多次续约的可能冲突",
        "details": {"conflict_count": conflict_count}
    })
    
    total_audits = db.query(LockAudit).count()
    total_renews = db.query(RenewHistory).count()
    total_failures = db.query(FailureRecord).count()
    checks.append({
        "check_name": "数据完整性统计",
        "passed": True,
        "message": f"总计 {total_audits} 条审计记录, {total_renews} 次续约, {total_failures} 次失败",
        "details": {
            "total_audits": total_audits,
            "total_renews": total_renews,
            "total_failures": total_failures
        }
    })
    
    return checks


def check_timeout_locks(db: Session) -> int:
    now = datetime.now()
    expired_locks = db.query(LockAudit).filter(
        and_(
            LockAudit.expired_at < now,
            LockAudit.status.not_in([LockStatus.RELEASED, LockStatus.TIMEOUT_RELEASED, 
                                    LockStatus.MANUALLY_RELEASED, LockStatus.EXPIRED])
        )
    ).all()
    
    for lock in expired_locks:
        lock.status = LockStatus.TIMEOUT_RELEASED
        lock.release_reason = ReleaseReason.TIMEOUT
        lock.release_time = now
    
    db.commit()
    return len(expired_locks)
