from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import Optional, List, Dict, Any
from datetime import datetime
import json
import re

from app.models import (
    DataQualityException, ExceptionHitRecord, ExceptionHandlingLog,
    QualityReport, IdempotencyRecord, ExceptionStatus, HandlingResult
)
from app.schemas import (
    DataQualityExceptionCreate, DataQualityExceptionUpdate,
    ExceptionHitRecordCreate, ExceptionHandlingLogCreate,
    QualityReportCreate, ExceptionQueryParams
)


def check_idempotency(db: Session, idempotency_key: str, action: str):
    record = db.query(IdempotencyRecord).filter(
        IdempotencyRecord.idempotency_key == idempotency_key,
        IdempotencyRecord.action == action
    ).first()
    return record


def create_idempotency_record(db: Session, idempotency_key: str, action: str,
                             resource_id: Optional[int] = None,
                             response_data: Optional[Dict] = None):
    db_record = IdempotencyRecord(
        idempotency_key=idempotency_key,
        action=action,
        resource_id=resource_id,
        response_data=response_data
    )
    db.add(db_record)
    db.commit()
    return db_record


def create_exception(db: Session, exception: DataQualityExceptionCreate):
    if exception.idempotency_key:
        existing = check_idempotency(db, exception.idempotency_key, "create_exception")
        if existing:
            return db.query(DataQualityException).filter(
                DataQualityException.id == existing.resource_id
            ).first()

    db_exception = DataQualityException(
        rule_name=exception.rule_name,
        field_path=exception.field_path,
        exception_condition=exception.exception_condition,
        recovery_date=exception.recovery_date,
        description=exception.description,
        created_by=exception.created_by,
        status=ExceptionStatus.PENDING
    )
    db.add(db_exception)
    db.commit()
    db.refresh(db_exception)

    if exception.idempotency_key:
        create_idempotency_record(
            db, exception.idempotency_key, "create_exception",
            db_exception.id, {"id": db_exception.id}
        )

    return db_exception


def get_exception(db: Session, exception_id: int):
    return db.query(DataQualityException).filter(
        DataQualityException.id == exception_id
    ).first()


def get_exceptions(db: Session, params: ExceptionQueryParams):
    query = db.query(DataQualityException)

    if params.rule_name:
        query = query.filter(DataQualityException.rule_name.contains(params.rule_name))
    if params.field_path:
        query = query.filter(DataQualityException.field_path.contains(params.field_path))
    if params.status:
        query = query.filter(DataQualityException.status == params.status)
    if params.created_by:
        query = query.filter(DataQualityException.created_by == params.created_by)
    if params.start_date:
        query = query.filter(DataQualityException.created_at >= params.start_date)
    if params.end_date:
        query = query.filter(DataQualityException.created_at <= params.end_date)

    total = query.count()
    exceptions = query.order_by(DataQualityException.created_at.desc())\
        .offset((params.page - 1) * params.page_size)\
        .limit(params.page_size)\
        .all()

    return total, exceptions


def update_exception_status(db: Session, exception_id: int, status: ExceptionStatus,
                             reviewed_by: Optional[str] = None,
                             review_comment: Optional[str] = None,
                             idempotency_key: Optional[str] = None):
    if idempotency_key:
        existing = check_idempotency(db, idempotency_key, f"status_transition_{exception_id}")
        if existing:
            return get_exception(db, exception_id)

    exception = get_exception(db, exception_id)
    if not exception:
        return None

    old_status = exception.status
    exception.status = status

    if reviewed_by:
        exception.reviewed_by = reviewed_by
        exception.reviewed_at = datetime.utcnow()
    if review_comment:
        exception.review_comment = review_comment

    db.commit()
    db.refresh(exception)

    create_handling_log(db, ExceptionHandlingLogCreate(
        exception_id=exception_id,
        action="status_transition",
        original_input={"old_status": old_status, "new_status": status},
        handling_basis=f"Status transition requested",
        final_conclusion=f"Status changed from {old_status} to {status}",
        result=HandlingResult.SUCCESS,
        handled_by=reviewed_by or "system"
    ))

    if idempotency_key:
        create_idempotency_record(
            db, idempotency_key, f"status_transition_{exception_id}",
            exception_id, {"status": status}
        )

    return exception


