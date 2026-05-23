from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from app import models, schemas
from app.config import get_settings
import uuid
import json

settings = get_settings()


def generate_record_no() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique_id = str(uuid.uuid4())[:8].upper()
    return f"CLN-{timestamp}-{unique_id}"


def validate_record_data(record_data: dict) -> tuple[bool, list[str]]:
    errors = []
    if not record_data.get("source"):
        errors.append("数据源不能为空")
    if record_data.get("price") is not None and record_data.get("price", 0) < 0:
        errors.append("价格不能为负数")
    if record_data.get("checkin_date") and record_data.get("checkout_date"):
        if record_data["checkin_date"] > record_data["checkout_date"]:
            errors.append("入住日期不能晚于退房日期")
    return len(errors) == 0, errors


def create_cleaning_record(
    db: Session,
    record_in: schemas.CleaningRecordCreate,
    user_id: int
) -> models.CleaningRecord:
    record_no = generate_record_no()
    record_dict = record_in.model_dump()
    
    is_valid, validation_errors = validate_record_data(record_dict)
    
    db_record = models.CleaningRecord(
        **record_dict,
        record_no=record_no,
        created_by=user_id,
        is_valid=is_valid,
        validation_errors=json.dumps(validation_errors, ensure_ascii=False) if validation_errors else None,
        status=models.RecordStatus.PENDING if is_valid else models.RecordStatus.FAILED
    )
    db.add(db_record)
    db.flush()
    
    log_operation(
        db=db,
        record_id=db_record.id,
        user_id=user_id,
        action="create",
        old_status=None,
        new_status=db_record.status,
        comment=f"创建记录，来源: {record_in.source.value}"
    )
    
    db.commit()
    db.refresh(db_record)
    return db_record


def log_operation(
    db: Session,
    record_id: int,
    user_id: int,
    action: str,
    old_status: models.RecordStatus = None,
    new_status: models.RecordStatus = None,
    comment: str = None,
    ip_address: str = None
):
    log = models.OperationLog(
        record_id=record_id,
        user_id=user_id,
        action=action,
        old_status=old_status,
        new_status=new_status,
        comment=comment,
        ip_address=ip_address
    )
    db.add(log)


def update_record_status(
    db: Session,
    record_id: int,
    new_status: models.RecordStatus,
    user_id: int,
    comment: str = None,
    retry_category: models.RetryCategory = None
) -> models.CleaningRecord:
    record = db.query(models.CleaningRecord).filter(models.CleaningRecord.id == record_id).first()
    if not record:
        return None
    
    old_status = record.status
    record.status = new_status
    
    if retry_category:
        record.retry_category = retry_category
    
    log_operation(
        db=db,
        record_id=record_id,
        user_id=user_id,
        action="status_update",
        old_status=old_status,
        new_status=new_status,
        comment=comment
    )
    
    db.commit()
    db.refresh(record)
    return record


def enqueue_retry(
    db: Session,
    record_id: int,
    user_id: int,
    scheduled_at: datetime = None,
    error_message: str = None
) -> models.RetryQueue:
    record = db.query(models.CleaningRecord).filter(models.CleaningRecord.id == record_id).first()
    if not record:
        return None
    
    if scheduled_at is None:
        scheduled_at = datetime.now() + timedelta(minutes=settings.RETRY_INTERVAL_MINUTES)
    
    retry_number = record.retry_count + 1
    
    retry_item = models.RetryQueue(
        record_id=record_id,
        retry_number=retry_number,
        scheduled_at=scheduled_at,
        status=models.RecordStatus.PENDING
    )
    db.add(retry_item)
    
    record.retry_count = retry_number
    record.status = models.RecordStatus.RETRYING
    if error_message:
        record.last_error = error_message
    
    log_operation(
        db=db,
        record_id=record_id,
        user_id=user_id,
        action="enqueue_retry",
        old_status=models.RecordStatus.FAILED,
        new_status=models.RecordStatus.RETRYING,
        comment=f"第{retry_number}次重试入队，计划时间: {scheduled_at}"
    )
    
    db.commit()
    db.refresh(retry_item)
    return retry_item


