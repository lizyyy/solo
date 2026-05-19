from datetime import datetime
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from models import (
    InterceptRecord,
    WhitelistTag,
    GuardrailReport,
    InterceptRecordCreate,
    WhitelistTagCreate,
    InterceptStatus,
)

CARDINALITY_THRESHOLD = 1000


def estimate_cardinality(tag_set: dict) -> int:
    cardinality = 1
    for key, value in tag_set.items():
        if isinstance(value, list):
            cardinality *= len(value)
        elif isinstance(value, str):
            cardinality *= 100
        elif isinstance(value, (int, float)):
            cardinality *= 1000
    return cardinality


def is_tag_whitelisted(db: Session, metric_name: str, tag_key: str, tag_value: str = None) -> bool:
    whitelist = (
        db.query(WhitelistTag)
        .filter(WhitelistTag.metric_name == metric_name, WhitelistTag.tag_key == tag_key)
        .first()
    )
    if not whitelist:
        return False
    if whitelist.allowed_values is None:
        return True
    if tag_value and tag_value in whitelist.allowed_values:
        return True
    return False


def should_intercept(db: Session, metric_name: str, tag_set: dict, estimated_cardinality: int) -> tuple:
    if estimated_cardinality >= CARDINALITY_THRESHOLD:
        return True, "基数超过阈值", "cardinality_exceeded"

    for tag_key, tag_value in tag_set.items():
        if isinstance(tag_value, list):
            values = tag_value
        else:
            values = [str(tag_value)]

        for v in values:
            if not is_tag_whitelisted(db, metric_name, tag_key, v):
                return True, f"标签 {tag_key}={v} 不在白名单中", "tag_not_whitelisted"

    return False, None, None


def create_intercept_record(db: Session, record: InterceptRecordCreate) -> InterceptRecord:
    db_record = InterceptRecord(
        metric_name=record.metric_name,
        tag_set=record.tag_set,
        estimated_cardinality=record.estimated_cardinality,
        reason=record.reason,
        status=InterceptStatus.PENDING.value,
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


def get_intercept_records(
    db: Session,
    metric_name: Optional[str] = None,
    status: Optional[InterceptStatus] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[InterceptRecord]:
    query = db.query(InterceptRecord)
    if metric_name:
        query = query.filter(InterceptRecord.metric_name == metric_name)
    if status:
        query = query.filter(InterceptRecord.status == status.value)
    return query.order_by(InterceptRecord.created_at.desc()).offset(skip).limit(limit).all()


def get_intercept_record_by_id(db: Session, record_id: int) -> Optional[InterceptRecord]:
    return db.query(InterceptRecord).filter(InterceptRecord.id == record_id).first()


def review_intercept_record(
    db: Session,
    record_id: int,
    reviewer: str,
    status: InterceptStatus,
    review_comment: Optional[str] = None,
) -> Optional[InterceptRecord]:
    record = get_intercept_record_by_id(db, record_id)
    if not record:
        return None
    if record.status != InterceptStatus.PENDING.value:
        raise ValueError("ALREADY_PROCESSED")

    record.status = status.value
    record.reviewer = reviewer
    record.review_comment = review_comment
    record.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    return record


def add_whitelist_tag(db: Session, tag: WhitelistTagCreate) -> WhitelistTag:
    db_tag = WhitelistTag(
        metric_name=tag.metric_name,
        tag_key=tag.tag_key,
        allowed_values=tag.allowed_values,
    )
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag


def get_whitelist_tags(
    db: Session,
    metric_name: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[WhitelistTag]:
    query = db.query(WhitelistTag)
    if metric_name:
        query = query.filter(WhitelistTag.metric_name == metric_name)
    return query.order_by(WhitelistTag.created_at.desc()).offset(skip).limit(limit).all()


def generate_daily_report(db: Session, report_date: str) -> GuardrailReport:
    existing = db.query(GuardrailReport).filter(GuardrailReport.report_date == report_date).first()
    if existing:
        return existing

    records = db.query(InterceptRecord).all()

    total_intercepted = len(records)
    total_approved = len([r for r in records if r.status == InterceptStatus.APPROVED.value])
    total_rejected = len([r for r in records if r.status == InterceptStatus.REJECTED.value])

    metric_counts: Dict[str, int] = {}
    for r in records:
        metric_counts[r.metric_name] = metric_counts.get(r.metric_name, 0) + 1

    top_metrics = sorted(metric_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    report = GuardrailReport(
        report_date=report_date,
        total_intercepted=total_intercepted,
        total_approved=total_approved,
        total_rejected=total_rejected,
        top_metrics=[{"metric": m, "count": c} for m, c in top_metrics],
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def get_reports(
    db: Session,
    skip: int = 0,
    limit: int = 30,
) -> List[GuardrailReport]:
    return db.query(GuardrailReport).order_by(GuardrailReport.report_date.desc()).offset(skip).limit(limit).all()


def export_report_to_csv(report: GuardrailReport) -> str:
    lines = [
        "report_date,total_intercepted,total_approved,total_rejected",
        f"{report.report_date},{report.total_intercepted},{report.total_approved},{report.total_rejected}",
        "",
        "top_metrics",
        "metric,count",
    ]
    for tm in report.top_metrics:
        lines.append(f"{tm['metric']},{tm['count']}")
    return "\n".join(lines)