def match_exception_condition(condition: Dict[str, Any], field_value: Any) -> bool:
    operator = condition.get("operator")
    expected_value = condition.get("value")

    if operator == "equals":
        return str(field_value) == str(expected_value)
    elif operator == "not_equals":
        return str(field_value) != str(expected_value)
    elif operator == "contains":
        return str(expected_value) in str(field_value)
    elif operator == "greater_than":
        try:
            return float(field_value) > float(expected_value)
        except (ValueError, TypeError):
            return False
    elif operator == "less_than":
        try:
            return float(field_value) < float(expected_value)
        except (ValueError, TypeError):
            return False
    elif operator == "in":
        return field_value in expected_value
    elif operator == "regex":
        try:
            return bool(re.search(str(expected_value), str(field_value)))
        except re.error:
            return False
    return False


def get_nested_value(data: Dict[str, Any], path: str) -> Any:
    keys = path.split('.')
    value = data
    for key in keys:
        if isinstance(value, dict) and key in value:
            value = value[key]
        else:
            return None
    return value


def match_exception(db: Session, rule_name: str, field_path: str, record_data: Dict[str, Any]):
    exceptions = db.query(DataQualityException).filter(
        DataQualityException.rule_name == rule_name,
        DataQualityException.field_path == field_path,
        DataQualityException.status.in_([ExceptionStatus.ACTIVE, ExceptionStatus.PENDING])
    ).all()

    field_value = get_nested_value(record_data, field_path)

    for exception in exceptions:
        if match_exception_condition(exception.exception_condition, field_value):
            return exception

    return None


def create_hit_record(db: Session, hit_record: ExceptionHitRecordCreate, idempotency_key: Optional[str] = None):
    if idempotency_key:
        existing = check_idempotency(db, idempotency_key, f"hit_record")
        if existing:
            return db.query(ExceptionHitRecord).filter(
                ExceptionHitRecord.id == existing.resource_id
            ).first()

    db_hit = ExceptionHitRecord(
        exception_id=hit_record.exception_id,
        record_key=hit_record.record_key,
        record_data=hit_record.record_data
    )
    db.add(db_hit)
    db.commit()
    db.refresh(db_hit)

    if idempotency_key:
        create_idempotency_record(db, idempotency_key, "hit_record", db_hit.id)

    return db_hit


def get_hit_records(db: Session, exception_id: int, page: int = 1, page_size: int = 20):
    query = db.query(ExceptionHitRecord).filter(
        ExceptionHitRecord.exception_id == exception_id
    )
    total = query.count()
    records = query.order_by(ExceptionHitRecord.hit_time.desc())\
        .offset((page - 1) * page_size)\
        .limit(page_size)\
        .all()
    return total, records


