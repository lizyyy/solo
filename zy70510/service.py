import uuid
import hashlib
from datetime import datetime
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models import TaskBatch, ProcessDetail, MergeRecord, Receipt, TaskStatus, TriggerSource
from schemas import TaskBatchCreate, ProcessDetailUpdate, TaskBatchStatusUpdate, ManualFixRequest

VALID_STATUS_TRANSITIONS = {
    TaskStatus.PENDING: {TaskStatus.PROCESSING, TaskStatus.SUCCESS, TaskStatus.FAILED},
    TaskStatus.PROCESSING: {TaskStatus.SUCCESS, TaskStatus.FAILED, TaskStatus.MANUAL_FIXED},
    TaskStatus.SUCCESS: {TaskStatus.MANUAL_FIXED},
    TaskStatus.FAILED: {TaskStatus.MANUAL_FIXED},
    TaskStatus.MANUAL_FIXED: set(),
    TaskStatus.MERGED: set(),
}


def validate_status_transition(current_status: TaskStatus, new_status: TaskStatus) -> Tuple[bool, str]:
    if new_status not in VALID_STATUS_TRANSITIONS.get(current_status, set()):
        return False, f"不允许从 {current_status.value} 转换为 {new_status.value}"
    return True, ""


def generate_receipt_no() -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    random_str = uuid.uuid4().hex[:8].upper()
    return f"RCP{timestamp}{random_str}"


def generate_batch_no() -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    random_str = uuid.uuid4().hex[:6].upper()
    return f"BAT{timestamp}{random_str}"


def generate_detail_no() -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    random_str = uuid.uuid4().hex[:6].upper()
    return f"DTL{timestamp}{random_str}"


def check_idempotent(db: Session, idempotent_key: str) -> Tuple[bool, Optional[TaskBatch]]:
    existing = db.query(TaskBatch).filter(
        TaskBatch.idempotent_key == idempotent_key
    ).first()
    if existing:
        return True, existing
    return False, None


def create_task_batch(db: Session, request: TaskBatchCreate) -> Tuple[TaskBatch, bool]:
    is_duplicate, existing_batch = check_idempotent(db, request.idempotent_key)

    if is_duplicate:
        receipt = db.query(Receipt).filter(
            Receipt.batch_id == existing_batch.id
        ).first()
        return existing_batch, True

    batch_no = generate_batch_no()
    receipt_no = generate_receipt_no()

    items = request.items or []
    total_count = len(items)

    task_batch = TaskBatch(
        batch_no=batch_no,
        batch_name=request.batch_name,
        trigger_source=request.trigger_source,
        idempotent_key=request.idempotent_key,
        total_count=total_count,
        success_count=0,
        failed_count=0,
        status=TaskStatus.PENDING,
        original_input=request.original_input,
        receipt_no=receipt_no,
        operator=request.operator,
        remark=request.remark
    )
    db.add(task_batch)
    db.flush()

    for idx, item in enumerate(items):
        item_key = item.get("item_key") or f"item_{idx}_{uuid.uuid4().hex[:4]}"
        detail = ProcessDetail(
            batch_id=task_batch.id,
            detail_no=generate_detail_no(),
            item_key=item_key,
            item_data=item,
            status=TaskStatus.PENDING
        )
        db.add(detail)

    receipt = Receipt(
        receipt_no=receipt_no,
        batch_id=task_batch.id,
        idempotent_key=request.idempotent_key,
        status=TaskStatus.PENDING,
        issued_by=request.operator
    )
    db.add(receipt)

    db.commit()
    db.refresh(task_batch)
    return task_batch, False


