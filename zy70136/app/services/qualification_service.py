from datetime import datetime
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session

from app.models import (
    QualificationAttachment, SmsSignApplication, OperationLog,
    QualificationStatus, SignStatus
)
from app.schemas import UploadQualificationRequest
from app.services.idempotency_service import (
    check_idempotency, record_operation_log
)
from app.services.sign_service import update_application_status


def upload_qualification(
    db: Session,
    request: UploadQualificationRequest
) -> Tuple[Optional[QualificationAttachment], str]:
    idempotent_result = check_idempotency(
        db, request.request_id, "upload_qualification"
    )
    
    if idempotent_result.is_duplicate:
        existing_qual = db.query(QualificationAttachment).filter(
            QualificationAttachment.request_id == request.request_id
        ).first()
        if existing_qual:
            return existing_qual, idempotent_result.message
    
    application = db.query(SmsSignApplication).filter(
        SmsSignApplication.id == request.application_id
    ).first()
    
    if not application:
        return None, "签名申请不存在"
    
    allowed_statuses = [SignStatus.DRAFT, SignStatus.PENDING_QUALIFICATION, SignStatus.QUALIFICATION_REJECTED]
    if application.status not in allowed_statuses:
        return None, f"当前状态 {application.status.value} 不允许上传资质"
    
    if not request.qualification_type or not request.qualification_type.strip():
        return None, "资质类型不能为空"
    
    if not request.file_hash or len(request.file_hash) < 8:
        return None, "文件哈希校验失败"
    
    existing_same_hash = db.query(QualificationAttachment).filter(
        QualificationAttachment.application_id == request.application_id,
        QualificationAttachment.file_hash == request.file_hash,
        QualificationAttachment.status != QualificationStatus.REJECTED
    ).first()
    
    if existing_same_hash:
        return existing_same_hash, "相同文件已存在，避免重复上传"
    
    qualification = QualificationAttachment(
        request_id=request.request_id,
        application_id=request.application_id,
        qualification_type=request.qualification_type,
        file_name=request.file_name,
        file_url=request.file_url,
        file_hash=request.file_hash,
        status=QualificationStatus.PENDING
    )
    
    db.add(qualification)
    db.flush()
    
    record_operation_log(
        db=db,
        request_id=request.request_id,
        application_id=request.application_id,
        operation_type="upload_qualification",
        remark=f"上传资质: {request.qualification_type} - {request.file_name}"
    )
    
    db.commit()
    db.refresh(qualification)
    
    return qualification, "上传成功"


def get_qualifications_by_application(
    db: Session,
    application_id: int
) -> List[QualificationAttachment]:
    return db.query(QualificationAttachment).filter(
        QualificationAttachment.application_id == application_id
    ).order_by(QualificationAttachment.created_at.desc()).all()


def approve_qualification(
    db: Session,
    qualification_id: int,
    reviewer_id: str,
    request_id: str,
    comment: Optional[str] = None
) -> Tuple[Optional[QualificationAttachment], str]:
    idempotent_result = check_idempotency(db, request_id, "approve_qualification")
    if idempotent_result.is_duplicate:
        existing_qual = db.query(QualificationAttachment).filter(
            QualificationAttachment.id == qualification_id
        ).first()
        if existing_qual:
            return existing_qual, idempotent_result.message
    
    qualification = db.query(QualificationAttachment).filter(
        QualificationAttachment.id == qualification_id
    ).first()
    
    if not qualification:
        return None, "资质附件不存在"
    
    if qualification.status == QualificationStatus.APPROVED:
        return qualification, "资质已审核通过"
    
    if qualification.status != QualificationStatus.PENDING:
        return None, f"当前状态 {qualification.status.value} 不允许审批"
    
    qualification.status = QualificationStatus.APPROVED
    qualification.reviewer_id = reviewer_id
    qualification.review_comment = comment
    qualification.reviewed_at = datetime.utcnow()
    
    record_operation_log(
        db=db,
        request_id=request_id,
        application_id=qualification.application_id,
        operation_type="approve_qualification",
        remark=f"审批通过资质: {qualification.qualification_type}, 审核人: {reviewer_id}"
    )
    
    application = db.query(SmsSignApplication).filter(
        SmsSignApplication.id == qualification.application_id
    ).first()
    
    if application and application.status == SignStatus.PENDING_QUALIFICATION:
        all_quals = get_qualifications_by_application(db, application.id)
        pending_quals = [q for q in all_quals if q.status == QualificationStatus.PENDING]
        
        if len(pending_quals) == 0:
            approved_quals = [q for q in all_quals if q.status == QualificationStatus.APPROVED]
            if len(approved_quals) > 0:
                update_application_status(
                    db=db,
                    application_id=application.id,
                    new_status=SignStatus.QUALIFICATION_APPROVED,
                    request_id=request_id,
                    operation_type="auto_qualification_approved",
                    remark="所有资质审核通过，自动更新申请状态"
                )
    
    db.commit()
    db.refresh(qualification)
    
    return qualification, "审批通过"


def reject_qualification(
    db: Session,
    qualification_id: int,
    reviewer_id: str,
    request_id: str,
    comment: str
) -> Tuple[Optional[QualificationAttachment], str]:
    if not comment or len(comment.strip()) == 0:
        return None, "拒绝原因不能为空"
    
    idempotent_result = check_idempotency(db, request_id, "reject_qualification")
    if idempotent_result.is_duplicate:
        existing_qual = db.query(QualificationAttachment).filter(
            QualificationAttachment.id == qualification_id
        ).first()
        if existing_qual:
            return existing_qual, idempotent_result.message
    
    qualification = db.query(QualificationAttachment).filter(
        QualificationAttachment.id == qualification_id
    ).first()
    
    if not qualification:
        return None, "资质附件不存在"
    
    if qualification.status == QualificationStatus.REJECTED:
        return qualification, "资质已被拒绝"
    
    if qualification.status != QualificationStatus.PENDING:
        return None, f"当前状态 {qualification.status.value} 不允许拒绝"
    
    qualification.status = QualificationStatus.REJECTED
    qualification.reviewer_id = reviewer_id
    qualification.review_comment = comment
    qualification.reviewed_at = datetime.utcnow()
    
    record_operation_log(
        db=db,
        request_id=request_id,
        application_id=qualification.application_id,
        operation_type="reject_qualification",
        remark=f"拒绝资质: {qualification.qualification_type}, 原因: {comment[:100]}"
    )
    
    application = db.query(SmsSignApplication).filter(
        SmsSignApplication.id == qualification.application_id
    ).first()
    
    if application and application.status == SignStatus.PENDING_QUALIFICATION:
        update_application_status(
            db=db,
            application_id=application.id,
            new_status=SignStatus.QUALIFICATION_REJECTED,
            request_id=request_id,
            operation_type="auto_qualification_rejected",
            remark="存在被拒绝的资质，自动更新申请状态",
            audit_comment=f"资质审核失败: {comment}"
        )
    
    db.commit()
    db.refresh(qualification)
    
    return qualification, "已拒绝"
