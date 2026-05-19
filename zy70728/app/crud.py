from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from . import models, schemas
from datetime import datetime
import re
import fnmatch


def get_proxy_rule(db: Session, rule_id: int):
    return db.query(models.ProxyRule).filter(models.ProxyRule.id == rule_id).first()


def get_proxy_rules(db: Session, skip: int = 0, limit: int = 100, is_active: Optional[bool] = None):
    query = db.query(models.ProxyRule)
    if is_active is not None:
        query = query.filter(models.ProxyRule.is_active == is_active)
    return query.order_by(desc(models.ProxyRule.priority), desc(models.ProxyRule.created_at)).offset(skip).limit(limit).all()


def create_proxy_rule(db: Session, rule: schemas.ProxyRuleCreate):
    db_rule = models.ProxyRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


def update_proxy_rule(db: Session, rule_id: int, rule_update: schemas.ProxyRuleUpdate):
    db_rule = get_proxy_rule(db, rule_id)
    if not db_rule:
        return None
    for key, value in rule_update.model_dump(exclude_unset=True).items():
        setattr(db_rule, key, value)
    db.commit()
    db.refresh(db_rule)
    return db_rule


def delete_proxy_rule(db: Session, rule_id: int):
    db_rule = get_proxy_rule(db, rule_id)
    if db_rule:
        db.delete(db_rule)
        db.commit()
    return db_rule


def match_rule(rule: models.ProxyRule, path: str, method: str) -> bool:
    if not rule.is_active:
        return False
    if rule.method != "*" and rule.method.upper() != method.upper():
        return False
    pattern = rule.path_pattern
    if "*" in pattern or "?" in pattern:
        return fnmatch.fnmatch(path, pattern)
    if pattern.startswith("^") or pattern.endswith("$"):
        return bool(re.match(pattern, path))
    return path.startswith(pattern) or path == pattern


def apply_rewrite(rule: models.ProxyRule, path: str) -> str:
    if not rule.rewrite_path:
        return path
    return re.sub(rule.path_pattern, rule.rewrite_path, path) if "*" not in rule.path_pattern else path


def find_matching_rules(db: Session, path: str, method: str) -> List[models.ProxyRule]:
    rules = get_proxy_rules(db, is_active=True)
    matched = [r for r in rules if match_rule(r, path, method)]
    return matched


def get_sample_request(db: Session, sample_id: int):
    return db.query(models.SampleRequest).filter(models.SampleRequest.id == sample_id).first()


def get_sample_requests(db: Session, skip: int = 0, limit: int = 100, source: Optional[str] = None):
    query = db.query(models.SampleRequest)
    if source:
        query = query.filter(models.SampleRequest.source == source)
    return query.order_by(desc(models.SampleRequest.created_at)).offset(skip).limit(limit).all()


def create_sample_request(db: Session, sample: schemas.SampleRequestCreate):
    db_sample = models.SampleRequest(**sample.model_dump())
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    return db_sample


def get_shadow_batch(db: Session, batch_id: int):
    return db.query(models.ShadowBatch).filter(models.ShadowBatch.id == batch_id).first()


def get_shadow_batches(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None):
    query = db.query(models.ShadowBatch)
    if status:
        query = query.filter(models.ShadowBatch.status == status)
    return query.order_by(desc(models.ShadowBatch.created_at)).offset(skip).limit(limit).all()


def create_shadow_batch(db: Session, batch: schemas.ShadowBatchCreate):
    db_batch = models.ShadowBatch(**batch.model_dump())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


def update_shadow_batch(db: Session, batch_id: int, batch_update: schemas.ShadowBatchUpdate):
    db_batch = get_shadow_batch(db, batch_id)
    if not db_batch:
        return None
    for key, value in batch_update.model_dump(exclude_unset=True).items():
        setattr(db_batch, key, value)
    db.commit()
    db.refresh(db_batch)
    return db_batch


def start_batch_execution(db: Session, batch_id: int) -> Optional[models.ShadowBatch]:
    db_batch = get_shadow_batch(db, batch_id)
    if not db_batch or db_batch.status != "pending":
        return None
    db_batch.status = "running"
    db_batch.started_at = datetime.utcnow()
    db.commit()
    db.refresh(db_batch)
    return db_batch


