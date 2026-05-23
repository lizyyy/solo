from datetime import datetime
from .database import get_session, ImportBatch, AuditLog, CorrectionLog, FailedRecord


def list_import_batches(limit=50):
    session = get_session()

    try:
        batches = (
            session.query(ImportBatch)
            .order_by(ImportBatch.import_time.desc())
            .limit(limit)
            .all()
        )

        result = []
        for batch in batches:
            result.append({
                "id": batch.id,
                "source_type": batch.source_type,
                "file_name": batch.file_name,
                "file_path": batch.file_path,
                "import_time": batch.import_time.strftime("%Y-%m-%d %H:%M:%S"),
                "total_rows": batch.total_rows,
                "success_count": batch.success_count,
                "failed_count": batch.failed_count,
                "imported_by": batch.imported_by,
                "notes": batch.notes,
            })

        return result

    finally:
        session.close()


def get_batch_detail(batch_id):
    session = get_session()

    try:
        batch = session.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
        if not batch:
            return None

        records = [
            {
                "id": r.id,
                "original_row": r.original_row,
                "material_name": r.material_name,
                "quantity": r.quantity,
                "department": r.department,
                "is_valid": r.is_valid,
            }
            for r in batch.records
        ]

        failed_records = [
            {
                "id": f.id,
                "original_row": f.original_row,
                "error_message": f.error_message,
                "is_resolved": f.is_resolved,
                "resolved_record_id": f.resolved_record_id,
            }
            for f in batch.failed_records
        ]

        return {
            "id": batch.id,
            "source_type": batch.source_type,
            "file_name": batch.file_name,
            "file_path": batch.file_path,
            "import_time": batch.import_time.strftime("%Y-%m-%d %H:%M:%S"),
            "total_rows": batch.total_rows,
            "success_count": batch.success_count,
            "failed_count": batch.failed_count,
            "imported_by": batch.imported_by,
            "notes": batch.notes,
            "records": records,
            "failed_records": failed_records,
        }

    finally:
        session.close()


def list_audit_logs(record_id=None, limit=100):
    session = get_session()

    try:
        query = session.query(AuditLog).order_by(AuditLog.operated_at.desc())
        if record_id:
            query = query.filter(AuditLog.record_id == record_id)

        logs = query.limit(limit).all()

        result = []
        for log in logs:
            result.append({
                "id": log.id,
                "record_id": log.record_id,
                "action": log.action,
                "field_name": log.field_name,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "operator": log.operator,
                "operated_at": log.operated_at.strftime("%Y-%m-%d %H:%M:%S"),
                "note": log.note,
            })

        return result

    finally:
        session.close()


def list_correction_logs(record_id=None, limit=100):
    session = get_session()

    try:
        query = session.query(CorrectionLog).order_by(CorrectionLog.corrected_at.desc())
        if record_id:
            query = query.filter(CorrectionLog.record_id == record_id)

        logs = query.limit(limit).all()

        result = []
        for log in logs:
            result.append({
                "id": log.id,
                "record_id": log.record_id,
                "field_name": log.field_name,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "reason": log.reason,
                "corrected_by": log.corrected_by,
                "corrected_at": log.corrected_at.strftime("%Y-%m-%d %H:%M:%S"),
            })

        return result

    finally:
        session.close()


def get_stats():
    session = get_session()

    try:
        from .database import ConsumableRecord

        total_records = session.query(ConsumableRecord).count()
        valid_records = session.query(ConsumableRecord).filter(ConsumableRecord.is_valid == True).count()
        invalid_records = total_records - valid_records
        total_batches = session.query(ImportBatch).count()
        total_failed = session.query(FailedRecord).count()
        unresolved_failed = session.query(FailedRecord).filter(FailedRecord.is_resolved == False).count()
        total_corrections = session.query(CorrectionLog).count()

        return {
            "total_records": total_records,
            "valid_records": valid_records,
            "invalid_records": invalid_records,
            "total_batches": total_batches,
            "total_failed_records": total_failed,
            "unresolved_failed_records": unresolved_failed,
            "total_corrections": total_corrections,
        }

    finally:
        session.close()
