from datetime import datetime
from .database import get_session, ConsumableRecord, FailedRecord, CorrectionLog, AuditLog


def fix_record(record_id, field_name, new_value, reason="", operator="manual"):
    session = get_session()

    try:
        record = session.query(ConsumableRecord).filter(ConsumableRecord.id == record_id).first()
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        old_value = str(getattr(record, field_name, ""))
        new_value_str = str(new_value)

        if old_value == new_value_str:
            return {"status": "unchanged", "message": "值未变化"}

        field_type = type(getattr(record, field_name))
        if field_type == float:
            converted_value = float(new_value) if new_value else 0.0
        elif field_type == int:
            converted_value = int(new_value) if new_value else 0
        else:
            converted_value = new_value_str

        setattr(record, field_name, converted_value)
        record.updated_at = datetime.now()

        correction = CorrectionLog(
            record_id=record_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value_str,
            reason=reason,
            corrected_by=operator,
            correction_type="manual",
        )
        session.add(correction)

        audit = AuditLog(
            record_id=record_id,
            action="update",
            field_name=field_name,
            old_value=old_value,
            new_value=new_value_str,
            operator=operator,
            note=reason,
        )
        session.add(audit)

        session.commit()

        return {
            "status": "success",
            "record_id": record_id,
            "field": field_name,
            "old_value": old_value,
            "new_value": new_value_str,
        }

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def resolve_failed_record(failed_id, corrections, operator="manual"):
    session = get_session()

    try:
        failed = session.query(FailedRecord).filter(FailedRecord.id == failed_id).first()
        if not failed:
            raise ValueError(f"失败记录不存在: {failed_id}")

        import json
        raw_data = json.loads(failed.raw_data)

        from .importer import parse_date, parse_float
        data = {
            "source_type": failed.source_type,
            "original_row": failed.original_row,
            "batch_id": failed.batch_id,
            "record_date": parse_date(raw_data.get("record_date")),
            "material_code": str(raw_data.get("material_code", "")),
            "material_name": str(corrections.get("material_name", raw_data.get("material_name", ""))),
            "specification": str(raw_data.get("specification", "")),
            "unit": str(raw_data.get("unit", "")),
            "quantity": parse_float(corrections.get("quantity", raw_data.get("quantity", 0))),
            "unit_price": parse_float(raw_data.get("unit_price")),
            "total_price": parse_float(raw_data.get("total_price")),
            "department": str(raw_data.get("department", "")),
            "research_group": str(raw_data.get("research_group", "")),
            "applicant": str(raw_data.get("applicant", "")),
            "receiver": str(raw_data.get("receiver", "")),
            "handler": str(raw_data.get("handler", "")),
            "purpose": str(raw_data.get("purpose", "")),
            "location": str(raw_data.get("location", "")),
            "supplier": str(raw_data.get("supplier", "")),
            "order_no": str(raw_data.get("order_no", "")),
            "receipt_no": str(raw_data.get("receipt_no", "")),
            "remark": f"修正自失败记录#{failed_id}; " + str(raw_data.get("remark", "")),
            "is_valid": True,
        }

        new_record = ConsumableRecord(**data)
        session.add(new_record)
        session.flush()

        failed.is_resolved = True
        failed.resolved_record_id = new_record.id

        audit = AuditLog(
            record_id=new_record.id,
            action="create_from_failed",
            operator=operator,
            note=f"从失败记录#{failed_id}修正后导入",
        )
        session.add(audit)

        session.commit()

        return {
            "status": "success",
            "failed_id": failed_id,
            "new_record_id": new_record.id,
        }

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def invalidate_record(record_id, reason="", operator="manual"):
    session = get_session()

    try:
        record = session.query(ConsumableRecord).filter(ConsumableRecord.id == record_id).first()
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        record.is_valid = False
        record.status = "invalid"
        record.updated_at = datetime.now()

        audit = AuditLog(
            record_id=record_id,
            action="invalidate",
            operator=operator,
            note=reason,
        )
        session.add(audit)

        session.commit()

        return {"status": "success", "record_id": record_id, "action": "invalidate"}

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_failed_records(batch_id=None, unresolved_only=True):
    session = get_session()
    query = session.query(FailedRecord)

    if batch_id:
        query = query.filter(FailedRecord.batch_id == batch_id)
    if unresolved_only:
        query = query.filter(FailedRecord.is_resolved == False)

    records = query.order_by(FailedRecord.created_at.desc()).all()
    result = []

    for r in records:
        result.append({
            "id": r.id,
            "batch_id": r.batch_id,
            "source_type": r.source_type,
            "original_row": r.original_row,
            "error_message": r.error_message,
            "error_type": r.error_type,
            "created_at": r.created_at,
            "is_resolved": r.is_resolved,
            "resolved_record_id": r.resolved_record_id,
        })

    session.close()
    return result
