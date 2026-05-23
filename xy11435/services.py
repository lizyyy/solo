from sqlalchemy.orm import Session
from datetime import datetime
from typing import Dict, Any, List, Optional
import json
import uuid

from models import (
    Batch, Receipt, Attachment, OperationLog, DiffRecord,
    BatchStatus, ReceiptStatus, OperationType, SourceType
)
from schemas import BatchCreate, ReceiptImportItem

def generate_batch_no() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    suffix = str(uuid.uuid4())[:6].upper()
    return f"B{timestamp}{suffix}"

def generate_receipt_no() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    suffix = str(uuid.uuid4())[:8].upper()
    return f"R{timestamp}{suffix}"

def calculate_diff(before: Dict[str, Any], after: Dict[str, Any]) -> Dict[str, Any]:
    diff = {}
    all_keys = set(before.keys()) | set(after.keys())
    for key in all_keys:
        b_val = before.get(key)
        a_val = after.get(key)
        if b_val != a_val:
            diff[key] = {
                "old": b_val,
                "new": a_val
            }
    return diff

def create_operation_log(
    db: Session,
    operation_type: OperationType,
    operator: str,
    batch_id: Optional[int] = None,
    receipt_id: Optional[int] = None,
    before_state: Optional[Dict[str, Any]] = None,
    after_state: Optional[Dict[str, Any]] = None,
    remark: Optional[str] = None
) -> OperationLog:
    diff_summary = None
    if before_state and after_state:
        diff_summary = calculate_diff(before_state, after_state)
    
    log = OperationLog(
        batch_id=batch_id,
        receipt_id=receipt_id,
        operation_type=operation_type.value if isinstance(operation_type, OperationType) else operation_type,
        operator=operator,
        before_state=before_state,
        after_state=after_state,
        diff_summary=diff_summary,
        remark=remark
    )
    db.add(log)
    
    if diff_summary:
        for field_name, diff in diff_summary.items():
            diff_record = DiffRecord(
                batch_id=batch_id,
                receipt_id=receipt_id,
                operation_type=operation_type.value if isinstance(operation_type, OperationType) else operation_type,
                field_name=field_name,
                old_value=str(diff.get("old")) if diff.get("old") is not None else None,
                new_value=str(diff.get("new")) if diff.get("new") is not None else None,
                changed_by=operator,
                change_reason=remark
            )
            db.add(diff_record)
    
    db.flush()
    return log

def get_batch_state_dict(batch: Batch) -> Dict[str, Any]:
    return {
        "id": batch.id,
        "batch_no": batch.batch_no,
        "name": batch.name,
        "status": batch.status,
        "is_frozen": batch.is_frozen,
        "source_type": batch.source_type,
        "store_code": batch.store_code,
        "receipt_count": len(batch.receipts)
    }

def get_receipt_state_dict(receipt: Receipt) -> Dict[str, Any]:
    return {
        "id": receipt.id,
        "receipt_no": receipt.receipt_no,
        "room_no": receipt.room_no,
        "status": receipt.status,
        "exception_type": receipt.exception_type,
        "review_result": receipt.review_result,
        "is_manual_overruled": receipt.is_manual_overruled
    }

def can_transition_batch(batch: Batch, target_status: BatchStatus) -> tuple[bool, str]:
    if batch.is_frozen and target_status not in [BatchStatus.ARCHIVED]:
        return False, "批次已冻结，无法进行状态变更"
    
    valid_transitions = {
        BatchStatus.DRAFT: [BatchStatus.SUBMITTED, BatchStatus.WITHDRAWN],
        BatchStatus.SUBMITTED: [BatchStatus.REVIEWING, BatchStatus.WITHDRAWN, BatchStatus.FROZEN],
        BatchStatus.REVIEWING: [BatchStatus.PARTIAL_FAILED, BatchStatus.FROZEN, BatchStatus.WITHDRAWN],
        BatchStatus.PARTIAL_FAILED: [BatchStatus.REVIEWING, BatchStatus.FROZEN, BatchStatus.WITHDRAWN],
        BatchStatus.FROZEN: [BatchStatus.ARCHIVED],
        BatchStatus.WITHDRAWN: [BatchStatus.DRAFT, BatchStatus.SUBMITTED],
        BatchStatus.ARCHIVED: []
    }
    
    if target_status in valid_transitions.get(batch.status, []):
        return True, ""
    return False, f"不允许从 {batch.status} 变更为 {target_status}"

