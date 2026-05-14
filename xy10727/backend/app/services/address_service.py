from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from datetime import datetime
import json

from app.models.database import AddressRecord, OperationLog, ReviewRecord, User
from app.schemas.address import AddressCreate, AddressUpdate, ManualCorrectionRequest, ReviewCreate


def create_address_record(db: Session, address: AddressCreate, operator_id: int = 1):
    db_address = AddressRecord(**address.model_dump())
    db.add(db_address)
    db.commit()
    db.refresh(db_address)

    log_operation(db, db_address.id, operator_id, "create", "", json.dumps(address.model_dump(), ensure_ascii=False), "创建地址记录")

    return db_address


def get_address_record(db: Session, record_id: int):
    return db.query(AddressRecord).filter(AddressRecord.id == record_id).first()


def get_address_records(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    is_failed: Optional[bool] = None,
    search: Optional[str] = None
):
    query = db.query(AddressRecord)

    if status:
        query = query.filter(AddressRecord.status == status)
    if is_failed is not None:
        query = query.filter(AddressRecord.is_failed == is_failed)
    if search:
        query = query.filter(or_(
            AddressRecord.original_address.contains(search),
            AddressRecord.geocoding_result.contains(search)
        ))

    total = query.count()
    records = query.order_by(AddressRecord.created_at.desc()).offset(skip).limit(limit).all()

    return total, records


def update_address_record(db: Session, record_id: int, address_update: AddressUpdate, operator_id: int = 1):
    db_address = get_address_record(db, record_id)
    if not db_address:
        return None

    old_values = {
        "original_address": db_address.original_address,
        "geocoding_result": db_address.geocoding_result,
        "candidate_coordinates": db_address.candidate_coordinates,
        "manual_correction": db_address.manual_correction,
        "delivery_range": db_address.delivery_range,
        "hit_report": db_address.hit_report,
        "status": db_address.status,
        "is_failed": db_address.is_failed,
        "failure_reason": db_address.failure_reason
    }

    for field, value in address_update.model_dump(exclude_unset=True).items():
        setattr(db_address, field, value)

    db_address.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_address)

    new_values = {k: getattr(db_address, k) for k in old_values.keys()}
    log_operation(
        db, record_id, operator_id, "update",
        json.dumps(old_values, ensure_ascii=False),
        json.dumps(new_values, ensure_ascii=False),
        "更新地址记录"
    )

    return db_address


def manual_correction(db: Session, record_id: int, request: ManualCorrectionRequest, operator_id: int = 1):
    db_address = get_address_record(db, record_id)
    if not db_address:
        return None

    old_correction = db_address.manual_correction
    db_address.manual_correction = request.manual_correction
    db_address.status = "corrected"
    db_address.processed_by = operator_id
    db_address.processed_at = datetime.utcnow()
    db_address.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(db_address)

    log_operation(
        db, record_id, operator_id, "manual_correction",
        old_correction or "", request.manual_correction,
        request.reason
    )

    return db_address


def review_record(db: Session, record_id: int, review: ReviewCreate, operator_id: int = 1):
    db_address = get_address_record(db, record_id)
    if not db_address:
        return None

    db_review = ReviewRecord(
        address_record_id=record_id,
        reviewer_id=operator_id,
        review_result=review.review_result,
        review_comment=review.review_comment
    )
    db.add(db_review)

    old_status = db_address.status
    if review.review_result == "pass":
        db_address.status = "reviewed"
        db_address.is_failed = False
    else:
        db_address.status = "pending"
        db_address.is_failed = True

    db_address.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_address)
    db.refresh(db_review)

    log_operation(
        db, record_id, operator_id, "review",
        old_status, db_address.status,
        review.review_comment or f"复核结果: {review.review_result}"
    )

    return db_review


