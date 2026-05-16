import json
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session

import models
import schemas
from models import RequestStatus, AuditConclusion


def get_repository(db: Session, repo_id: int):
    return db.query(models.Repository).filter(models.Repository.id == repo_id).first()


def get_repository_by_name(db: Session, name: str):
    return db.query(models.Repository).filter(models.Repository.name == name).first()


def get_repositories(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Repository).offset(skip).limit(limit).all()


def create_repository(db: Session, repo: schemas.RepositoryCreate):
    db_repo = models.Repository(**repo.model_dump())
    db.add(db_repo)
    db.commit()
    db.refresh(db_repo)
    return db_repo


def create_branch_rule(db: Session, rule: schemas.BranchRuleCreate):
    db_rule = models.BranchRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


def get_branch_rules_by_repository(db: Session, repo_id: int):
    return db.query(models.BranchRule).filter(models.BranchRule.repository_id == repo_id).all()


def get_exception_request(db: Session, request_id: int):
    return db.query(models.ExceptionRequest).filter(models.ExceptionRequest.id == request_id).first()


def get_exception_request_by_idempotency_key(db: Session, idempotency_key: str):
    return db.query(models.ExceptionRequest).filter(
        models.ExceptionRequest.request_idempotency_key == idempotency_key
    ).first()


def get_exception_requests(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: Optional[RequestStatus] = None,
    repository_id: Optional[int] = None,
    requester: Optional[str] = None,
):
    query = db.query(models.ExceptionRequest)
    if status:
        query = query.filter(models.ExceptionRequest.status == status)
    if repository_id:
        query = query.filter(models.ExceptionRequest.repository_id == repository_id)
    if requester:
        query = query.filter(models.ExceptionRequest.requester == requester)
    return query.order_by(models.ExceptionRequest.created_at.desc()).offset(skip).limit(limit).all()


def create_exception_request(db: Session, request: schemas.ExceptionRequestCreate):
    existing = get_exception_request_by_idempotency_key(db, request.request_idempotency_key)
    if existing:
        _create_audit_record(
            db,
            request_id=existing.id,
            action="duplicate_request_detected",
            actor=request.requester,
            original_input=json.dumps(request.model_dump()),
            conclusion=AuditConclusion.ABNORMAL,
            details=f"Duplicate request with idempotency key: {request.request_idempotency_key}",
        )
        db.commit()
        return existing, False

    db_request = models.ExceptionRequest(**request.model_dump())
    db.add(db_request)
    db.commit()
    db.refresh(db_request)

    _create_audit_record(
        db,
        request_id=db_request.id,
        action="request_created",
        actor=request.requester,
        original_input=json.dumps(request.model_dump()),
        conclusion=AuditConclusion.NORMAL,
        details="Exception request created successfully",
    )
    db.commit()
    db.refresh(db_request)
    return db_request, True


def approve_exception_request(
    db: Session,
    request_id: int,
    approver: str,
    comment: Optional[str] = None,
):
    db_request = get_exception_request(db, request_id)
    if not db_request:
        return None, "Request not found"

    if db_request.status != RequestStatus.PENDING:
        _create_audit_record(
            db,
            request_id=request_id,
            action="invalid_status_transition",
            actor=approver,
            original_input=json.dumps({"request_id": request_id, "approver": approver, "comment": comment}),
            conclusion=AuditConclusion.ABNORMAL,
            details=f"Cannot approve request in status: {db_request.status}",
        )
        db.commit()
        return db_request, f"Cannot approve request in status: {db_request.status}"

    db_approval = models.Approval(
        request_id=request_id,
        approver=approver,
        comment=comment,
    )
    db.add(db_approval)

    db_request.status = RequestStatus.APPROVED
    db.commit()
    db.refresh(db_request)

    _create_audit_record(
        db,
        request_id=request_id,
        action="request_approved",
        actor=approver,
        original_input=json.dumps({"request_id": request_id, "approver": approver, "comment": comment}),
        conclusion=AuditConclusion.NORMAL,
        details=f"Request approved by {approver}",
    )
    db.commit()
    db.refresh(db_request)
    return db_request, None