def update_process_detail(db: Session, batch_id: int, updates: List[ProcessDetailUpdate]) -> TaskBatch:
    batch = db.query(TaskBatch).filter(TaskBatch.id == batch_id).first()
    if not batch:
        raise ValueError(f"批次不存在: {batch_id}")

    success_inc = 0
    failed_inc = 0
    success_dec = 0
    failed_dec = 0

    for update in updates:
        detail = db.query(ProcessDetail).filter(
            and_(
                ProcessDetail.batch_id == batch_id,
                ProcessDetail.item_key == update.item_key
            )
        ).first()

        if detail:
            old_status = detail.status
            detail.status = update.status
            detail.result_data = update.result_data
            detail.error_message = update.error_message
            detail.processing_basis = update.processing_basis
            detail.processed_at = datetime.utcnow()
            detail.retry_count += 1

            if old_status not in [TaskStatus.SUCCESS, TaskStatus.FAILED]:
                if update.status == TaskStatus.SUCCESS:
                    success_inc += 1
                elif update.status == TaskStatus.FAILED:
                    failed_inc += 1
            elif old_status != update.status:
                if old_status == TaskStatus.SUCCESS and update.status == TaskStatus.FAILED:
                    success_dec += 1
                    failed_inc += 1
                elif old_status == TaskStatus.FAILED and update.status == TaskStatus.SUCCESS:
                    failed_dec += 1
                    success_inc += 1

    batch.success_count = batch.success_count - success_dec + success_inc
    batch.failed_count = batch.failed_count - failed_dec + failed_inc
    batch.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(batch)
    return batch


def update_batch_status(db: Session, batch_id: int, request: TaskBatchStatusUpdate) -> TaskBatch:
    batch = db.query(TaskBatch).filter(TaskBatch.id == batch_id).first()
    if not batch:
        raise ValueError(f"批次不存在: {batch_id}")

    is_valid, error_msg = validate_status_transition(batch.status, request.status)
    if not is_valid:
        raise ValueError(error_msg)

    batch.status = request.status
    if request.result_snapshot:
        batch.result_snapshot = request.result_snapshot
    if request.error_message:
        batch.error_message = request.error_message
    if request.operator:
        batch.operator = request.operator
    batch.updated_at = datetime.utcnow()

    if request.status in [TaskStatus.SUCCESS, TaskStatus.FAILED]:
        batch.processed_at = datetime.utcnow()

    receipt = db.query(Receipt).filter(Receipt.batch_id == batch_id).first()
    if receipt:
        receipt.status = request.status
        if request.status == TaskStatus.SUCCESS:
            receipt.final_conclusion = "任务执行成功"
            receipt.result_summary = {
                "total": batch.total_count,
                "success": batch.success_count,
                "failed": batch.failed_count
            }
        elif request.status == TaskStatus.FAILED:
            receipt.final_conclusion = f"任务执行失败: {request.error_message or '未知错误'}"
            receipt.result_summary = {
                "total": batch.total_count,
                "success": batch.success_count,
                "failed": batch.failed_count
            }

    db.commit()
    db.refresh(batch)
    return batch


def manual_fix_receipt(db: Session, request: ManualFixRequest) -> Receipt:
    receipt = db.query(Receipt).filter(
        Receipt.receipt_no == request.receipt_no
    ).first()
    if not receipt:
        raise ValueError(f"收据不存在: {request.receipt_no}")

    is_valid, error_msg = validate_status_transition(receipt.status, TaskStatus.MANUAL_FIXED)
    if not is_valid:
        raise ValueError(error_msg)

    batch = db.query(TaskBatch).filter(TaskBatch.id == receipt.batch_id).first()
    if batch:
        batch.status = TaskStatus.MANUAL_FIXED
        batch.updated_at = datetime.utcnow()

    receipt.status = TaskStatus.MANUAL_FIXED
    receipt.final_conclusion = request.final_conclusion
    receipt.issued_by = request.operator
    receipt.issued_at = datetime.utcnow()
    if request.result_summary:
        receipt.result_summary = request.result_summary

    if request.detail_fixes:
        for fix in request.detail_fixes:
            item_key = fix.get("item_key")
            if item_key:
                detail = db.query(ProcessDetail).filter(
                    and_(
                        ProcessDetail.batch_id == receipt.batch_id,
                        ProcessDetail.item_key == item_key
                    )
                ).first()
                if detail:
                    if fix.get("status"):
                        detail.status = fix["status"]
                    if fix.get("result_data"):
                        detail.result_data = fix["result_data"]
                    if fix.get("processing_basis"):
                        detail.processing_basis = fix["processing_basis"]

    db.commit()
    db.refresh(receipt)
    return receipt


