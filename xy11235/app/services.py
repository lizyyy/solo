from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
from typing import List, Optional, Tuple
import uuid

from .models import (
    User, Reagent, ReagentRecord, BatchOperation,
    RecordStatus, ExceptionType, ReagentHazardLevel, UserRole
)
from .schemas import (
    ReagentRecordCreate, ReagentRecordBatchCreate,
    ReagentRecordApprove, ReagentRecordBatchApprove
)


def validate_stock(db: Session, reagent_id: int, quantity: float) -> Tuple[bool, Optional[ExceptionType], str]:
    reagent = db.query(Reagent).filter(Reagent.id == reagent_id).first()
    if not reagent:
        return False, ExceptionType.SYSTEM_ERROR, "试剂不存在"
    if reagent.available_stock < quantity:
        return False, ExceptionType.INSUFFICIENT_STOCK, f"库存不足，可用{reagent.available_stock}{reagent.unit}，申请{quantity}{reagent.unit}"
    return True, None, ""


def validate_hazard_level(db: Session, reagent_id: int, recipient_id: int) -> Tuple[bool, Optional[ExceptionType], str]:
    reagent = db.query(Reagent).filter(Reagent.id == reagent_id).first()
    recipient = db.query(User).filter(User.id == recipient_id).first()
    if not reagent or not recipient:
        return False, ExceptionType.SYSTEM_ERROR, "试剂或领用人不存在"
    if reagent.hazard_level in [ReagentHazardLevel.HIGH, ReagentHazardLevel.EXTREME]:
        if recipient.role != UserRole.TEACHER:
            return False, ExceptionType.HAZARD_APPROVAL_REQUIRED, f"{reagent.hazard_level}危险等级试剂仅教师可领用"
    return True, None, ""


def validate_expiry(db: Session, reagent_id: int) -> Tuple[bool, Optional[ExceptionType], str]:
    reagent = db.query(Reagent).filter(Reagent.id == reagent_id).first()
    if not reagent:
        return False, ExceptionType.SYSTEM_ERROR, "试剂不存在"
    if reagent.expiry_date and reagent.expiry_date < datetime.now():
        return False, ExceptionType.EXPIRED_REAGENT, "试剂已过期"
    return True, None, ""


def validate_record_creation(db: Session, record_data: ReagentRecordCreate) -> Tuple[bool, Optional[ExceptionType], str]:
    valid, exc_type, msg = validate_stock(db, record_data.reagent_id, record_data.quantity)
    if not valid:
        return False, exc_type, msg
    valid, exc_type, msg = validate_hazard_level(db, record_data.reagent_id, record_data.recipient_id)
    if not valid:
        return False, exc_type, msg
    valid, exc_type, msg = validate_expiry(db, record_data.reagent_id)
    if not valid:
        return False, exc_type, msg
    return True, None, ""


def create_reagent_record(db: Session, record_data: ReagentRecordCreate, batch_id: Optional[str] = None) -> ReagentRecord:
    valid, exc_type, msg = validate_record_creation(db, record_data)
    db_record = ReagentRecord(
        reagent_id=record_data.reagent_id,
        quantity=record_data.quantity,
        recipient_id=record_data.recipient_id,
        purpose=record_data.purpose,
        created_by_id=record_data.created_by_id,
        batch_id=batch_id
    )
    if valid:
        db_record.status = RecordStatus.PENDING
        db_record.exception_type = ExceptionType.NONE
    else:
        db_record.status = RecordStatus.REJECTED
        db_record.exception_type = exc_type
        db_record.exception_message = msg
    db.add(db_record)
    db.flush()
    return db_record


def create_batch_records(db: Session, batch_data: ReagentRecordBatchCreate) -> dict:
    batch_id = f"batch_{uuid.uuid4().hex[:8]}"
    batch_op = BatchOperation(
        batch_id=batch_id,
        operation_type="create_records",
        total_count=len(batch_data.records),
        created_by_id=batch_data.created_by_id
    )
    db.add(batch_op)
    db.flush()
    success_ids = []
    failed_items = []
    for idx, record_data in enumerate(batch_data.records):
        try:
            full_record = ReagentRecordCreate(
                **record_data.model_dump(),
                created_by_id=batch_data.created_by_id
            )
            db_record = create_reagent_record(db, full_record, batch_id)
            if db_record.status == RecordStatus.PENDING:
                success_ids.append(db_record.id)
            else:
                failed_items.append({
                    "index": idx,
                    "record_id": db_record.id,
                    "exception_type": db_record.exception_type.value,
                    "message": db_record.exception_message
                })
        except Exception as e:
            failed_items.append({
                "index": idx,
                "record_id": None,
                "exception_type": ExceptionType.SYSTEM_ERROR.value,
                "message": str(e)
            })
    batch_op.success_count = len(success_ids)
    batch_op.failed_count = len(failed_items)
    batch_op.status = "completed"
    batch_op.completed_at = datetime.now()
    db.commit()
    return {
        "batch_id": batch_id,
        "total_count": len(batch_data.records),
        "success_count": len(success_ids),
        "failed_count": len(failed_items),
        "status": "completed",
        "success_ids": success_ids,
        "failed_items": failed_items
    }