def start_release_window(
    db: Session,
    request_id: int,
    actor: str,
):
    db_request = get_exception_request(db, request_id)
    if not db_request:
        return None, "Request not found"

    if db_request.status != RequestStatus.APPROVED:
        _create_audit_record(
            db,
            request_id=request_id,
            action="invalid_status_transition",
            actor=actor,
            original_input=json.dumps({"request_id": request_id, "actor": actor}),
            conclusion=AuditConclusion.ABNORMAL,
            details=f"Cannot start release window for request in status: {db_request.status}",
        )
        db.commit()
        return db_request, f"Cannot start release window for request in status: {db_request.status}"

    branch_rules = get_branch_rules_by_repository(db, db_request.repository_id)
    snapshot = json.dumps([{
        "id": r.id,
        "branch_pattern": r.branch_pattern,
        "require_pull_request": r.require_pull_request,
        "require_code_owner_review": r.require_code_owner_review,
        "required_approving_review_count": r.required_approving_review_count,
        "dismiss_stale_reviews": r.dismiss_stale_reviews,
        "require_status_checks": r.require_status_checks,
    } for r in branch_rules])

    ends_at = datetime.utcnow() + timedelta(minutes=db_request.requested_duration_minutes)
    db_window = models.ReleaseWindow(
        request_id=request_id,
        ends_at=ends_at,
        original_settings_snapshot=snapshot,
    )
    db.add(db_window)

    db_request.status = RequestStatus.ACTIVE
    db.commit()
    db.refresh(db_request)

    _create_audit_record(
        db,
        request_id=request_id,
        action="release_window_started",
        actor=actor,
        original_input=json.dumps({"request_id": request_id, "actor": actor}),
        conclusion=AuditConclusion.NORMAL,
        details=f"Release window started, ends at {ends_at.isoformat()}",
    )
    db.commit()
    db.refresh(db_request)
    return db_request, None


def restore_branch_protection(
    db: Session,
    request_id: int,
    restored_by: str,
    is_manual: bool = False,
    comment: Optional[str] = None,
):
    db_request = get_exception_request(db, request_id)
    if not db_request:
        return None, "Request not found"

    if db_request.status not in [RequestStatus.ACTIVE, RequestStatus.EXPIRED]:
        _create_audit_record(
            db,
            request_id=request_id,
            action="invalid_status_transition",
            actor=restored_by,
            original_input=json.dumps({
                "request_id": request_id,
                "restored_by": restored_by,
                "is_manual": is_manual,
                "comment": comment,
            }),
            conclusion=AuditConclusion.ABNORMAL,
            details=f"Cannot restore branch protection for request in status: {db_request.status}",
        )
        db.commit()
        return db_request, f"Cannot restore branch protection for request in status: {db_request.status}"

    existing_restore = db.query(models.RestoreAction).filter(
        models.RestoreAction.request_id == request_id,
        models.RestoreAction.success == True,
    ).first()
    if existing_restore:
        _create_audit_record(
            db,
            request_id=request_id,
            action="duplicate_restore_detected",
            actor=restored_by,
            original_input=json.dumps({
                "request_id": request_id,
                "restored_by": restored_by,
                "is_manual": is_manual,
                "comment": comment,
            }),
            conclusion=AuditConclusion.ABNORMAL,
            details="Branch protection already restored",
        )
        db.commit()
        return db_request, "Branch protection already restored"

    db_restore = models.RestoreAction(
        request_id=request_id,
        restored_by=restored_by,
        is_manual=is_manual,
        comment=comment,
        success=True,
    )
    db.add(db_restore)

    if db_request.release_window:
        db_request.release_window.is_active = False

    db_request.status = RequestStatus.RESTORED
    db.commit()
    db.refresh(db_request)

    _create_audit_record(
        db,
        request_id=request_id,
        action="branch_protection_restored",
        actor=restored_by,
        original_input=json.dumps({
            "request_id": request_id,
            "restored_by": restored_by,
            "is_manual": is_manual,
            "comment": comment,
        }),
        conclusion=AuditConclusion.NORMAL,
        details=f"Branch protection restored {'manually' if is_manual else 'automatically'} by {restored_by}",
    )
    db.commit()
    db.refresh(db_request)
    return db_request, None


def reject_exception_request(
    db: Session,
    request_id: int,
    rejector: str,
    comment: Optional[str] = None,
):
    db_request = get_exception_request(db, request_id)
    if not db_request:
        return None, "Request not found"

    if db_request.status != RequestStatus.PENDING:
        _create_audit_record(
            db,
            request_id=request_id,
            action="invalid_status_transition",
            actor=rejector,
            original_input=json.dumps({"request_id": request_id, "rejector": rejector, "comment": comment}),
            conclusion=AuditConclusion.ABNORMAL,
            details=f"Cannot reject request in status: {db_request.status}",
        )
        db.commit()
        return db_request, f"Cannot reject request in status: {db_request.status}"

    db_request.status = RequestStatus.REJECTED
    db.commit()
    db.refresh(db_request)

    _create_audit_record(
        db,
        request_id=request_id,
        action="request_rejected",
        actor=rejector,
        original_input=json.dumps({"request_id": request_id, "rejector": rejector, "comment": comment}),
        conclusion=AuditConclusion.NORMAL,
        details=f"Request rejected by {rejector}: {comment}",
    )
    db.commit()
    db.refresh(db_request)
    return db_request, None