def get_receipt_by_no(db: Session, receipt_no: str) -> Optional[Receipt]:
    return db.query(Receipt).filter(Receipt.receipt_no == receipt_no).first()


def get_batch_by_idempotent_key(db: Session, idempotent_key: str) -> Optional[TaskBatch]:
    return db.query(TaskBatch).filter(TaskBatch.idempotent_key == idempotent_key).first()


def query_task_batches(db: Session, query_params):
    filters = []
    if query_params.idempotent_key:
        filters.append(TaskBatch.idempotent_key.like(f"%{query_params.idempotent_key}%"))
    if query_params.batch_no:
        filters.append(TaskBatch.batch_no.like(f"%{query_params.batch_no}%"))
    if query_params.receipt_no:
        filters.append(TaskBatch.receipt_no.like(f"%{query_params.receipt_no}%"))
    if query_params.status:
        filters.append(TaskBatch.status == query_params.status)
    if query_params.trigger_source:
        filters.append(TaskBatch.trigger_source == query_params.trigger_source)
    if query_params.start_time:
        filters.append(TaskBatch.created_at >= query_params.start_time)
    if query_params.end_time:
        filters.append(TaskBatch.created_at <= query_params.end_time)

    query = db.query(TaskBatch)
    if filters:
        query = query.filter(and_(*filters))

    total = query.count()
    offset = (query_params.page - 1) * query_params.page_size
    batches = query.order_by(TaskBatch.created_at.desc()).offset(offset).limit(query_params.page_size).all()

    return batches, total


def get_batch_details(db: Session, batch_id: int) -> List[ProcessDetail]:
    return db.query(ProcessDetail).filter(ProcessDetail.batch_id == batch_id).order_by(ProcessDetail.id).all()


def get_merge_records(db: Session, batch_id: int) -> List[MergeRecord]:
    return db.query(MergeRecord).filter(
        or_(
            MergeRecord.source_batch_id == batch_id,
            MergeRecord.target_batch_id == batch_id
        )
    ).all()


def build_receipt_response(db: Session, batch: TaskBatch, is_duplicate: bool = False) -> Dict[str, Any]:
    receipt = db.query(Receipt).filter(Receipt.batch_id == batch.id).first()
    merged_into = None

    if is_duplicate and batch.status == TaskStatus.MERGED:
        merge_record = db.query(MergeRecord).filter(
            MergeRecord.source_batch_id == batch.id
        ).first()
        if merge_record:
            target_batch = db.query(TaskBatch).filter(
                TaskBatch.id == merge_record.target_batch_id
            ).first()
            if target_batch:
                merged_into = target_batch.receipt_no

    return {
        "receipt_no": batch.receipt_no,
        "batch_id": batch.id,
        "batch_no": batch.batch_no,
        "batch_name": batch.batch_name,
        "idempotent_key": batch.idempotent_key,
        "trigger_source": batch.trigger_source,
        "status": receipt.status if receipt else batch.status,
        "final_conclusion": receipt.final_conclusion if receipt else None,
        "result_summary": receipt.result_summary if receipt else None,
        "total_count": batch.total_count,
        "success_count": batch.success_count,
        "failed_count": batch.failed_count,
        "issued_at": receipt.issued_at if receipt else batch.created_at,
        "issued_by": receipt.issued_by if receipt else batch.operator,
        "is_duplicate": is_duplicate,
        "merged_into": merged_into
    }


def update_export_stats(db: Session, receipt_no: str):
    receipt = get_receipt_by_no(db, receipt_no)
    if receipt:
        receipt.export_count += 1
        receipt.last_exported_at = datetime.utcnow()
        db.commit()
