from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

import models
import schemas


class BusinessError(Exception):
    def __init__(self, error_code: str, message: str, details: dict = None):
        self.error_code = error_code
        self.message = message
        self.details = details or {}


def validate_consent_version(db: Session, user_subject_id: int, consent_version_id: int) -> Tuple[bool, str]:
    consent = db.query(models.ConsentVersion).filter(
        models.ConsentVersion.id == consent_version_id,
        models.ConsentVersion.user_subject_id == user_subject_id,
        models.ConsentVersion.is_active == True
    ).first()
    
    if not consent:
        return False, "Consent version not found or inactive"
    
    return True, "Valid consent version"


def validate_export_scopes(db: Session, scope_codes: List[str]) -> Tuple[bool, str, List[models.ExportScope]]:
    scopes = db.query(models.ExportScope).filter(
        models.ExportScope.code.in_(scope_codes),
        models.ExportScope.is_active == True
    ).all()
    
    found_codes = {s.code for s in scopes}
    missing_codes = set(scope_codes) - found_codes
    
    if missing_codes:
        return False, f"Invalid or inactive scopes: {', '.join(missing_codes)}", []
    
    return True, "All scopes valid", scopes


def can_transition_status(current: models.ExportRequestStatus, target: models.ExportRequestStatus) -> bool:
    valid_transitions = {
        models.ExportRequestStatus.DRAFT: [
            models.ExportRequestStatus.PENDING_LEGAL,
            models.ExportRequestStatus.REJECTED
        ],
        models.ExportRequestStatus.PENDING_LEGAL: [
            models.ExportRequestStatus.LEGAL_APPROVED,
            models.ExportRequestStatus.REJECTED,
            models.ExportRequestStatus.NEEDS_REVIEW
        ],
        models.ExportRequestStatus.NEEDS_REVIEW: [
            models.ExportRequestStatus.PENDING_LEGAL,
            models.ExportRequestStatus.REJECTED
        ],
        models.ExportRequestStatus.LEGAL_APPROVED: [
            models.ExportRequestStatus.PENDING_PACKAGE,
            models.ExportRequestStatus.REJECTED
        ],
        models.ExportRequestStatus.PENDING_PACKAGE: [
            models.ExportRequestStatus.PACKAGING,
            models.ExportRequestStatus.REJECTED
        ],
        models.ExportRequestStatus.PACKAGING: [
            models.ExportRequestStatus.PACKAGED,
            models.ExportRequestStatus.REJECTED
        ],
        models.ExportRequestStatus.PACKAGED: [
            models.ExportRequestStatus.DELIVERED,
            models.ExportRequestStatus.REJECTED
        ],
        models.ExportRequestStatus.DELIVERED: [],
        models.ExportRequestStatus.REJECTED: []
    }
    return target in valid_transitions.get(current, [])


