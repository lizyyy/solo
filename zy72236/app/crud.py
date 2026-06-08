from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Any
import json

from . import models, schemas
from .utils import (
    parse_date, safe_float, safe_str, generate_duplicate_key,
    detect_pinyin_approval, calculate_commission, format_date
)


def create_clearing_batch(db: Session, batch: schemas.ClearingBatchCreate) -> models.ClearingBatch:
    db_batch = models.ClearingBatch(
        batch_number=batch.batch_number,
        imported_by=batch.imported_by,
        status=models.ProcessingStatus.IMPORTED
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)

    db_audit = models.AuditLog(
        batch_id=db_batch.id,
        action="batch_created",
        performed_by=batch.imported_by,
        notes=f"清算批次号 {batch.batch_number} 已创建"
    )
    db.add(db_audit)
    db.commit()

    return db_batch


def create_commission_record(
    db: Session,
    batch_id: int,
    record_data: Dict[str, Any],
    original_line_number: int,
    performed_by: str = "system"
) -> models.CommissionRecord:
    transaction_amount = safe_float(record_data.get('transaction_amount'))
    commission_rate = safe_float(record_data.get('commission_rate', 0.005))
    commission_amount, trail_commission = calculate_commission(
        transaction_amount, commission_rate
    )

    split_ratio = safe_float(record_data.get('split_ratio', 1.0))
    final_amount = trail_commission * split_ratio

    approval_name = safe_str(record_data.get('approval_name'))
    is_pinyin, pinyin_msg = detect_pinyin_approval(approval_name)

    transaction_date = parse_date(record_data.get('transaction_date'))
    settlement_date = parse_date(record_data.get('settlement_date'))

    db_record = models.CommissionRecord(
        batch_id=batch_id,
        original_line_number=original_line_number,
        fund_code=safe_str(record_data.get('fund_code')),
        fund_name=safe_str(record_data.get('fund_name')),
        customer_account=safe_str(record_data.get('customer_account')),
        customer_name=safe_str(record_data.get('customer_name')),
        manager_name=safe_str(record_data.get('manager_name')),
        manager_code=safe_str(record_data.get('manager_code')),
        approval_name=approval_name,
        approval_name_is_pinyin=is_pinyin,
        transaction_date=transaction_date,
        settlement_date=settlement_date,
        original_settlement_date=settlement_date,
        transaction_amount=transaction_amount,
        commission_rate=commission_rate,
        commission_amount=safe_float(record_data.get('commission_amount', commission_amount)),
        trail_commission_amount=safe_float(record_data.get('trail_commission_amount', trail_commission)),
        split_ratio=split_ratio,
        final_amount=safe_float(record_data.get('final_amount', final_amount)),
        status=models.ProcessingStatus.IMPORTED,
        needs_manager_review=is_pinyin
    )

    if is_pinyin:
        db_record.status = models.ProcessingStatus.NEEDS_MANAGER_REVIEW

    db.add(db_record)
    db.commit()
    db.refresh(db_record)

    db_audit = models.AuditLog(
        batch_id=batch_id,
        record_id=db_record.id,
        action="record_created",
        performed_by=performed_by,
        notes=f"记录已导入，原始行号: {original_line_number}"
    )
    db.add(db_audit)

    if is_pinyin:
        db_audit_pinyin = models.AuditLog(
            batch_id=batch_id,
            record_id=db_record.id,
            action="pinyin_detected",
            field_name="approval_name",
            old_value="",
            new_value=approval_name,
            performed_by="system",
            notes=pinyin_msg
        )
        db.add(db_audit_pinyin)

    db.commit()

    return db_record


def check_duplicates(db: Session, batch_id: int) -> List[models.CommissionRecord]:
    batch = db.query(models.ClearingBatch).filter(models.ClearingBatch.id == batch_id).first()
    if not batch:
        return []

    all_records = db.query(models.CommissionRecord).filter(
        models.CommissionRecord.batch_id == batch_id
    ).all()

    key_map: Dict[str, List[models.CommissionRecord]] = {}
    duplicates = []

    for record in all_records:
        record_dict = {
            'fund_code': record.fund_code,
            'customer_account': record.customer_account,
            'transaction_date': record.transaction_date,
            'transaction_amount': record.transaction_amount
        }
        key = generate_duplicate_key(record_dict)
        if key in key_map:
            key_map[key].append(record)
        else:
            key_map[key] = [record]

    for key, records in key_map.items():
        if len(records) > 1:
            original = records[0]
            for dup in records[1:]:
                dup.is_duplicate = True
                dup.duplicate_of_id = original.id
                dup.status = models.ProcessingStatus.PENDING_REVIEW
                duplicates.append(dup)

                db_audit = models.AuditLog(
                    batch_id=batch_id,
                    record_id=dup.id,
                    action="duplicate_detected",
                    performed_by="system",
                    notes=f"检测到重复记录，原始记录ID: {original.id}, 原始行号: {original.original_line_number}"
                )
                db.add(db_audit)

    db.commit()
    return duplicates


