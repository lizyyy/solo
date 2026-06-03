from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Any, Optional

from . import models, schemas
from .crud import get_batch, get_batch_records
from .utils import format_currency


def get_manager_balances(db: Session, manager_code: Optional[str] = None) -> Dict[str, float]:
    balances: Dict[str, float] = {}

    query = db.query(models.BalanceChange)
    if manager_code:
        query = query.filter(models.BalanceChange.manager_code == manager_code)

    changes = query.all()
    for change in changes:
        if change.manager_code not in balances:
            balances[change.manager_code] = 0.0
        balances[change.manager_code] += change.amount

    return balances


def update_balance_for_record(
    db: Session,
    record_id: int,
    performed_by: str
) -> Optional[Dict[str, Any]]:
    record = db.query(models.CommissionRecord).filter(
        models.CommissionRecord.id == record_id
    ).first()

    if not record:
        return None

    if record.balance_updated:
        return {
            "success": False,
            "message": "该记录余额已更新",
            "record_id": record_id
        }

    if record.is_duplicate:
        return {
            "success": False,
            "message": "重复记录不更新余额",
            "record_id": record_id
        }

    if record.needs_manager_review:
        return {
            "success": False,
            "message": "该记录需客户经理复核后才能更新余额",
            "record_id": record_id
        }

    existing_balance = 0.0
    last_change = db.query(models.BalanceChange).filter(
        models.BalanceChange.manager_code == record.manager_code
    ).order_by(models.BalanceChange.recorded_at.desc()).first()

    if last_change:
        existing_balance = last_change.balance_after

    change_type = "credit" if record.final_amount >= 0 else "debit"
    new_balance = existing_balance + record.final_amount

    source_reference = record.batch.batch_number if record.batch else "未知批次"
    is_pending = record.status == models.ProcessingStatus.NEEDS_MANAGER_REVIEW

    balance_change = models.BalanceChange(
        commission_record_id=record.id,
        manager_code=record.manager_code,
        manager_name=record.manager_name,
        change_type=change_type,
        amount=record.final_amount,
        balance_before=existing_balance,
        balance_after=new_balance,
        source_type=record.source_type,
        source_reference=source_reference,
        is_pending_confirmation=is_pending,
        recorded_by=performed_by
    )
    db.add(balance_change)

    record.balance_updated = True
    record.status = models.ProcessingStatus.BALANCE_UPDATED

    db_audit = models.AuditLog(
        batch_id=record.batch_id,
        record_id=record.id,
        action="balance_updated",
        field_name="balance_updated",
        old_value="False",
        new_value="True",
        performed_by=performed_by,
        notes=f"余额变化表已更新，金额: {format_currency(record.final_amount)}"
    )
    db.add(db_audit)
    db.commit()
    db.refresh(balance_change)
    db.refresh(record)

    return {
        "success": True,
        "record_id": record_id,
        "manager_code": record.manager_code,
        "manager_name": record.manager_name,
        "amount": record.final_amount,
        "balance_before": existing_balance,
        "balance_after": new_balance,
        "source_type": record.source_type,
        "is_pending": is_pending
    }


def update_balance_for_batch(
    db: Session,
    batch_id: int,
    performed_by: str
) -> Dict[str, Any]:
    batch = get_batch(db, batch_id)
    if not batch:
        return {"success": False, "message": "批次不存在"}

    records = get_batch_records(db, batch_id)
    results = []
    success_count = 0
    failed_count = 0

    for record in records:
        result = update_balance_for_record(db, record.id, performed_by)
        if result and result.get("success"):
            success_count += 1
        else:
            failed_count += 1
        results.append(result)

    batch.status = models.ProcessingStatus.BALANCE_UPDATED
    db.commit()
    db.refresh(batch)

    return {
        "success": True,
        "batch_id": batch_id,
        "batch_number": batch.batch_number,
        "total_records": len(records),
        "success_count": success_count,
        "failed_count": failed_count,
        "results": results,
        "message": f"余额更新完成: 成功 {success_count} 条，失败 {failed_count} 条"
    }


def get_balance_changes(
    db: Session,
    manager_code: Optional[str] = None,
    batch_id: Optional[int] = None,
    include_pending: bool = True
) -> List[Dict[str, Any]]:
    query = db.query(models.BalanceChange)

    if manager_code:
        query = query.filter(models.BalanceChange.manager_code == manager_code)

    if batch_id:
        query = query.join(models.CommissionRecord).filter(
            models.CommissionRecord.batch_id == batch_id
        )

    if not include_pending:
        query = query.filter(models.BalanceChange.is_pending_confirmation == False)

    changes = query.order_by(models.BalanceChange.recorded_at.desc()).all()

    result = []
    for change in changes:
        source_label = get_source_label(change.source_type)
        result.append({
            "id": change.id,
            "commission_record_id": change.commission_record_id,
            "manager_code": change.manager_code,
            "manager_name": change.manager_name,
            "change_type": change.change_type,
            "amount": change.amount,
            "amount_display": format_currency(change.amount),
            "balance_before": change.balance_before,
            "balance_before_display": format_currency(change.balance_before),
            "balance_after": change.balance_after,
            "balance_after_display": format_currency(change.balance_after),
            "source_type": change.source_type,
            "source_label": source_label,
            "source_reference": change.source_reference,
            "is_pending_confirmation": change.is_pending_confirmation,
            "pending_label": "待确认" if change.is_pending_confirmation else "已确认",
            "recorded_at": change.recorded_at,
            "recorded_by": change.recorded_by
        })

    return result


def get_balance_summary(db: Session) -> List[Dict[str, Any]]:
    changes = db.query(models.BalanceChange).all()

    summary: Dict[str, Dict[str, Any]] = {}

    for change in changes:
        key = change.manager_code
        if key not in summary:
            summary[key] = {
                "manager_code": change.manager_code,
                "manager_name": change.manager_name,
                "total_credit": 0.0,
                "total_debit": 0.0,
                "pending_amount": 0.0,
                "confirmed_amount": 0.0,
                "current_balance": 0.0,
                "record_count": 0
            }

        if change.change_type == "credit":
            summary[key]["total_credit"] += change.amount
        else:
            summary[key]["total_debit"] += abs(change.amount)

        if change.is_pending_confirmation:
            summary[key]["pending_amount"] += change.amount
        else:
            summary[key]["confirmed_amount"] += change.amount

        summary[key]["current_balance"] += change.amount
        summary[key]["record_count"] += 1

    result = []
    for key, data in summary.items():
        data["total_credit_display"] = format_currency(data["total_credit"])
        data["total_debit_display"] = format_currency(data["total_debit"])
        data["pending_amount_display"] = format_currency(data["pending_amount"])
        data["confirmed_amount_display"] = format_currency(data["confirmed_amount"])
        data["current_balance_display"] = format_currency(data["current_balance"])
        result.append(data)

    return sorted(result, key=lambda x: x["manager_code"])


def get_source_label(source_type: str) -> str:
    labels = {
        models.SourceType.CLEARING_BATCH: "清算批次导入",
        models.SourceType.MANUAL_ENTRY: "手工录入",
        models.SourceType.HOLIDAY_ADJUSTMENT: "节假日调整"
    }
    return labels.get(source_type, "未知来源")