def retry_failed_batch_records(db: Session, batch_id: str) -> dict:
    batch_op = db.query(BatchOperation).filter(BatchOperation.batch_id == batch_id).first()
    if not batch_op:
        raise ValueError("批次不存在")
    failed_records = db.query(ReagentRecord).filter(
        and_(
            ReagentRecord.batch_id == batch_id,
            ReagentRecord.status == RecordStatus.REJECTED
        )
    ).all()
    success_ids = []
    failed_items = []
    for record in failed_records:
        valid, exc_type, msg = validate_record_creation(db, ReagentRecordCreate(
            reagent_id=record.reagent_id,
            quantity=record.quantity,
            recipient_id=record.recipient_id,
            purpose=record.purpose,
            created_by_id=record.created_by_id
        ))
        if valid:
            record.status = RecordStatus.PENDING
            record.exception_type = ExceptionType.NONE
            record.exception_message = None
            success_ids.append(record.id)
        else:
            failed_items.append({
                "record_id": record.id,
                "exception_type": exc_type.value,
                "message": msg
            })
    db.commit()
    return {
        "batch_id": batch_id,
        "retry_count": len(failed_records),
        "success_count": len(success_ids),
        "failed_count": len(failed_items),
        "success_ids": success_ids,
        "failed_items": failed_items
    }


def approve_record(db: Session, record_id: int, approve_data: ReagentRecordApprove) -> ReagentRecord:
    record = db.query(ReagentRecord).filter(ReagentRecord.id == record_id).first()
    if not record:
        raise ValueError("记录不存在")
    if record.status != RecordStatus.PENDING:
        raise ValueError(f"记录状态为{record.status.value}，无法审批")
    approver = db.query(User).filter(User.id == approve_data.approved_by_id).first()
    if not approver or approver.role not in [UserRole.TEACHER, UserRole.ADMIN]:
        raise ValueError("审批人权限不足")
    if approve_data.approved:
        record.status = RecordStatus.APPROVED
        record.approved_by_id = approve_data.approved_by_id
        record.approved_at = datetime.now()
    else:
        record.status = RecordStatus.REJECTED
        record.approved_by_id = approve_data.approved_by_id
        record.approved_at = datetime.now()
        record.exception_message = approve_data.reject_reason
    db.commit()
    db.refresh(record)
    return record


def batch_approve_records(db: Session, batch_approve_data: ReagentRecordBatchApprove) -> dict:
    batch_id = f"approve_{uuid.uuid4().hex[:8]}"
    success_ids = []
    failed_items = []
    for record_id in batch_approve_data.record_ids:
        try:
            record = db.query(ReagentRecord).filter(ReagentRecord.id == record_id).first()
            if not record:
                failed_items.append({
                    "record_id": record_id,
                    "exception_type": ExceptionType.SYSTEM_ERROR.value,
                    "message": "记录不存在"
                })
                continue
            if record.status != RecordStatus.PENDING:
                failed_items.append({
                    "record_id": record_id,
                    "exception_type": ExceptionType.SYSTEM_ERROR.value,
                    "message": f"记录状态为{record.status.value}，无法审批"
                })
                continue
            approve_record(db, record_id, ReagentRecordApprove(
                approved_by_id=batch_approve_data.approved_by_id,
                approved=batch_approve_data.approved,
                reject_reason=batch_approve_data.reject_reason
            ))
            success_ids.append(record_id)
        except Exception as e:
            failed_items.append({
                "record_id": record_id,
                "exception_type": ExceptionType.SYSTEM_ERROR.value,
                "message": str(e)
            })
    return {
        "batch_id": batch_id,
        "total_count": len(batch_approve_data.record_ids),
        "success_count": len(success_ids),
        "failed_count": len(failed_items),
        "status": "completed",
        "success_ids": success_ids,
        "failed_items": failed_items
    }


def dispense_record(db: Session, record_id: int, dispensed_by_id: int) -> ReagentRecord:
    record = db.query(ReagentRecord).filter(ReagentRecord.id == record_id).first()
    if not record:
        raise ValueError("记录不存在")
    if record.status != RecordStatus.APPROVED:
        raise ValueError(f"记录状态为{record.status.value}，无法发放")
    reagent = db.query(Reagent).filter(Reagent.id == record.reagent_id).first()
    if reagent.available_stock < record.quantity:
        record.status = RecordStatus.REJECTED
        record.exception_type = ExceptionType.INSUFFICIENT_STOCK
        record.exception_message = "发放时库存不足"
        db.commit()
        raise ValueError("库存不足")
    reagent.available_stock -= record.quantity
    record.status = RecordStatus.DISPENSED
    record.dispensed_at = datetime.now()
    db.commit()
    db.refresh(record)
    return record


def query_records(
    db: Session,
    recipient_id: Optional[int] = None,
    created_by_id: Optional[int] = None,
    approved_by_id: Optional[int] = None,
    status: Optional[RecordStatus] = None,
    exception_type: Optional[ExceptionType] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 20
) -> Tuple[int, List[ReagentRecord]]:
    query = db.query(ReagentRecord)
    if recipient_id:
        query = query.filter(ReagentRecord.recipient_id == recipient_id)
    if created_by_id:
        query = query.filter(ReagentRecord.created_by_id == created_by_id)
    if approved_by_id:
        query = query.filter(ReagentRecord.approved_by_id == approved_by_id)
    if status:
        query = query.filter(ReagentRecord.status == status)
    if exception_type:
        query = query.filter(ReagentRecord.exception_type == exception_type)
    if start_date:
        query = query.filter(ReagentRecord.created_at >= start_date)
    if end_date:
        query = query.filter(ReagentRecord.created_at <= end_date)
    total = query.count()
    records = query.order_by(ReagentRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return total, records
