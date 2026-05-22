from datetime import datetime
from sqlalchemy.orm import Session

from .models import (
    ColdChainRecord, RecordIssue, FixHistory, RecordStatus, Role
)
from .database import log_operation


def fix_record_field(session: Session, record_id: int, field_name: str, 
                     new_value: str, fix_reason: str, user) -> FixHistory:
    record = session.query(ColdChainRecord).get(record_id)
    if not record:
        raise ValueError(f"记录不存在: {record_id}")
    
    old_value = str(getattr(record, field_name, ""))
    
    parsed_value = _parse_field_value(field_name, new_value)
    
    fix_history = FixHistory(
        record_id=record.id,
        field_name=field_name,
        old_value=old_value,
        new_value=str(new_value),
        fix_reason=fix_reason,
        operator_id=user.id,
        operator_role=user.role
    )
    
    setattr(record, field_name, parsed_value)
    record.status = RecordStatus.FIXED
    
    session.add(fix_history)
    session.flush()
    
    related_issues = session.query(RecordIssue).filter_by(
        record_id=record.id,
        field_name=field_name,
        resolved=False
    ).all()
    
    for issue in related_issues:
        issue.resolved = True
        issue.resolved_by = user.id
        issue.resolved_at = datetime.now()
    
    session.commit()
    
    log_operation(session, user, "fix_record", "ColdChainRecord", record.id, {
        "field": field_name,
        "old_value": old_value,
        "new_value": new_value,
        "reason": fix_reason
    })
    
    return fix_history


def _parse_field_value(field_name, value):
    if value is None or value == "":
        return None
    
    int_fields = ["quantity", "original_quantity", "temp_exceed_count"]
    float_fields = ["unit_price", "amount", "original_amount", 
                    "min_temp", "max_temp", "avg_temp"]
    date_fields = ["shipment_date", "receive_date", "expected_date"]
    
    if field_name in int_fields:
        try:
            return int(float(value))
        except:
            return None
    elif field_name in float_fields:
        try:
            return float(value)
        except:
            return None
    elif field_name in date_fields:
        try:
            from datetime import datetime
            if isinstance(value, str):
                if " " in value:
                    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                else:
                    return datetime.strptime(value, "%Y-%m-%d")
            return value
        except:
            return None
    else:
        return str(value)


def auto_fix_amount(session: Session, record_id: int, user, reason: str = "自动修正金额计算"):
    record = session.query(ColdChainRecord).get(record_id)
    if not record:
        raise ValueError(f"记录不存在: {record_id}")
    
    if record.quantity and record.unit_price:
        correct_amount = record.quantity * record.unit_price
        return fix_record_field(
            session, record_id, "amount", str(correct_amount), reason, user
        )
    return None


def auto_fix_cross_day(session: Session, record_id: int, user, 
                        reason: str = "确认跨日签收，已审核"):
    record = session.query(ColdChainRecord).get(record_id)
    if not record:
        raise ValueError(f"记录不存在: {record_id}")
    
    issue = session.query(RecordIssue).filter_by(
        record_id=record_id,
        issue_type="cross_day_sign",
        resolved=False
    ).first()
    
    if issue:
        issue.resolved = True
        issue.resolved_by = user.id
        issue.resolved_at = datetime.now()
        
        fix_history = FixHistory(
            record_id=record.id,
            field_name="cross_day",
            old_value="False",
            new_value="True",
            fix_reason=reason,
            operator_id=user.id,
            operator_role=user.role
        )
        session.add(fix_history)
        session.commit()
        
        log_operation(session, user, "resolve_cross_day", "RecordIssue", issue.id, {
            "reason": reason
        })
        
        return fix_history
    return None


def mark_approved(session: Session, record_id: int, user) -> bool:
    if user.role != Role.SUPERVISOR:
        raise PermissionError("只有运营主管可以审批记录")
    
    record = session.query(ColdChainRecord).get(record_id)
    if not record:
        raise ValueError(f"记录不存在: {record_id}")
    
    record.status = RecordStatus.APPROVED
    
    log_operation(session, user, "approve_record", "ColdChainRecord", record_id, {
        "previous_status": record.status.value
    })
    
    session.commit()
    return True


def get_fix_history(session: Session, record_id: int = None, user_id: int = None):
    query = session.query(FixHistory)
    
    if record_id:
        query = query.filter_by(record_id=record_id)
    if user_id:
        query = query.filter_by(operator_id=user_id)
    
    return query.order_by(FixHistory.created_at.desc()).all()


def reimport_fixed_records(session: Session, batch_id: int, user) -> dict:
    from .database import generate_batch_no
    from .models import ImportBatch, DataSource
    
    fixed_records = session.query(ColdChainRecord).filter_by(
        batch_id=batch_id,
        status=RecordStatus.FIXED
    ).all()
    
    if not fixed_records:
        return {"count": 0, "message": "没有已修复的记录需要重新导入"}
    
    original_batch = session.query(ImportBatch).get(batch_id)
    
    new_batch = ImportBatch(
        batch_no=generate_batch_no(),
        source=original_batch.source if original_batch else DataSource.MANUAL_ENTRY,
        filename=f"REIMPORT_{original_batch.filename if original_batch else ''}",
        total_rows=len(fixed_records),
        imported_by=user.id,
        status="reimported",
        notes=f"从批次 {batch_id} 重新导入的已修复记录"
    )
    session.add(new_batch)
    session.flush()
    
    for record in fixed_records:
        fix_histories = session.query(FixHistory).filter_by(
            record_id=record.id
        ).all()
        
        for fh in fix_histories:
            fh.reimported = True
            fh.reimport_batch_id = new_batch.id
        
        record.status = RecordStatus.APPROVED
    
    session.commit()
    
    log_operation(session, user, "reimport_fixed", "ImportBatch", new_batch.id, {
        "source_batch": batch_id,
        "reimported_count": len(fixed_records),
        "new_batch_no": new_batch.batch_no
    })
    
    return {
        "count": len(fixed_records),
        "new_batch_id": new_batch.id,
        "new_batch_no": new_batch.batch_no,
        "message": f"成功重新导入 {len(fixed_records)} 条已修复记录"
    }