def update_record(
    db: Session,
    record_id: int,
    update_data: schemas.CommissionRecordUpdate,
    performed_by: str
) -> Optional[models.CommissionRecord]:
    record = db.query(models.CommissionRecord).filter(models.CommissionRecord.id == record_id).first()
    if not record:
        return None

    old_values = {}
    if update_data.approval_name is not None:
        old_values['approval_name'] = record.approval_name
        record.approval_name = update_data.approval_name
        is_pinyin, _ = detect_pinyin_approval(update_data.approval_name)
        record.approval_name_is_pinyin = is_pinyin
        record.needs_manager_review = is_pinyin
        if is_pinyin:
            record.status = models.ProcessingStatus.NEEDS_MANAGER_REVIEW
        elif record.status == models.ProcessingStatus.NEEDS_MANAGER_REVIEW:
            record.status = models.ProcessingStatus.PENDING_REVIEW

    if update_data.settlement_date is not None:
        old_values['settlement_date'] = format_date(record.settlement_date)
        record.settlement_date = update_data.settlement_date

    if update_data.split_ratio is not None:
        old_values['split_ratio'] = str(record.split_ratio)
        record.split_ratio = update_data.split_ratio
        record.final_amount = record.trail_commission_amount * update_data.split_ratio

    record.manually_modified = True
    record.modification_notes = update_data.notes

    for field, old_val in old_values.items():
        db_audit = models.AuditLog(
            batch_id=record.batch_id,
            record_id=record.id,
            action="field_updated",
            field_name=field,
            old_value=str(old_val),
            new_value=str(getattr(record, field)),
            performed_by=performed_by,
            notes=update_data.notes
        )
        db.add(db_audit)

    db.commit()
    db.refresh(record)

    return record


def recalculate_after_update(db: Session, batch_id: int, performed_by: str) -> Dict[str, Any]:
    db.flush()
    
    records = db.query(models.CommissionRecord).filter(
        models.CommissionRecord.batch_id == batch_id,
        models.CommissionRecord.manually_modified == True
    ).all()

    recalculated = []
    for record in records:
        old_final = record.final_amount
        record.final_amount = record.trail_commission_amount * record.split_ratio

        if record.settlement_date != record.original_settlement_date:
            record.source_type = models.SourceType.HOLIDAY_ADJUSTMENT

        db_audit = models.AuditLog(
            batch_id=batch_id,
            record_id=record.id,
            action="recalculated",
            field_name="final_amount",
            old_value=str(old_final),
            new_value=str(record.final_amount),
            performed_by=performed_by,
            notes="补录后重算尾佣金额"
        )
        db.add(db_audit)
        recalculated.append(record.id)

    batch = db.query(models.ClearingBatch).filter(models.ClearingBatch.id == batch_id).first()
    if batch:
        batch.total_amount = sum(
            r.final_amount for r in batch.records if not r.is_duplicate
        )

    db.commit()

    return {
        "batch_id": batch_id,
        "recalculated_count": len(recalculated),
        "recalculated_record_ids": recalculated,
        "new_total": batch.total_amount if batch else 0
    }


def get_batch_records(db: Session, batch_id: int) -> List[models.CommissionRecord]:
    return db.query(models.CommissionRecord).filter(
        models.CommissionRecord.batch_id == batch_id
    ).order_by(models.CommissionRecord.original_line_number).all()


def get_record_audit_logs(db: Session, record_id: int) -> List[models.AuditLog]:
    return db.query(models.AuditLog).filter(
        models.AuditLog.record_id == record_id
    ).order_by(models.AuditLog.performed_at.desc()).all()


