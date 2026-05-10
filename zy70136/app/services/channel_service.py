import json
from datetime import datetime
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session

from app.models import (
    SmsSignApplication, ChannelReceipt, QualificationAttachment,
    SignStatus, ReceiptStatus, QualificationStatus
)
from app.schemas import ChannelSubmitRequest, ChannelReceiptRequest
from app.services.idempotency_service import (
    check_idempotency, record_operation_log, generate_request_id
)
from app.services.sign_service import update_application_status
from app.services.qualification_service import get_qualifications_by_application


def validate_channel(channel: str) -> bool:
    valid_channels = ["alicloud", "tencent", "huawei", "cmcc", "unicom"]
    return channel.lower() in valid_channels


def submit_to_channel(
    db: Session,
    request: ChannelSubmitRequest
) -> Tuple[Optional[SmsSignApplication], str]:
    idempotent_result = check_idempotency(db, request.request_id, "submit_to_channel")
    if idempotent_result.is_duplicate:
        existing_app = db.query(SmsSignApplication).filter(
            SmsSignApplication.id == request.application_id
        ).first()
        if existing_app:
            return existing_app, idempotent_result.message
    
    application = db.query(SmsSignApplication).filter(
        SmsSignApplication.id == request.application_id
    ).first()
    
    if not application:
        return None, "签名申请不存在"
    
    if application.status not in [SignStatus.QUALIFICATION_APPROVED, SignStatus.CHANNEL_REJECTED, SignStatus.FAILED]:
        return None, f"当前状态 {application.status.value} 不允许提交渠道"
    
    qualifications = get_qualifications_by_application(db, application.id)
    approved_quals = [q for q in qualifications if q.status == QualificationStatus.APPROVED]
    if len(approved_quals) == 0:
        return None, "没有已通过的资质，无法提交渠道"
    
    if not validate_channel(request.channel):
        return None, f"不支持的渠道: {request.channel}"
    
    updated_app, msg = update_application_status(
        db=db,
        application_id=application.id,
        new_status=SignStatus.SUBMITTING_TO_CHANNEL,
        request_id=request.request_id,
        operation_type="submit_to_channel",
        remark=f"提交渠道: {request.channel}"
    )
    
    if not updated_app:
        return None, msg
    
    updated_app.channel = request.channel
    
    try:
        channel_sign_id = _mock_channel_submit(application, request.channel)
        updated_app.channel_sign_id = channel_sign_id
        updated_app.status = SignStatus.CHANNEL_SUBMITTED
        
        record_operation_log(
            db=db,
            request_id=generate_request_id(),
            application_id=application.id,
            operation_type="channel_submit_success",
            from_status=SignStatus.SUBMITTING_TO_CHANNEL.value,
            to_status=SignStatus.CHANNEL_SUBMITTED.value,
            remark=f"渠道提交成功, channel_sign_id={channel_sign_id}"
        )
        
        db.commit()
        db.refresh(updated_app)
        return updated_app, f"渠道提交成功, channel_sign_id={channel_sign_id}"
        
    except Exception as e:
        updated_app.status = SignStatus.FAILED
        updated_app.audit_comment = f"渠道提交失败: {str(e)}"
        
        record_operation_log(
            db=db,
            request_id=generate_request_id(),
            application_id=application.id,
            operation_type="channel_submit_failed",
            from_status=SignStatus.SUBMITTING_TO_CHANNEL.value,
            to_status=SignStatus.FAILED.value,
            remark=f"渠道提交失败: {str(e)[:200]}"
        )
        
        db.commit()
        db.refresh(updated_app)
        return updated_app, f"渠道提交失败: {str(e)}"


def _mock_channel_submit(application: SmsSignApplication, channel: str) -> str:
    import random
    import string
    
    if channel == "fail_simulation":
        raise Exception(f"模拟渠道故障: {channel}")
    
    prefix_map = {
        "alicloud": "ALI",
        "tencent": "TEC",
        "huawei": "HUA",
        "cmcc": "CMC",
        "unicom": "UNI"
    }
    
    prefix = prefix_map.get(channel.lower(), "CHN")
    suffix = ''.join(random.choices(string.digits, k=10))
    return f"{prefix}_{suffix}"