def create_handling_log(db: Session, log: ExceptionHandlingLogCreate):
    db_log = ExceptionHandlingLog(
        exception_id=log.exception_id,
        action=log.action,
        original_input=log.original_input,
        handling_basis=log.handling_basis,
        final_conclusion=log.final_conclusion,
        result=log.result,
        error_message=log.error_message,
        handled_by=log.handled_by,
        idempotency_key=log.idempotency_key
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


def get_handling_logs(db: Session, exception_id: Optional[int] = None, page: int = 1, page_size: int = 20):
    query = db.query(ExceptionHandlingLog)
    if exception_id:
        query = query.filter(ExceptionHandlingLog.exception_id == exception_id)
    total = query.count()
    logs = query.order_by(ExceptionHandlingLog.created_at.desc())\
        .offset((page - 1) * page_size)\
        .limit(page_size)\
        .all()
    return total, logs


def correct_hit_records(db: Session, exception_id: int, hit_record_ids: List[int],
                    correction_note: str, corrected_by: str,
                    idempotency_key: Optional[str] = None):
    if idempotency_key:
        existing = check_idempotency(db, idempotency_key, f"manual_correction_{exception_id}")
        if existing:
            return db.query(ExceptionHitRecord).filter(
                ExceptionHitRecord.id.in_(hit_record_ids)
            ).all()

    records = db.query(ExceptionHitRecord).filter(
        ExceptionHitRecord.exception_id == exception_id,
        ExceptionHitRecord.id.in_(hit_record_ids),
        ExceptionHitRecord.is_recovered == False
    ).all()

    now = datetime.utcnow()
    for record in records:
        record.is_recovered = True
        record.recovered_at = now

    db.commit()

    create_handling_log(db, ExceptionHandlingLogCreate(
        exception_id=exception_id,
        action="manual_correction",
        original_input={"hit_record_ids": hit_record_ids, "correction_note": correction_note},
        handling_basis="Manual correction requested",
        final_conclusion=f"Corrected {len(records)} records: {correction_note}",
        result=HandlingResult.SUCCESS,
        handled_by=corrected_by
    ))

    if idempotency_key:
        create_idempotency_record(
            db, idempotency_key, f"manual_correction_{exception_id}",
            exception_id
        )

    return records


def check_expired_exceptions(db: Session):
    now = datetime.utcnow()
    expired = db.query(DataQualityException).filter(
        DataQualityException.recovery_date <= now,
        DataQualityException.status.in_([ExceptionStatus.ACTIVE, ExceptionStatus.PENDING])
    ).all()

    for exception in expired:
        old_status = exception.status
        exception.status = ExceptionStatus.RECOVERED

        hit_records = db.query(ExceptionHitRecord).filter(
            ExceptionHitRecord.exception_id == exception.id,
            ExceptionHitRecord.is_recovered == False
        ).all()

        for record in hit_records:
            record.is_recovered = True
            record.recovered_at = now

        create_handling_log(db, ExceptionHandlingLogCreate(
            exception_id=exception.id,
            action="auto_recovery",
            original_input={"recovery_date": exception.recovery_date.isoformat()},
            handling_basis="Exception expired based on recovery_date",
            final_conclusion=f"Auto-recovered {len(hit_records)} records due to expiration",
            result=HandlingResult.SUCCESS,
            handled_by="system"
        ))

    db.commit()
    return expired


def get_exception_statistics(db: Session, exception_id: int):
    exception = get_exception(db, exception_id)
    if not exception:
        return None

    total_hits = db.query(ExceptionHitRecord).filter(
        ExceptionHitRecord.exception_id == exception_id
    ).count()

    recovered = db.query(ExceptionHitRecord).filter(
        ExceptionHitRecord.exception_id == exception_id,
        ExceptionHitRecord.is_recovered == True
    ).count()

    pending = total_hits - recovered

    return {
        "total_hits": total_hits,
        "recovered_count": recovered,
        "pending_count": pending,
        "status": exception.status,
        "recovery_date": exception.recovery_date
    }


def create_quality_report(db: Session, report: QualityReportCreate, file_path: Optional[str] = None):
    db_report = QualityReport(
        exception_id=report.exception_id,
        report_type=report.report_type,
        total_hits=report.summary.get("total_hits", 0),
        recovered_count=report.summary.get("recovered_count", 0),
        pending_count=report.summary.get("pending_count", 0),
        summary=report.summary,
        generated_by=report.generated_by,
        file_path=file_path
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def get_quality_reports(db: Session, exception_id: Optional[int] = None):
    query = db.query(QualityReport)
    if exception_id:
        query = query.filter(QualityReport.exception_id == exception_id)
    return query.order_by(QualityReport.report_date.desc()).all()