def create_user_subject(db: Session, user: schemas.UserSubjectCreate) -> models.UserSubject:
    db_user = db.query(models.UserSubject).filter(models.UserSubject.user_id == user.user_id).first()
    if db_user:
        raise BusinessError(
            error_code="USER_EXISTS",
            message=f"User with user_id {user.user_id} already exists",
            details={"user_id": user.user_id}
        )
    db_user = models.UserSubject(**user.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user_subject(db: Session, user_id: str = None, id: int = None) -> Optional[models.UserSubject]:
    if user_id:
        return db.query(models.UserSubject).filter(models.UserSubject.user_id == user_id).first()
    return db.query(models.UserSubject).filter(models.UserSubject.id == id).first()


def create_consent_version(db: Session, consent: schemas.ConsentVersionCreate) -> models.ConsentVersion:
    user = get_user_subject(db, id=consent.user_subject_id)
    if not user:
        raise BusinessError(
            error_code="USER_NOT_FOUND",
            message=f"User subject not found",
            details={"user_subject_id": consent.user_subject_id}
        )
    
    db_consent = models.ConsentVersion(**consent.model_dump())
    db.add(db_consent)
    db.commit()
    db.refresh(db_consent)
    return db_consent


def create_export_scope(db: Session, scope: schemas.ExportScopeCreate) -> models.ExportScope:
    existing = db.query(models.ExportScope).filter(models.ExportScope.code == scope.code).first()
    if existing:
        raise BusinessError(
            error_code="SCOPE_EXISTS",
            message=f"Export scope with code {scope.code} already exists",
            details={"code": scope.code}
        )
    db_scope = models.ExportScope(**scope.model_dump())
    db.add(db_scope)
    db.commit()
    db.refresh(db_scope)
    return db_scope


def get_export_scope(db: Session, code: str) -> Optional[models.ExportScope]:
    return db.query(models.ExportScope).filter(models.ExportScope.code == code).first()


def create_export_request(db: Session, request: schemas.ExportRequestCreate) -> models.ExportRequest:
    existing = db.query(models.ExportRequest).filter(models.ExportRequest.request_id == request.request_id).first()
    if existing:
        raise BusinessError(
            error_code="REQUEST_EXISTS",
            message=f"Export request with request_id {request.request_id} already exists",
            details={"request_id": request.request_id}
        )
    
    valid, msg = validate_consent_version(db, request.user_subject_id, request.consent_version_id)
    if not valid:
        raise BusinessError(
            error_code="INVALID_CONSENT",
            message=msg,
            details={"user_subject_id": request.user_subject_id, "consent_version_id": request.consent_version_id}
        )
    
    valid, msg, scopes = validate_export_scopes(db, request.scopes)
    if not valid:
        raise BusinessError(
            error_code="INVALID_SCOPES",
            message=msg,
            details={"requested_scopes": request.scopes}
        )
    
    request_data = request.model_dump(exclude={"scopes"})
    db_request = models.ExportRequest(**request_data)
    db.add(db_request)
    db.flush()
    
    for scope in scopes:
        db_request_scope = models.ExportRequestScope(
            export_request_id=db_request.id,
            export_scope_id=scope.id
        )
        db.add(db_request_scope)
    
    db.commit()
    db.refresh(db_request)
    return db_request


def get_export_request(db: Session, request_id: str = None, id: int = None) -> Optional[models.ExportRequest]:
    if id:
        return db.query(models.ExportRequest).filter(models.ExportRequest.id == id).first()
    return db.query(models.ExportRequest).filter(models.ExportRequest.request_id == request_id).first()


def list_export_requests(db: Session, filters: schemas.ExportRequestFilter = None) -> List[models.ExportRequest]:
    query = db.query(models.ExportRequest)
    
    if filters:
        if filters.status:
            query = query.filter(models.ExportRequest.status == filters.status)
        if filters.user_subject_id:
            query = query.filter(models.ExportRequest.user_subject_id == filters.user_subject_id)
        if filters.date_from:
            query = query.filter(models.ExportRequest.requested_at >= filters.date_from)
        if filters.date_to:
            query = query.filter(models.ExportRequest.requested_at <= filters.date_to)
    
    return query.order_by(models.ExportRequest.requested_at.desc()).all()


def update_export_request_status(
    db: Session,
    request_id: str,
    new_status: models.ExportRequestStatus,
    legal_notes: str = None
) -> models.ExportRequest:
    request = get_export_request(db, request_id)
    if not request:
        raise BusinessError(
            error_code="REQUEST_NOT_FOUND",
            message="Export request not found",
            details={"request_id": request_id}
        )
    
    if request.status == new_status:
        return request
    
    if not can_transition_status(request.status, new_status):
        raise BusinessError(
            error_code="INVALID_STATUS_TRANSITION",
            message=f"Cannot transition from {request.status} to {new_status}",
            details={"current_status": request.status, "target_status": new_status}
        )
    
    request.status = new_status
    if legal_notes:
        request.legal_notes = legal_notes
    request.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(request)
    return request


def create_approval(db: Session, approval: schemas.ApprovalCreate) -> models.Approval:
    request = get_export_request(db, id=approval.export_request_id)
    if not request:
        raise BusinessError(
            error_code="REQUEST_NOT_FOUND",
            message="Export request not found",
            details={"export_request_id": approval.export_request_id}
        )
    
    existing = db.query(models.Approval).filter(
        models.Approval.export_request_id == approval.export_request_id,
        models.Approval.node_type == approval.node_type
    ).first()
    
    if existing and existing.approved is not None:
        raise BusinessError(
            error_code="APPROVAL_ALREADY_PROCESSED",
            message=f"Approval for node {approval.node_type} already processed",
            details={"node_type": approval.node_type, "export_request_id": approval.export_request_id}
        )
    
    if existing:
        db_app = existing
        db_app.approved = approval.approved
        db_app.approver_name = approval.approver_name
        db_app.approver_email = approval.approver_email
        db_app.notes = approval.notes
        db_app.approved_at = datetime.utcnow()
    else:
        db_app = models.Approval(**approval.model_dump())
        db_app.approved_at = datetime.utcnow()
        db.add(db_app)
    
    db.commit()
    db.refresh(db_app)
    
    if approval.node_type == models.ApprovalNodeType.LEGAL and approval.approved:
        update_export_request_status(
            db, 
            request.request_id, 
            models.ExportRequestStatus.LEGAL_APPROVED
        )
    elif approval.node_type == models.ApprovalNodeType.LEGAL and not approval.approved:
        update_export_request_status(
            db, 
            request.request_id, 
            models.ExportRequestStatus.REJECTED
        )
    
    return db_app


def create_or_get_package_task(db: Session, task: schemas.PackageTaskCreate) -> models.PackageTask:
    existing = db.query(models.PackageTask).filter(
        models.PackageTask.export_request_id == task.export_request_id
    ).first()
    
    if existing:
        if existing.status == "completed":
            raise BusinessError(
                error_code="PACKAGE_ALREADY_COMPLETED",
                message="Package task already completed",
                details={"task_id": existing.task_id}
            )
        return existing
    
    request = db.query(models.ExportRequest).filter(
        models.ExportRequest.id == task.export_request_id
    ).first()
    
    if not request:
        raise BusinessError(
            error_code="REQUEST_NOT_FOUND",
            message="Export request not found",
            details={"export_request_id": task.export_request_id}
        )
    
    if request.status not in [models.ExportRequestStatus.LEGAL_APPROVED, models.ExportRequestStatus.PENDING_PACKAGE]:
        raise BusinessError(
            error_code="INVALID_STATUS_FOR_PACKAGING",
            message=f"Cannot create package task for request in status {request.status}",
            details={"current_status": request.status}
        )
    
    db_task = models.PackageTask(**task.model_dump())
    db.add(db_task)
    
    if request.status == models.ExportRequestStatus.LEGAL_APPROVED:
        request.status = models.ExportRequestStatus.PENDING_PACKAGE
    
    db.commit()
    db.refresh(db_task)
    return db_task


def update_package_task(db: Session, task_id: str, update: schemas.PackageTaskUpdate) -> models.PackageTask:
    task = db.query(models.PackageTask).filter(models.PackageTask.task_id == task_id).first()
    if not task:
        raise BusinessError(
            error_code="TASK_NOT_FOUND",
            message="Package task not found",
            details={"task_id": task_id}
        )
    
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    
    if update.status == "completed":
        request = db.query(models.ExportRequest).filter(
            models.ExportRequest.id == task.export_request_id
        ).first()
        if request and request.status == models.ExportRequestStatus.PACKAGING:
            request.status = models.ExportRequestStatus.PACKAGED
    
    db.commit()
    db.refresh(task)
    return task


def create_delivery_record(db: Session, delivery: schemas.DeliveryRecordCreate) -> models.DeliveryRecord:
    request = db.query(models.ExportRequest).filter(
        models.ExportRequest.id == delivery.export_request_id
    ).first()
    
    if not request:
        raise BusinessError(
            error_code="REQUEST_NOT_FOUND",
            message="Export request not found",
            details={"export_request_id": delivery.export_request_id}
        )
    
    existing = db.query(models.DeliveryRecord).filter(
        models.DeliveryRecord.export_request_id == delivery.export_request_id
    ).first()
    
    if existing:
        raise BusinessError(
            error_code="DELIVERY_ALREADY_RECORDED",
            message="Delivery record already exists for this request",
            details={"export_request_id": delivery.export_request_id}
        )
    
    if request.status != models.ExportRequestStatus.PACKAGED:
        raise BusinessError(
            error_code="INVALID_STATUS_FOR_DELIVERY",
            message=f"Cannot record delivery for request in status {request.status}",
            details={"current_status": request.status}
        )
    
    db_delivery = models.DeliveryRecord(**delivery.model_dump())
    db.add(db_delivery)
    request.status = models.ExportRequestStatus.DELIVERED
    
    db.commit()
    db.refresh(db_delivery)
    return db_delivery


def get_delivery_records(db: Session, request_id: str = None) -> List[models.DeliveryRecord]:
    query = db.query(models.DeliveryRecord)
    if request_id:
        request = get_export_request(db, request_id)
        if request:
            query = query.filter(models.DeliveryRecord.export_request_id == request.id)
    return query.all()