def receive_channel_receipt(
    db: Session,
    request: ChannelReceiptRequest
) -> Tuple[Optional[ChannelReceipt], str]:
    existing_receipt = db.query(ChannelReceipt).filter(
        ChannelReceipt.channel_receipt_id == request.channel_receipt_id,
        ChannelReceipt.channel == request.channel
    ).first()
    
    if existing_receipt:
        if existing_receipt.status == ReceiptStatus.SUCCESS:
            return existing_receipt, "回执已处理成功，幂等返回"
        else:
            return existing_receipt, "回执已存在，但处理中或失败，需要重新解析"
    
    application = db.query(SmsSignApplication).filter(
        SmsSignApplication.id == request.application_id
    ).first()
    
    if not application:
        return None, "签名申请不存在"
    
    if application.status not in [SignStatus.CHANNEL_SUBMITTED, SignStatus.CHANNEL_REJECTED]:
        return None, f"当前状态 {application.status.value} 不支持回执处理"
    
    receipt = ChannelReceipt(
        request_id=request.request_id,
        application_id=request.application_id,
        channel=request.channel,
        channel_receipt_id=request.channel_receipt_id,
        raw_payload=request.raw_payload,
        status=ReceiptStatus.PENDING
    )
    
    db.add(receipt)
    db.flush()
    
    record_operation_log(
        db=db,
        request_id=request.request_id,
        application_id=request.application_id,
        operation_type="receive_receipt",
        remark=f"收到渠道回执: {request.channel_receipt_id}"
    )
    
    db.commit()
    db.refresh(receipt)
    
    return receipt, "回执已接收，等待解析"


def parse_channel_receipt(
    db: Session,
    receipt_id: int
) -> Tuple[Optional[ChannelReceipt], str]:
    receipt = db.query(ChannelReceipt).filter(
        ChannelReceipt.id == receipt_id
    ).first()
    
    if not receipt:
        return None, "回执不存在"
    
    if receipt.status == ReceiptStatus.SUCCESS:
        return receipt, "回执已解析成功"
    
    receipt.status = ReceiptStatus.PROCESSING
    db.flush()
    
    try:
        parsed_result = _parse_receipt_payload(receipt.raw_payload)
        receipt.parsed_result = json.dumps(parsed_result, ensure_ascii=False)
        receipt.processed_at = datetime.utcnow()
        receipt.status = ReceiptStatus.SUCCESS
        
        application = db.query(SmsSignApplication).filter(
            SmsSignApplication.id == receipt.application_id
        ).first()
        
        if application:
            if parsed_result.get("approved"):
                application.status = SignStatus.AUDIT_APPROVED
                application.audit_comment = parsed_result.get("message", "渠道审核通过")
                
                record_operation_log(
                    db=db,
                    request_id=generate_request_id(),
                    application_id=application.id,
                    operation_type="audit_approved",
                    from_status=application.status.value,
                    to_status=SignStatus.AUDIT_APPROVED.value,
                    remark=f"渠道审核通过: {parsed_result.get('message', '')}"
                )
            else:
                application.status = SignStatus.AUDIT_REJECTED
                application.audit_comment = parsed_result.get("message", "渠道审核拒绝")
                
                record_operation_log(
                    db=db,
                    request_id=generate_request_id(),
                    application_id=application.id,
                    operation_type="audit_rejected",
                    from_status=application.status.value,
                    to_status=SignStatus.AUDIT_REJECTED.value,
                    remark=f"渠道审核拒绝: {parsed_result.get('message', '')}"
                )
        
        db.commit()
        db.refresh(receipt)
        return receipt, "回执解析成功"
        
    except Exception as e:
        receipt.status = ReceiptStatus.FAILED
        receipt.error_message = str(e)
        receipt.processed_at = datetime.utcnow()
        
        record_operation_log(
            db=db,
            request_id=generate_request_id(),
            application_id=receipt.application_id,
            operation_type="receipt_parse_failed",
            remark=f"回执解析失败: {str(e)[:200]}"
        )
        
        db.commit()
        db.refresh(receipt)
        return receipt, f"回执解析失败: {str(e)}"


def _parse_receipt_payload(raw_payload: str) -> Dict[str, Any]:
    try:
        data = json.loads(raw_payload)
    except json.JSONDecodeError:
        raise ValueError(f"回执格式错误: 无效的JSON")
    
    status = data.get("status", "").lower()
    message = data.get("message", "")
    sign_id = data.get("signId") or data.get("sign_id")
    
    if not status:
        raise ValueError("回执缺少status字段")
    
    approved_statuses = ["approved", "success", "pass", "通过", "已通过"]
    rejected_statuses = ["rejected", "failed", "fail", "拒绝", "已拒绝", "未通过"]
    
    if status in approved_statuses:
        return {
            "approved": True,
            "status": status,
            "message": message,
            "sign_id": sign_id
        }
    elif status in rejected_statuses:
        return {
            "approved": False,
            "status": status,
            "message": message,
            "sign_id": sign_id
        }
    else:
        raise ValueError(f"未知的审核状态: {status}")


def get_receipt_by_channel_id(
    db: Session,
    channel_receipt_id: str,
    channel: str
) -> Optional[ChannelReceipt]:
    return db.query(ChannelReceipt).filter(
        ChannelReceipt.channel_receipt_id == channel_receipt_id,
        ChannelReceipt.channel == channel
    ).first()