def create_batch(db: Session, batch_data: BatchCreate) -> Batch:
    batch = Batch(
        batch_no=generate_batch_no(),
        name=batch_data.name,
        source_type=batch_data.source_type.value if isinstance(batch_data.source_type, SourceType) else batch_data.source_type,
        operator=batch_data.operator,
        store_code=batch_data.store_code,
        remark=batch_data.remark,
        status=BatchStatus.DRAFT
    )
    db.add(batch)
    db.flush()
    
    create_operation_log(
        db=db,
        operation_type=OperationType.BATCH_CREATE,
        operator=batch_data.operator,
        batch_id=batch.id,
        after_state=get_batch_state_dict(batch),
        remark="创建批次"
    )
    
    db.commit()
    db.refresh(batch)
    return batch

def import_receipts(
    db: Session,
    batch_id: int,
    import_items: List[ReceiptImportItem],
    source_file: str,
    operator: str
) -> Dict[str, Any]:
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise ValueError("批次不存在")
    if batch.is_frozen:
        raise ValueError("批次已冻结，无法导入")
    
    success_count = 0
    failed_count = 0
    failed_items = []
    existing_receipts = {r.receipt_no for r in batch.receipts}
    
    for item in import_items:
        try:
            if item.receipt_no in existing_receipts:
                raise ValueError("回执编号已存在")
            
            parsed_data = item.model_dump(exclude={"source_raw_data"})
            receipt = Receipt(
                batch_id=batch_id,
                receipt_no=item.receipt_no,
                room_no=item.room_no,
                guest_name=item.guest_name,
                exception_type=item.exception_type,
                exception_desc=item.exception_desc,
                source_file=source_file,
                source_row_no=item.source_row_no,
                source_raw_data=item.source_raw_data or {},
                parsed_data=parsed_data,
                status=ReceiptStatus.PENDING
            )
            
            date_fields = [
                ("check_in_date", item.check_in_date),
                ("check_out_date", item.check_out_date),
                ("scheduled_clean_date", item.scheduled_clean_date),
                ("actual_clean_date", item.actual_clean_date)
            ]
            for field_name, date_str in date_fields:
                if date_str:
                    try:
                        setattr(receipt, field_name, datetime.fromisoformat(date_str.replace('Z', '+00:00')))
                    except:
                        pass
            
            db.add(receipt)
            db.flush()
            
            create_operation_log(
                db=db,
                operation_type=OperationType.RECEIPT_IMPORT,
                operator=operator,
                batch_id=batch_id,
                receipt_id=receipt.id,
                after_state=get_receipt_state_dict(receipt),
                remark=f"导入回执: {item.receipt_no}"
            )
            
            existing_receipts.add(item.receipt_no)
            success_count += 1
            
        except Exception as e:
            failed_count += 1
            failed_items.append({
                "receipt_no": item.receipt_no,
                "row_no": item.source_row_no,
                "error": str(e)
            })
    
    db.commit()
    
    if failed_count > 0 and success_count > 0:
        batch.status = BatchStatus.PARTIAL_FAILED
        db.commit()
    
    return {
        "success": success_count,
        "failed": failed_count,
        "total": len(import_items),
        "failed_items": failed_items
    }

def review_receipt(
    db: Session,
    receipt_id: int,
    review_result: str,
    review_reason: str,
    reviewed_by: str
) -> Receipt:
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise ValueError("回执不存在")
    
    batch = db.query(Batch).filter(Batch.id == receipt.batch_id).first()
    if batch and batch.is_frozen:
        raise ValueError("批次已冻结，无法复核")
    
    before_state = get_receipt_state_dict(receipt)
    
    receipt.review_result = review_result
    receipt.review_reason = review_reason
    receipt.reviewed_by = reviewed_by
    receipt.reviewed_at = datetime.now()
    
    if review_result == "confirmed":
        receipt.status = ReceiptStatus.CONFIRMED
    elif review_result == "disputed":
        receipt.status = ReceiptStatus.DISPUTED
    elif review_result == "resolved":
        receipt.status = ReceiptStatus.RESOLVED
    
    after_state = get_receipt_state_dict(receipt)
    
    create_operation_log(
        db=db,
        operation_type=OperationType.RECEIPT_REVIEW,
        operator=reviewed_by,
        batch_id=receipt.batch_id,
        receipt_id=receipt.id,
        before_state=before_state,
        after_state=after_state,
        remark=f"复核结果: {review_result}"
    )
    
    db.commit()
    db.refresh(receipt)
    return receipt