def execute_retry(db: Session, retry_id: int, user_id: int) -> tuple[bool, str]:
    retry_item = db.query(models.RetryQueue).filter(models.RetryQueue.id == retry_id).first()
    if not retry_item:
        return False, "重试项不存在"
    
    record = retry_item.record
    if not record:
        return False, "关联记录不存在"
    
    retry_item.executed_at = datetime.now()
    
    success = simulate_processing(record)
    
    if success:
        retry_item.status = models.RecordStatus.SUCCESS
        retry_item.result = "处理成功"
        record.status = models.RecordStatus.SUCCESS
        record.last_error = None
        log_operation(
            db=db,
            record_id=record.id,
            user_id=user_id,
            action="retry_success",
            old_status=models.RecordStatus.RETRYING,
            new_status=models.RecordStatus.SUCCESS,
            comment=f"第{retry_item.retry_number}次重试成功"
        )
    else:
        retry_item.status = models.RecordStatus.FAILED
        error_msg = "房间冲突：连住换布草与临时退房时间重叠"
        retry_item.error_message = error_msg
        record.last_error = error_msg
        
        if record.retry_count >= record.max_retries:
            record.status = models.RecordStatus.DEAD_LETTER
            new_status = models.RecordStatus.DEAD_LETTER
            comment = f"第{retry_item.retry_number}次重试失败，已达最大重试次数，进入死信队列"
        else:
            record.status = models.RecordStatus.FAILED
            new_status = models.RecordStatus.FAILED
            comment = f"第{retry_item.retry_number}次重试失败"
        
        log_operation(
            db=db,
            record_id=record.id,
            user_id=user_id,
            action="retry_failed",
            old_status=models.RecordStatus.RETRYING,
            new_status=new_status,
            comment=comment
        )
    
    db.commit()
    return success, retry_item.error_message if not success else "成功"


def simulate_processing(record: models.CleaningRecord) -> bool:
    import random
    if record.is_continuous_stay and record.linen_change:
        return random.random() > 0.6
    if record.temp_checkout:
        return random.random() > 0.7
    return random.random() > 0.3


def manual_review(
    db: Session,
    record_id: int,
    user_id: int,
    review_in: schemas.ManualReviewRequest
) -> models.CleaningRecord:
    record = db.query(models.CleaningRecord).filter(models.CleaningRecord.id == record_id).first()
    if not record:
        return None
    
    old_status = record.status
    record.reviewed_by = user_id
    record.reviewed_at = datetime.now()
    record.review_comment = review_in.comment
    
    if review_in.retry_category:
        record.retry_category = review_in.retry_category
    
    if review_in.approve:
        record.status = models.RecordStatus.PENDING
        new_status = models.RecordStatus.PENDING
        action_comment = "人工审核通过，重新进入待处理队列"
    else:
        record.status = models.RecordStatus.MANUAL_REVIEW
        new_status = models.RecordStatus.MANUAL_REVIEW
        action_comment = "人工审核标记，需要进一步处理"
    
    log_operation(
        db=db,
        record_id=record_id,
        user_id=user_id,
        action="manual_review",
        old_status=old_status,
        new_status=new_status,
        comment=review_in.comment
    )
    
    db.commit()
    db.refresh(record)
    return record


def create_compensation(
    db: Session,
    record_id: int,
    comp_in: schemas.CompensationCreate,
    user_id: int
) -> models.Compensation:
    record = db.query(models.CleaningRecord).filter(models.CleaningRecord.id == record_id).first()
    if not record:
        return None
    
    compensation = models.Compensation(
        record_id=record_id,
        amount=comp_in.amount,
        reason=comp_in.reason,
        processed_by=user_id,
        status="completed",
        processed_at=datetime.now()
    )
    db.add(compensation)
    
    old_status = record.status
    record.status = models.RecordStatus.COMPENSATED
    
    log_operation(
        db=db,
        record_id=record_id,
        user_id=user_id,
        action="compensate",
        old_status=old_status,
        new_status=models.RecordStatus.COMPENSATED,
        comment=f"补偿入账: {comp_in.amount}元，原因: {comp_in.reason}"
    )
    
    db.commit()
    db.refresh(compensation)
    return compensation


def close_record(
    db: Session,
    record_id: int,
    user_id: int,
    comment: str = None
) -> models.CleaningRecord:
    record = db.query(models.CleaningRecord).filter(models.CleaningRecord.id == record_id).first()
    if not record:
        return None
    
    old_status = record.status
    record.status = models.RecordStatus.CLOSED
    
    log_operation(
        db=db,
        record_id=record_id,
        user_id=user_id,
        action="close",
        old_status=old_status,
        new_status=models.RecordStatus.CLOSED,
        comment=comment or "记录关闭"
    )
    
    db.commit()
    db.refresh(record)
    return record


def revive_dead_letter(
    db: Session,
    record_id: int,
    user_id: int,
    reset_retries: bool = False
) -> models.CleaningRecord:
    record = db.query(models.CleaningRecord).filter(models.CleaningRecord.id == record_id).first()
    if not record or record.status != models.RecordStatus.DEAD_LETTER:
        return None
    
    old_status = record.status
    record.status = models.RecordStatus.PENDING
    if reset_retries:
        record.retry_count = 0
    
    log_operation(
        db=db,
        record_id=record_id,
        user_id=user_id,
        action="revive_dead_letter",
        old_status=old_status,
        new_status=models.RecordStatus.PENDING,
        comment="死信记录恢复，重新处理"
    )
    
    db.commit()
    db.refresh(record)
    return record
