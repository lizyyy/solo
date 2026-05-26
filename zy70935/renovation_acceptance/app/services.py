import json
import hashlib
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from . import models, schemas
from .models import TaskStatus, Conclusion, Node


def _compute_payload_hash(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _generate_batch_no() -> str:
    return f"B{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"


def find_existing_batch(db: Session, payload_dict: dict) -> Optional[models.AcceptanceBatch]:
    digest = _compute_payload_hash(payload_dict)
    return db.query(models.AcceptanceBatch).filter(
        models.AcceptanceBatch.payload_hash == digest
    ).first()


def create_batch(db: Session, req: schemas.CreateBatchRequest) -> models.AcceptanceBatch:
    payload_dict = req.model_dump()
    digest = _compute_payload_hash(payload_dict)
    photos_json = json.dumps(req.photos, ensure_ascii=False)

    batch = models.AcceptanceBatch(
        batch_no=_generate_batch_no(),
        project_name=req.project_name,
        supervisor=req.supervisor,
        node=req.node,
        status=TaskStatus.PROCESSING,
        conclusion=Conclusion.PENDING,
        raw_payload=json.dumps(payload_dict, ensure_ascii=False),
        payload_hash=digest,
        photos=photos_json,
    )
    db.add(batch)
    db.flush()
    return batch


def update_conclusion(
    db: Session,
    batch: models.AcceptanceBatch,
    operator: str,
    reason: str,
    new_status: Optional[TaskStatus],
    new_conclusion: Conclusion,
) -> models.AcceptanceBatch:
    old_status = batch.status
    old_conclusion = batch.conclusion
    changed = False

    if new_status is not None and new_status != old_status:
        db.add(models.AuditLog(
            batch_id=batch.id,
            batch_no=batch.batch_no,
            field_name="status",
            old_value=old_status.value,
            new_value=new_status.value,
            operator=operator,
            reason=reason,
        ))
        batch.status = new_status
        changed = True

    if new_conclusion != old_conclusion:
        db.add(models.AuditLog(
            batch_id=batch.id,
            batch_no=batch.batch_no,
            field_name="conclusion",
            old_value=old_conclusion.value,
            new_value=new_conclusion.value,
            operator=operator,
            reason=reason,
        ))
        batch.conclusion = new_conclusion
        changed = True

    if not changed:
        db.add(models.AuditLog(
            batch_id=batch.id,
            batch_no=batch.batch_no,
            field_name="review_note",
            old_value=None,
            new_value=reason,
            operator=operator,
            reason=reason,
        ))

    if new_conclusion == Conclusion.REWORK_REQUIRED:
        _increment_rework(db, batch.node)

    db.flush()
    return batch


def _increment_rework(db: Session, node: Node) -> None:
    row = db.query(models.ReworkStat).filter(models.ReworkStat.node == node).first()
    if row is None:
        row = models.ReworkStat(node=node, rework_count=0)
        db.add(row)
        db.flush()
    row.rework_count += 1


def mark_exported(db: Session, batch: models.AcceptanceBatch, operator: str, report_path: str) -> None:
    batch.status = TaskStatus.EXPORTED
    db.add(models.AuditLog(
        batch_id=batch.id,
        batch_no=batch.batch_no,
        field_name="status",
        old_value=TaskStatus.MANUAL_CONFIRM.value,
        new_value=TaskStatus.EXPORTED.value,
        operator=operator,
        reason="生成最终验收报告",
    ))
    db.add(models.ExportRecord(
        batch_id=batch.id,
        operator=operator,
        report_path=report_path,
    ))
    db.flush()


def list_audits(db: Session, batch_id: Optional[int] = None) -> List[models.AuditLog]:
    q = db.query(models.AuditLog)
    if batch_id is not None:
        q = q.filter(models.AuditLog.batch_id == batch_id)
    return q.order_by(models.AuditLog.created_at.desc()).all()


def rework_stats(db: Session) -> List[models.ReworkStat]:
    return db.query(models.ReworkStat).order_by(models.ReworkStat.node).all()


def parse_photos(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    try:
        return json.loads(raw)
    except Exception:
        return []


def to_batch_response(batch: models.AcceptanceBatch, duplicated: bool = False) -> schemas.BatchResponse:
    return schemas.BatchResponse(
        id=batch.id,
        batch_no=batch.batch_no,
        project_name=batch.project_name,
        supervisor=batch.supervisor,
        node=batch.node,
        status=batch.status,
        conclusion=batch.conclusion,
        photos=parse_photos(batch.photos),
        created_at=batch.created_at,
        updated_at=batch.updated_at,
        duplicated=duplicated,
    )