def overrule_receipt(
    db: Session,
    receipt_id: int,
    new_status: ReceiptStatus,
    overrule_reason: str,
    overruled_by: str
) -> Receipt:
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise ValueError("回执不存在")
    
    batch = db.query(Batch).filter(Batch.id == receipt.batch_id).first()
    if batch and batch.is_frozen:
        raise ValueError("批次已冻结，无法改判")
    
    before_state = get_receipt_state_dict(receipt)
    
    receipt.status = new_status.value if isinstance(new_status, ReceiptStatus) else new_status
    receipt.is_manual_overruled = True
    receipt.overrule_reason = overrule_reason
    receipt.overruled_by = overruled_by
    receipt.overruled_at = datetime.now()
    
    after_state = get_receipt_state_dict(receipt)
    
    create_operation_log(
        db=db,
        operation_type=OperationType.RECEIPT_OVERRULE,
        operator=overruled_by,
        batch_id=receipt.batch_id,
        receipt_id=receipt.id,
        before_state=before_state,
        after_state=after_state,
        remark=f"人工改判: {overrule_reason}"
    )
    
    db.commit()
    db.refresh(receipt)
    return receipt

def freeze_batch(
    db: Session,
    batch_id: int,
    frozen_by: str,
    frozen_reason: str
) -> Batch:
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise ValueError("批次不存在")
    if batch.is_frozen:
        raise ValueError("批次已冻结")
    
    before_state = get_batch_state_dict(batch)
    
    for receipt in batch.receipts:
        receipt.before_freeze_status = receipt.status
        receipt.after_freeze_status = receipt.status
    
    batch.is_frozen = True
    batch.frozen_at = datetime.now()
    batch.frozen_by = frozen_by
    batch.frozen_reason = frozen_reason
    batch.status = BatchStatus.FROZEN
    
    after_state = get_batch_state_dict(batch)
    
    create_operation_log(
        db=db,
        operation_type=OperationType.BATCH_FREEZE,
        operator=frozen_by,
        batch_id=batch.id,
        before_state=before_state,
        after_state=after_state,
        remark=f"冻结结算: {frozen_reason}"
    )
    
    db.commit()
    db.refresh(batch)
    return batch

def withdraw_batch(
    db: Session,
    batch_id: int,
    operator: str,
    reason: str
) -> Batch:
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise ValueError("批次不存在")
    if batch.is_frozen:
        raise ValueError("批次已冻结，无法撤回")
    
    can_trans, msg = can_transition_batch(batch, BatchStatus.WITHDRAWN)
    if not can_trans:
        raise ValueError(msg)
    
    before_state = get_batch_state_dict(batch)
    batch.status = BatchStatus.WITHDRAWN
    after_state = get_batch_state_dict(batch)
    
    create_operation_log(
        db=db,
        operation_type=OperationType.BATCH_WITHDRAW,
        operator=operator,
        batch_id=batch.id,
        before_state=before_state,
        after_state=after_state,
        remark=f"撤回归档: {reason}"
    )
    
    db.commit()
    db.refresh(batch)
    return batch

def resubmit_batch(
    db: Session,
    batch_id: int,
    operator: str
) -> Batch:
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise ValueError("批次不存在")
    if batch.is_frozen:
        raise ValueError("批次已冻结，无法重新提交")
    
    if batch.status != BatchStatus.WITHDRAWN:
        raise ValueError("只有已撤回的批次可以重新提交")
    
    before_state = get_batch_state_dict(batch)
    batch.status = BatchStatus.SUBMITTED
    after_state = get_batch_state_dict(batch)
    
    create_operation_log(
        db=db,
        operation_type=OperationType.BATCH_SUBMIT,
        operator=operator,
        batch_id=batch.id,
        before_state=before_state,
        after_state=after_state,
        remark="撤回后重新提交"
    )
    
    db.commit()
    db.refresh(batch)
    return batch

def archive_batch(
    db: Session,
    batch_id: int,
    operator: str
) -> Batch:
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise ValueError("批次不存在")
    if not batch.is_frozen:
        raise ValueError("只有已冻结的批次可以归档")
    
    before_state = get_batch_state_dict(batch)
    batch.status = BatchStatus.ARCHIVED
    after_state = get_batch_state_dict(batch)
    
    create_operation_log(
        db=db,
        operation_type=OperationType.BATCH_ARCHIVE,
        operator=operator,
        batch_id=batch.id,
        before_state=before_state,
        after_state=after_state,
        remark="批次归档"
    )
    
    db.commit()
    db.refresh(batch)
    return batch