def get_batch_audit_logs(db: Session, batch_id: int) -> List[models.AuditLog]:
    return db.query(models.AuditLog).filter(
        models.AuditLog.batch_id == batch_id
    ).order_by(models.AuditLog.performed_at.desc()).all()


def mark_manager_reviewed(
    db: Session,
    record_id: int,
    reviewed_by: str,
    approved: bool
) -> Optional[models.CommissionRecord]:
    record = db.query(models.CommissionRecord).filter(models.CommissionRecord.id == record_id).first()
    if not record:
        return None

    record.manager_reviewed = True
    record.manager_reviewed_by = reviewed_by
    record.manager_reviewed_at = datetime.now()
    record.needs_manager_review = False

    if approved:
        record.status = models.ProcessingStatus.APPROVED
    else:
        record.status = models.ProcessingStatus.REJECTED

    db_audit = models.AuditLog(
        batch_id=record.batch_id,
        record_id=record.id,
        action="manager_review",
        old_value="pending",
        new_value="approved" if approved else "rejected",
        performed_by=reviewed_by,
        notes=f"客户经理已复核，审批人拼音问题"
    )
    db.add(db_audit)
    db.commit()
    db.refresh(record)

    return record


def resolve_duplicate(
    db: Session,
    record_id: int,
    action: str,
    resolved_by: str
) -> Optional[models.CommissionRecord]:
    record = db.query(models.CommissionRecord).filter(models.CommissionRecord.id == record_id).first()
    if not record:
        return None
    if not record.is_duplicate:
        return None

    if action == "skip":
        record.duplicate_resolved = True
        status_note = "确认跳过，不参与余额计算"
    elif action == "keep":
        record.is_duplicate = False
        record.duplicate_of_id = None
        record.duplicate_resolved = True
        record.status = models.ProcessingStatus.PENDING_REVIEW
        status_note = "确认为非重复，参与余额计算"
    else:
        return None

    db_audit = models.AuditLog(
        batch_id=record.batch_id,
        record_id=record.id,
        action="duplicate_resolved",
        field_name="is_duplicate",
        old_value="True",
        new_value="skip" if action == "skip" else "keep",
        performed_by=resolved_by,
        notes=f"重复记录已处理: {status_note}"
    )
    db.add(db_audit)
    db.commit()
    db.refresh(record)

    return record


def get_all_batches(db: Session) -> List[models.ClearingBatch]:
    return db.query(models.ClearingBatch).order_by(models.ClearingBatch.import_date.desc()).all()


def get_batch(db: Session, batch_id: int) -> Optional[models.ClearingBatch]:
    return db.query(models.ClearingBatch).filter(models.ClearingBatch.id == batch_id).first()


def get_unified_record_data(db: Session, batch_id: int) -> List[Dict[str, Any]]:
    records = get_batch_records(db, batch_id)
    result = []
    for r in records:
        result.append({
            "id": r.id,
            "original_line_number": r.original_line_number,
            "fund_code": r.fund_code,
            "fund_name": r.fund_name,
            "customer_account": r.customer_account,
            "customer_name": r.customer_name,
            "manager_name": r.manager_name,
            "manager_code": r.manager_code,
            "approval_name": r.approval_name,
            "approval_name_is_pinyin": r.approval_name_is_pinyin,
            "transaction_date": format_date(r.transaction_date),
            "settlement_date": format_date(r.settlement_date),
            "original_settlement_date": format_date(r.original_settlement_date),
            "transaction_amount": r.transaction_amount,
            "commission_rate": r.commission_rate,
            "commission_amount": r.commission_amount,
            "trail_commission_amount": r.trail_commission_amount,
            "split_ratio": r.split_ratio,
            "final_amount": r.final_amount,
            "source_type": r.source_type,
            "status": r.status,
            "is_duplicate": r.is_duplicate,
            "duplicate_of_id": r.duplicate_of_id,
            "duplicate_resolved": r.duplicate_resolved,
            "manually_modified": r.manually_modified,
            "needs_manager_review": r.needs_manager_review,
            "balance_updated": r.balance_updated,
            "batch_number": r.batch.batch_number if r.batch else "",
            "audit_trail": [
                {
                    "action": log.action,
                    "field_name": log.field_name,
                    "old_value": log.old_value,
                    "new_value": log.new_value,
                    "performed_by": log.performed_by,
                    "performed_at": format_date(log.performed_at),
                    "notes": log.notes
                }
                for log in r.audit_logs
            ]
        })
    return result
