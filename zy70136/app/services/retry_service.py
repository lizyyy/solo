import json
from datetime import datetime, timedelta
from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    RetryQueue, ChannelReceipt, SmsSignApplication,
    RetryType, RetryStatus, ReceiptStatus, SignStatus
)
from app.services.idempotency_service import generate_request_id, record_operation_log
from app.services.channel_service import parse_channel_receipt


def add_to_retry_queue(
    db: Session,
    retry_type: RetryType,
    target_id: str,
    payload: Optional[Dict[str, Any]] = None,
    last_error: Optional[str] = None,
    max_retry_count: Optional[int] = None
) -> Tuple[Optional[RetryQueue], str]:
    existing = db.query(RetryQueue).filter(
        RetryQueue.retry_type == retry_type,
        RetryQueue.target_id == target_id,
        RetryQueue.status.in_([RetryStatus.PENDING, RetryStatus.PROCESSING])
    ).first()
    
    if existing:
        return existing, "该任务已在重试队列中"
    
    retry = RetryQueue(
        request_id=generate_request_id(),
        retry_type=retry_type,
        target_id=target_id,
        status=RetryStatus.PENDING,
        retry_count=0,
        max_retry_count=max_retry_count or settings.MAX_RETRY_COUNT,
        next_retry_at=datetime.utcnow() + timedelta(seconds=settings.RETRY_INTERVAL_SECONDS),
        last_error=last_error,
        payload=json.dumps(payload, ensure_ascii=False) if payload else None
    )
    
    db.add(retry)
    db.commit()
    db.refresh(retry)
    
    return retry, "已加入重试队列"


def get_pending_retries(db: Session, limit: int = 100) -> List[RetryQueue]:
    now = datetime.utcnow()
    return db.query(RetryQueue).filter(
        RetryQueue.status == RetryStatus.PENDING,
        RetryQueue.next_retry_at <= now
    ).order_by(RetryQueue.next_retry_at.asc()).limit(limit).all()


def execute_retry(db: Session, retry_id: int) -> Tuple[bool, str]:
    retry = db.query(RetryQueue).filter(RetryQueue.id == retry_id).first()
    if not retry:
        return False, "重试任务不存在"
    
    if retry.status != RetryStatus.PENDING:
        return False, f"当前状态 {retry.status.value} 不允许执行"
    
    retry.status = RetryStatus.PROCESSING
    retry.retry_count += 1
    db.flush()
    
    try:
        success, result = _execute_retry_by_type(db, retry)
        
        if success:
            retry.status = RetryStatus.SUCCESS
            retry.last_error = None
            db.commit()
            return True, f"重试成功: {result}"
        else:
            return _handle_retry_failure(db, retry, result)
            
    except Exception as e:
        return _handle_retry_failure(db, retry, str(e))


def _handle_retry_failure(db: Session, retry: RetryQueue, error: str) -> Tuple[bool, str]:
    retry.last_error = error
    retry.status = RetryStatus.PENDING
    
    if retry.retry_count >= retry.max_retry_count:
        retry.status = RetryStatus.MAX_RETRY_EXCEEDED
        
        _log_retry_exhausted(db, retry)
        
        db.commit()
        return False, f"已达到最大重试次数({retry.max_retry_count}次): {error}"
    
    retry.next_retry_at = datetime.utcnow() + timedelta(
        seconds=settings.RETRY_INTERVAL_SECONDS * (2 ** (retry.retry_count - 1))
    )
    
    db.commit()
    return False, f"重试失败，将在 {retry.next_retry_at} 后重试: {error}"


def _log_retry_exhausted(db: Session, retry: RetryQueue):
    try:
        if retry.retry_type == RetryType.RECEIPT_PARSE:
            receipt = db.query(ChannelReceipt).filter(
                ChannelReceipt.id == int(retry.target_id)
            ).first()
            if receipt:
                application = db.query(SmsSignApplication).filter(
                    SmsSignApplication.id == receipt.application_id
                ).first()
                if application:
                    application.status = SignStatus.FAILED
                    application.audit_comment = f"回执解析多次失败: {retry.last_error}"
                    
                    record_operation_log(
                        db=db,
                        request_id=generate_request_id(),
                        application_id=application.id,
                        operation_type="retry_exhausted",
                        remark=f"回执解析重试耗尽，最终失败: {retry.last_error[:200]}"
                    )
    except Exception:
        pass


def _execute_retry_by_type(db: Session, retry: RetryQueue) -> Tuple[bool, str]:
    if retry.retry_type == RetryType.RECEIPT_PARSE:
        return _retry_receipt_parse(db, retry.target_id)
    
    elif retry.retry_type == RetryType.CHANNEL_SUBMIT:
        return _retry_channel_submit(db, retry)
    
    elif retry.retry_type == RetryType.QUALIFICATION:
        return _retry_qualification(db, retry)
    
    else:
        return False, f"未知的重试类型: {retry.retry_type}"


def _retry_receipt_parse(db: Session, target_id: str) -> Tuple[bool, str]:
    try:
        receipt_id = int(target_id)
    except ValueError:
        return False, f"无效的回执ID: {target_id}"
    
    receipt, msg = parse_channel_receipt(db, receipt_id)
    if receipt and receipt.status == ReceiptStatus.SUCCESS:
        return True, msg
    return False, msg


def _retry_channel_submit(db: Session, retry: RetryQueue) -> Tuple[bool, str]:
    return False, "渠道提交重试需要调用外部API，此处暂不实现"


def _retry_qualification(db: Session, retry: RetryQueue) -> Tuple[bool, str]:
    return False, "资质审核重试需要人工介入"


def get_retry_by_id(db: Session, retry_id: int) -> Optional[RetryQueue]:
    return db.query(RetryQueue).filter(RetryQueue.id == retry_id).first()


def get_retries_by_target(db: Session, retry_type: RetryType, target_id: str) -> List[RetryQueue]:
    return db.query(RetryQueue).filter(
        RetryQueue.retry_type == retry_type,
        RetryQueue.target_id == target_id
    ).order_by(RetryQueue.created_at.desc()).all()


def cancel_retry(db: Session, retry_id: int) -> Tuple[bool, str]:
    retry = db.query(RetryQueue).filter(RetryQueue.id == retry_id).first()
    if not retry:
        return False, "重试任务不存在"
    
    if retry.status in [RetryStatus.SUCCESS, RetryStatus.MAX_RETRY_EXCEEDED]:
        return False, f"当前状态 {retry.status.value} 不允许取消"
    
    retry.status = RetryStatus.FAILED
    retry.last_error = "手动取消"
    db.commit()
    
    return True, "已取消重试"


def process_batch_retries(db: Session, limit: int = 50) -> Dict[str, int]:
    pending = get_pending_retries(db, limit)
    results = {"success": 0, "failed": 0, "exhausted": 0}
    
    for retry in pending:
        success, _ = execute_retry(db, retry.id)
        if success:
            results["success"] += 1
        else:
            refreshed = get_retry_by_id(db, retry.id)
            if refreshed and refreshed.status == RetryStatus.MAX_RETRY_EXCEEDED:
                results["exhausted"] += 1
            else:
                results["failed"] += 1
    
    return results
