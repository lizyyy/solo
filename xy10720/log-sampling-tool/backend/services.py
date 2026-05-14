from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
import hashlib
import json
from typing import List, Optional
import models
import schemas


def generate_idempotency_key(data: dict) -> str:
    sorted_data = json.dumps(data, sort_keys=True)
    return hashlib.md5(sorted_data.encode()).hexdigest()


def check_idempotency(db: Session, idempotency_key: str) -> Optional[models.LogSamplingRecord]:
    return db.query(models.LogSamplingRecord).filter(
        models.LogSamplingRecord.request_idempotency_key == idempotency_key
    ).first()


def create_log_sampling_record(db: Session, record: schemas.LogSamplingRecordCreate):
    existing_record = check_idempotency(db, record.request_idempotency_key)
    if existing_record:
        return existing_record, False

    db_record = models.LogSamplingRecord(
        service_name=record.service_name,
        sampling_rule=record.sampling_rule,
        trace_id=record.trace_id,
        error_fragment=record.error_fragment,
        troubleshooting_summary=record.troubleshooting_summary,
        created_by=record.created_by,
        request_idempotency_key=record.request_idempotency_key,
        error_fragment_status="pending" if record.error_fragment else "none",
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)

    create_version(db, db_record, 1, "初始创建", record.created_by or "system")

    return db_record, True


def create_version(
    db: Session,
    record: models.LogSamplingRecord,
    version_number: int,
    change_reason: str,
    changed_by: str
):
    version = models.LogSamplingVersion(
        record_id=record.id,
        version_number=version_number,
        service_name=record.service_name,
        sampling_rule=record.sampling_rule,
        trace_id=record.trace_id,
        error_fragment=record.error_fragment,
        troubleshooting_summary=record.troubleshooting_summary,
        change_reason=change_reason,
        changed_by=changed_by,
    )
    db.add(version)
    db.commit()


def get_record_by_id(db: Session, record_id: int):
    return db.query(models.LogSamplingRecord).filter(models.LogSamplingRecord.id == record_id).first()


def get_record_versions(db: Session, record_id: int):
    return db.query(models.LogSamplingVersion).filter(
        models.LogSamplingVersion.record_id == record_id
    ).order_by(models.LogSamplingVersion.version_number.desc()).all()


def get_version_by_number(db: Session, record_id: int, version_number: int):
    return db.query(models.LogSamplingVersion).filter(
        and_(
            models.LogSamplingVersion.record_id == record_id,
            models.LogSamplingVersion.version_number == version_number
        )
    ).first()


def rollback_to_version(db: Session, record_id: int, version_number: int, rolled_back_by: str):
    record = get_record_by_id(db, record_id)
    if not record:
        return None

    version = get_version_by_number(db, record_id, version_number)
    if not version:
        return None

    latest_version = db.query(models.LogSamplingVersion).filter(
        models.LogSamplingVersion.record_id == record_id
    ).order_by(models.LogSamplingVersion.version_number.desc()).first()

    new_version_number = latest_version.version_number + 1 if latest_version else 1

    record.service_name = version.service_name
    record.sampling_rule = version.sampling_rule
    record.trace_id = version.trace_id
    record.error_fragment = version.error_fragment
    record.troubleshooting_summary = version.troubleshooting_summary

    create_version(
        db,
        record,
        new_version_number,
        f"回滚到版本 {version_number}",
        rolled_back_by
    )

    db.commit()
    db.refresh(record)
    return record


def update_log_sampling_record(
    db: Session,
    record_id: int,
    update_data: schemas.LogSamplingRecordUpdate
):
    record = get_record_by_id(db, record_id)
    if not record:
        return None

    latest_version = db.query(models.LogSamplingVersion).filter(
        models.LogSamplingVersion.record_id == record_id
    ).order_by(models.LogSamplingVersion.version_number.desc()).first()

    new_version_number = latest_version.version_number + 1 if latest_version else 1

    update_dict = update_data.model_dump(exclude_unset=True)
    change_reason = update_dict.pop("change_reason", "修正记录")
    changed_by = update_dict.pop("changed_by", "system")

    for key, value in update_dict.items():
        setattr(record, key, value)

    if update_data.is_manually_confirmed:
        record.confirmed_at = datetime.now()

    create_version(db, record, new_version_number, change_reason, changed_by)

    db.commit()
    db.refresh(record)
    return record


def analyze_error_fragment(error_fragment: str) -> dict:
    if not error_fragment:
        return {"status": "none", "summary": "无错误信息"}

    error_patterns = {
        "timeout": ["timeout", "timed out", "ETIMEDOUT"],
        "null_pointer": ["null", "NullPointerException", "undefined"],
        "database": ["database", "sql", "SQL", "DB", "connection"],
        "network": ["network", "connection refused", "ECONNREFUSED"],
        "authentication": ["auth", "unauthorized", "forbidden", "401", "403"],
    }

    detected_types = []
    for error_type, patterns in error_patterns.items():
        for pattern in patterns:
            if pattern.lower() in error_fragment.lower():
                detected_types.append(error_type)
                break

    if not detected_types:
        detected_types = ["unknown"]

    return {
        "status": "analyzed",
        "error_types": detected_types,
        "summary": f"检测到错误类型: {', '.join(detected_types)}"
    }


def get_records(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    service_name: Optional[str] = None,
    status: Optional[str] = None,
):
    query = db.query(models.LogSamplingRecord)

    if service_name:
        query = query.filter(models.LogSamplingRecord.service_name.contains(service_name))
    if status:
        query = query.filter(models.LogSamplingRecord.status == status)

    total = query.count()
    records = query.order_by(models.LogSamplingRecord.created_at.desc()).offset(skip).limit(limit).all()

    return total, records


def create_saved_query(db: Session, query: schemas.SavedQueryCreate):
    db_query = models.SavedQuery(
        name=query.name,
        query_params=query.query_params,
        description=query.description,
        created_by=query.created_by,
    )
    db.add(db_query)
    db.commit()
    db.refresh(db_query)
    return db_query


def get_saved_queries(db: Session):
    return db.query(models.SavedQuery).order_by(models.SavedQuery.created_at.desc()).all()


def delete_saved_query(db: Session, query_id: int):
    query = db.query(models.SavedQuery).filter(models.SavedQuery.id == query_id).first()
    if query:
        db.delete(query)
        db.commit()
        return True
    return False