def check_expired_windows(db: Session):
    now = datetime.utcnow()
    expired = db.query(models.ExceptionRequest).join(models.ReleaseWindow).filter(
        models.ExceptionRequest.status == RequestStatus.ACTIVE,
        models.ReleaseWindow.ends_at <= now,
        models.ReleaseWindow.is_active == True,
    ).all()

    for req in expired:
        req.status = RequestStatus.EXPIRED
        req.release_window.is_active = False
        _create_audit_record(
            db,
            request_id=req.id,
            action="window_expired",
            actor="system",
            original_input=None,
            conclusion=AuditConclusion.NEEDS_REVIEW,
            details=f"Release window expired at {req.release_window.ends_at.isoformat()}, protection not restored",
        )

    db.commit()
    return expired


def manual_correction(
    db: Session,
    request_id: int,
    actor: str,
    new_status: RequestStatus,
    reason: str,
    original_input: Optional[str] = None,
):
    db_request = get_exception_request(db, request_id)
    if not db_request:
        return None, "Request not found"

    old_status = db_request.status
    db_request.status = new_status
    db.commit()
    db.refresh(db_request)

    _create_audit_record(
        db,
        request_id=request_id,
        action="manual_correction",
        actor=actor,
        original_input=original_input,
        conclusion=AuditConclusion.NEEDS_REVIEW,
        details=f"Manual correction: status changed from {old_status} to {new_status}. Reason: {reason}",
    )
    db.commit()
    db.refresh(db_request)
    return db_request, None


def _create_audit_record(
    db: Session,
    request_id: int,
    action: str,
    actor: str,
    original_input: Optional[str],
    conclusion: AuditConclusion,
    details: str,
):
    db_audit = models.AuditRecord(
        request_id=request_id,
        action=action,
        actor=actor,
        original_input=original_input,
        conclusion=conclusion,
        details=details,
    )
    db.add(db_audit)
    return db_audit


def get_audit_records(db: Session, request_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.AuditRecord)
    if request_id:
        query = query.filter(models.AuditRecord.request_id == request_id)
    return query.order_by(models.AuditRecord.timestamp.desc()).offset(skip).limit(limit).all()


def export_audit_report(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    repository_id: Optional[int] = None,
    status: Optional[RequestStatus] = None,
    requester: Optional[str] = None,
):
    query = db.query(models.ExceptionRequest)

    if start_date:
        query = query.filter(models.ExceptionRequest.created_at >= start_date)
    if end_date:
        query = query.filter(models.ExceptionRequest.created_at <= end_date)
    if repository_id:
        query = query.filter(models.ExceptionRequest.repository_id == repository_id)
    if status:
        query = query.filter(models.ExceptionRequest.status == status)
    if requester:
        query = query.filter(models.ExceptionRequest.requester == requester)

    requests = query.order_by(models.ExceptionRequest.created_at.desc()).all()
    report = []

    for req in requests:
        audit_records = db.query(models.AuditRecord).filter(
            models.AuditRecord.request_id == req.id
        ).order_by(models.AuditRecord.timestamp).all()

        abnormal_records = [
            {
                "action": r.action,
                "actor": r.actor,
                "timestamp": r.timestamp.isoformat(),
                "conclusion": r.conclusion,
                "original_input": r.original_input,
                "details": r.details,
            }
            for r in audit_records
            if r.conclusion != AuditConclusion.NORMAL
        ]

        report.append({
            "request_id": req.id,
            "idempotency_key": req.request_idempotency_key,
            "repository": req.repository.name if req.repository else None,
            "branch_pattern": req.branch_pattern,
            "requester": req.requester,
            "reason": req.reason,
            "requested_duration_minutes": req.requested_duration_minutes,
            "status": req.status,
            "created_at": req.created_at.isoformat(),
            "approver": req.approval.approver if req.approval else None,
            "approved_at": req.approval.approved_at.isoformat() if req.approval else None,
            "window_started_at": req.release_window.started_at.isoformat() if req.release_window else None,
            "window_ends_at": req.release_window.ends_at.isoformat() if req.release_window else None,
            "restored_by": req.restore_actions[-1].restored_by if req.restore_actions else None,
            "restored_at": req.restore_actions[-1].restored_at.isoformat() if req.restore_actions else None,
            "abnormal_events_count": len(abnormal_records),
            "abnormal_events": abnormal_records,
        })

    return report