def complete_batch_execution(db: Session, batch_id: int, stats: dict) -> Optional[models.ShadowBatch]:
    db_batch = get_shadow_batch(db, batch_id)
    if not db_batch:
        return None
    db_batch.status = "completed"
    db_batch.completed_at = datetime.utcnow()
    db_batch.total_samples = stats.get("total_samples", 0)
    db_batch.passed_count = stats.get("passed_count", 0)
    db_batch.failed_count = stats.get("failed_count", 0)
    db_batch.diff_count = stats.get("diff_count", 0)
    db.commit()
    db.refresh(db_batch)
    return db_batch


def close_batch(db: Session, batch_id: int, closed_by: str) -> Optional[models.ShadowBatch]:
    db_batch = get_shadow_batch(db, batch_id)
    if not db_batch:
        return None
    db_batch.status = "closed"
    db.commit()
    db.refresh(db_batch)
    return db_batch


def get_hit_result(db: Session, hit_id: int):
    return db.query(models.HitResult).filter(models.HitResult.id == hit_id).first()


def get_hit_results(db: Session, batch_id: Optional[int] = None, has_diff: Optional[bool] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.HitResult)
    if batch_id:
        query = query.filter(models.HitResult.batch_id == batch_id)
    if has_diff is not None:
        query = query.filter(models.HitResult.has_diff == has_diff)
    return query.order_by(desc(models.HitResult.executed_at)).offset(skip).limit(limit).all()


def create_hit_result(db: Session, hit: schemas.HitResultCreate):
    db_hit = models.HitResult(**hit.model_dump())
    db.add(db_hit)
    db.commit()
    db.refresh(db_hit)
    return db_hit


def update_hit_result(db: Session, hit_id: int, hit_update: schemas.HitResultUpdate):
    db_hit = get_hit_result(db, hit_id)
    if not db_hit:
        return None
    update_data = hit_update.model_dump(exclude_unset=True)
    if "executed_at" not in update_data:
        update_data["executed_at"] = datetime.utcnow()
    for key, value in update_data.items():
        setattr(db_hit, key, value)
    db.commit()
    db.refresh(db_hit)
    return db_hit


def get_diff_reason(db: Session, diff_id: int):
    return db.query(models.DiffReason).filter(models.DiffReason.id == diff_id).first()


def get_diff_reasons(db: Session, hit_result_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.DiffReason)
    if hit_result_id:
        query = query.filter(models.DiffReason.hit_result_id == hit_result_id)
    return query.order_by(desc(models.DiffReason.created_at)).offset(skip).limit(limit).all()


def create_diff_reason(db: Session, diff: schemas.DiffReasonCreate):
    db_diff = models.DiffReason(**diff.model_dump())
    db.add(db_diff)
    db.commit()
    db.refresh(db_diff)
    return db_diff


def get_test_report(db: Session, report_id: int):
    return db.query(models.TestReport).filter(models.TestReport.id == report_id).first()


def get_test_reports(db: Session, batch_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.TestReport)
    if batch_id:
        query = query.filter(models.TestReport.batch_id == batch_id)
    return query.order_by(desc(models.TestReport.created_at)).offset(skip).limit(limit).all()


def create_test_report(db: Session, report: schemas.TestReportCreate):
    db_report = models.TestReport(**report.model_dump())
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def get_exception_record(db: Session, record_id: int):
    return db.query(models.ExceptionRecord).filter(models.ExceptionRecord.id == record_id).first()


def get_exception_records(db: Session, batch_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.ExceptionRecord)
    if batch_id:
        query = query.filter(models.ExceptionRecord.batch_id == batch_id)
    return query.order_by(desc(models.ExceptionRecord.created_at)).offset(skip).limit(limit).all()


def create_exception_record(db: Session, record: schemas.ExceptionRecordCreate):
    db_record = models.ExceptionRecord(**record.model_dump())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


def handle_exception_record(db: Session, record_id: int, handler: str, conclusion: str):
    db_record = get_exception_record(db, record_id)
    if not db_record:
        return None
    db_record.handler = handler
    db_record.handle_conclusion = conclusion
    db_record.handled_at = datetime.utcnow()
    db.commit()
    db.refresh(db_record)
    return db_record