def batch_compare(db: Session, record_ids: List[int]):
    records = db.query(AddressRecord).filter(AddressRecord.id.in_(record_ids)).all()
    results = []

    for record in records:
        is_match = check_geocoding_match(record)
        old_failed = record.is_failed
        record.is_failed = not is_match
        record.status = "matched" if is_match else "failed"
        if not is_match:
            record.failure_reason = "地理编码与候选坐标不匹配"
        record.updated_at = datetime.utcnow()

        if old_failed != record.is_failed:
            log_operation(
                db, record.id, 1, "compare",
                str(old_failed), str(record.is_failed),
                record.failure_reason if record.is_failed else "比对通过"
            )

        results.append({
            "id": record.id,
            "original_address": record.original_address,
            "is_match": is_match,
            "status": record.status
        })

    db.commit()
    return results


def check_geocoding_match(record: AddressRecord) -> bool:
    if not record.geocoding_result or not record.candidate_coordinates:
        return False

    try:
        geocoding = json.loads(record.geocoding_result)
        candidates = json.loads(record.candidate_coordinates)
    except:
        return False

    geo_lat = geocoding.get("lat")
    geo_lng = geocoding.get("lng")

    if not geo_lat or not geo_lng:
        return False

    for candidate in candidates:
        cand_lat = candidate.get("lat")
        cand_lng = candidate.get("lng")
        if cand_lat and cand_lng:
            lat_diff = abs(float(geo_lat) - float(cand_lat))
            lng_diff = abs(float(geo_lng) - float(cand_lng))
            if lat_diff < 0.01 and lng_diff < 0.01:
                return True

    return False


def log_operation(db: Session, record_id: int, operator_id: int, operation_type: str, old_value: str, new_value: str, reason: str):
    log = OperationLog(
        record_id=record_id,
        operator_id=operator_id,
        operation_type=operation_type,
        old_value=old_value,
        new_value=new_value,
        reason=reason
    )
    db.add(log)
    db.commit()


def get_operation_logs(db: Session, record_id: int):
    logs = db.query(OperationLog, User.username).join(User, OperationLog.operator_id == User.id).filter(OperationLog.record_id == record_id).all()
    result = []
    for log, username in logs:
        log_dict = {c.name: getattr(log, c.name) for c in log.__table__.columns}
        log_dict["operator_username"] = username
        result.append(log_dict)
    return result


def get_reviews(db: Session, record_id: int):
    reviews = db.query(ReviewRecord, User.username).join(User, ReviewRecord.reviewer_id == User.id).filter(ReviewRecord.address_record_id == record_id).all()
    result = []
    for review, username in reviews:
        review_dict = {c.name: getattr(review, c.name) for c in review.__table__.columns}
        review_dict["reviewer_username"] = username
        result.append(review_dict)
    return result


def recalculate_by_geocoding_version(db: Session, old_version: str, new_version: str = "v2"):
    records = db.query(AddressRecord).filter(AddressRecord.geocoding_version == old_version).all()
    updated_count = 0

    for record in records:
        old_status = record.status
        old_failed = record.is_failed

        record.geocoding_version = new_version
        record.status = "recalculating"
        is_match = check_geocoding_match(record)

        if is_match:
            record.status = "matched"
            record.is_failed = False
            record.failure_reason = None
        else:
            record.status = "failed"
            record.is_failed = True
            record.failure_reason = "地理编码版本更新后重新计算不匹配"

        record.updated_at = datetime.utcnow()

        if old_failed != record.is_failed or old_status != record.status:
            log_operation(
                db, record.id, 1, "recalculate",
                f"{old_version}: {old_status}",
                f"{new_version}: {record.status}",
                f"地理编码版本从 {old_version} 升级到 {new_version} 后重新计算"
            )
            updated_count += 1

    db.commit()
    return {"updated_count": updated_count, "total_records": len(records)}


def delete_address_record(db: Session, record_id: int):
    db_address = get_address_record(db, record_id)
    if not db_address:
        return False

    db.query(OperationLog).filter(OperationLog.record_id == record_id).delete()
    db.query(ReviewRecord).filter(ReviewRecord.address_record_id == record_id).delete()
    db.delete(db_address)
    db.commit()
    return True
