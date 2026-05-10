import hashlib
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    SmsSignApplication, QualificationAttachment, ChannelReceipt,
    RetryQueue, OperationLog, AuditReport,
    SignStatus, QualificationStatus, ReceiptStatus,
    RetryType, RetryStatus
)
from app.schemas import (
    CreateSignApplicationRequest, UploadQualificationRequest,
    ChannelSubmitRequest, ChannelReceiptRequest,
    IdempotentCheckResult
)


def generate_request_id() -> str:
    return uuid.uuid4().hex


def compute_payload_hash(payload: dict) -> str:
    sorted_str = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(sorted_str.encode('utf-8')).hexdigest()


def check_idempotency(db: Session, request_id: str, operation_type: str) -> IdempotentCheckResult:
    existing_log = db.query(OperationLog).filter(
        OperationLog.request_id == request_id,
        OperationLog.operation_type == operation_type
    ).first()
    
    if existing_log:
        app = db.query(SmsSignApplication).filter(
            SmsSignApplication.id == existing_log.application_id
        ).first()
        return IdempotentCheckResult(
            is_duplicate=True,
            existing_request_id=request_id,
            existing_status=app.status.value if app else None,
            message=f"检测到重复请求: request_id={request_id}, operation={operation_type}"
        )
    
    return IdempotentCheckResult(
        is_duplicate=False,
        existing_request_id=None,
        existing_status=None,
        message="非重复请求"
    )


def validate_sign_name(sign_name: str) -> Tuple[bool, str]:
    if not sign_name or len(sign_name) == 0:
        return False, "签名名称不能为空"
    if len(sign_name) > 32:
        return False, "签名名称长度不能超过32个字符"
    special_chars = set('!@#$%^&*()_+={}[]|\\:;"<>,.?/~`')
    if any(c in special_chars for c in sign_name):
        return False, "签名名称不能包含特殊字符"
    return True, ""


def can_transition_status(current_status: SignStatus, target_status: SignStatus) -> bool:
    valid_transitions = {
        SignStatus.DRAFT: [SignStatus.PENDING_QUALIFICATION],
        SignStatus.PENDING_QUALIFICATION: [SignStatus.QUALIFICATION_APPROVED, SignStatus.QUALIFICATION_REJECTED],
        SignStatus.QUALIFICATION_APPROVED: [SignStatus.SUBMITTING_TO_CHANNEL],
        SignStatus.SUBMITTING_TO_CHANNEL: [SignStatus.CHANNEL_SUBMITTED, SignStatus.FAILED],
        SignStatus.CHANNEL_SUBMITTED: [SignStatus.AUDIT_APPROVED, SignStatus.AUDIT_REJECTED, SignStatus.CHANNEL_REJECTED],
        SignStatus.QUALIFICATION_REJECTED: [SignStatus.PENDING_QUALIFICATION],
        SignStatus.CHANNEL_REJECTED: [SignStatus.SUBMITTING_TO_CHANNEL],
        SignStatus.FAILED: [SignStatus.SUBMITTING_TO_CHANNEL, SignStatus.PENDING_QUALIFICATION],
    }
    return target_status in valid_transitions.get(current_status, [])


def record_operation_log(
    db: Session,
    request_id: str,
    application_id: int,
    operation_type: str,
    from_status: Optional[str] = None,
    to_status: Optional[str] = None,
    operator_id: Optional[str] = None,
    remark: Optional[str] = None
) -> OperationLog:
    log = OperationLog(
        request_id=request_id,
        application_id=application_id,
        operator_id=operator_id,
        operation_type=operation_type,
        from_status=from_status,
        to_status=to_status,
        remark=remark
    )
    db.add(log)
    db.flush()
    return log
