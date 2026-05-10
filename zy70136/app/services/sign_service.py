from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.models import (
    SmsSignApplication, OperationLog,
    SignStatus
)
from app.schemas import CreateSignApplicationRequest, IdempotentCheckResult
from app.services.idempotency_service import (
    check_idempotency, validate_sign_name, can_transition_status,
    record_operation_log
)


def create_sign_application(
    db: Session,
    request: CreateSignApplicationRequest
) -> Tuple[Optional[SmsSignApplication], str]:
    idempotent_result = check_idempotency(
        db, request.request_id, "create_application"
    )
    
    if idempotent_result.is_duplicate:
        existing_app = db.query(SmsSignApplication).filter(
            SmsSignApplication.request_id == request.request_id
        ).first()
        if existing_app:
            return existing_app, idempotent_result.message
    
    is_valid, error_msg = validate_sign_name(request.sign_name)
    if not is_valid:
        return None, error_msg
    
    application = SmsSignApplication(
        request_id=request.request_id,
        merchant_id=request.merchant_id,
        sign_name=request.sign_name,
        sign_type=request.sign_type,
        description=request.description,
        status=SignStatus.DRAFT
    )
    
    db.add(application)
    db.flush()
    
    record_operation_log(
        db=db,
        request_id=request.request_id,
        application_id=application.id,
        operation_type="create_application",
        to_status=SignStatus.DRAFT.value,
        remark=f"创建签名申请: {request.sign_name}"
    )
    
    db.commit()
    db.refresh(application)
    
    return application, "创建成功"


def get_application_by_id(db: Session, application_id: int) -> Optional[SmsSignApplication]:
    return db.query(SmsSignApplication).filter(
        SmsSignApplication.id == application_id
    ).first()


def get_application_by_request_id(db: Session, request_id: str) -> Optional[SmsSignApplication]:
    return db.query(SmsSignApplication).filter(
        SmsSignApplication.request_id == request_id
    ).first()


def update_application_status(
    db: Session,
    application_id: int,
    new_status: SignStatus,
    request_id: str,
    operation_type: str,
    remark: Optional[str] = None,
    audit_comment: Optional[str] = None
) -> Tuple[Optional[SmsSignApplication], str]:
    application = get_application_by_id(db, application_id)
    if not application:
        return None, "签名申请不存在"
    
    if application.status == new_status:
        return application, "状态未变更"
    
    if not can_transition_status(application.status, new_status):
        return None, f"不允许从 {application.status.value} 转换到 {new_status.value}"
    
    old_status = application.status
    application.status = new_status
    
    if audit_comment:
        application.audit_comment = audit_comment
    
    record_operation_log(
        db=db,
        request_id=request_id,
        application_id=application_id,
        operation_type=operation_type,
        from_status=old_status.value,
        to_status=new_status.value,
        remark=remark
    )
    
    db.flush()
    return application, "状态更新成功"


def submit_for_qualification(
    db: Session,
    application_id: int,
    request_id: str
) -> Tuple[Optional[SmsSignApplication], str]:
    idempotent_result = check_idempotency(
        db, request_id, "submit_for_qualification"
    )
    
    if idempotent_result.is_duplicate:
        existing_app = db.query(SmsSignApplication).filter(
            SmsSignApplication.id == application_id
        ).first()
        if existing_app:
            return existing_app, idempotent_result.message
    
    return update_application_status(
        db=db,
        application_id=application_id,
        new_status=SignStatus.PENDING_QUALIFICATION,
        request_id=request_id,
        operation_type="submit_for_qualification",
        remark="提交资质审核"
    )
