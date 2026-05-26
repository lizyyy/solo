import csv
import io
import json
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy.orm import Session

from app.models import Appeal, Batch, QCEvent, QCItem, QC_ITEM_STATUSES
from app.schemas import (
    BatchCreateRequest,
    MarkProcessedRequest,
    ReturnRequest,
    SecondReviewRequest,
    ApproveRequest,
    RejectRequest,
    CancelDeductionRequest,
    ScoreWritebackRequest,
    QueryRequest,
)


# ---------- helpers ----------

def _now() -> datetime:
    return datetime.utcnow()


def _append_event(
    db: Session,
    item: QCItem,
    action: str,
    actor: str,
    reason: Optional[str] = None,
    from_status: Optional[str] = None,
    to_status: Optional[str] = None,
    detail: Optional[Dict[str, Any]] = None,
) -> QCEvent:
    max_seq = (
        db.query(QCEvent.seq)
        .filter(QCEvent.item_id == item.id)
        .order_by(QCEvent.seq.desc())
        .first()
    )
    seq = (max_seq[0] if max_seq else 0) + 1
    event = QCEvent(
        item_id=item.id,
        seq=seq,
        action=action,
        actor=actor,
        reason=reason,
        from_status=from_status,
        to_status=to_status,
        detail=detail,
        created_at=_now(),
    )
    db.add(event)
    return event


def _validate_status_transition(from_status: str, to_status: str) -> None:
    if from_status not in QC_ITEM_STATUSES or to_status not in QC_ITEM_STATUSES:
        raise ValueError(f"非法状态: {from_status} -> {to_status}")


def _get_item_or_404(db: Session, item_id: int) -> QCItem:
    item = db.query(QCItem).filter(QCItem.id == item_id).first()
    if not item:
        raise LookupError(f"未找到质检记录 id={item_id}")
    return item


# ---------- batch ----------

def create_batch(db: Session, req: BatchCreateRequest) -> Batch:
    if db.query(Batch).filter(Batch.name == req.name).first():
        raise ValueError(f"批次名已存在: {req.name}")
    batch = Batch(
        name=req.name,
        operator=req.operator,
        source=req.source,
        meta=req.meta,
        remark=req.remark,
        created_at=_now(),
    )
    db.add(batch)
    db.flush()
    return batch


def import_qc_rows(
    db: Session,
    batch: Batch,
    rows: List[Dict[str, Any]],
) -> int:
    """
    批量导入质检行。每条 row 应包含关键字段：
      agent_id, agent_name(optional), category(optional),
      deduction_item, deduction_score, original_score,
      final_score(optional, 同 original_score),
      call_date(optional), call_id(optional),
      recording_summary(optional), note(optional)
    """
    if db.query(QCItem).filter(QCItem.batch_id == batch.id).first():
        raise ValueError(f"批次 {batch.name} 已经存在记录, 不能重复导入")
    imported = 0
    for idx, row in enumerate(rows, start=1):
        original = float(row.get("original_score", 0) or 0)
        final = float(row.get("final_score", original) or original)
        item = QCItem(
            batch_id=batch.id,
            row_no=idx,
            agent_id=str(row.get("agent_id", "")).strip() or f"unknown-{idx}",
            agent_name=row.get("agent_name"),
            category=row.get("category"),
            deduction_item=row.get("deduction_item"),
            deduction_score=float(row.get("deduction_score", 0) or 0),
            original_score=original,
            final_score=final,
            call_date=row.get("call_date"),
            call_id=row.get("call_id"),
            recording_summary=row.get("recording_summary"),
            source_payload=row,
            status="pending",
            handler=None,
            reviewed_by=None,
            note=row.get("note"),
            created_at=_now(),
            updated_at=_now(),
        )
        db.add(item)
        db.flush()
        _append_event(
            db,
            item,
            action="import",
            actor=batch.operator,
            reason=row.get("note"),
            from_status=None,
            to_status="pending",
            detail={"batch_name": batch.name, "row_no": idx},
        )
        imported += 1
    return imported


def parse_csv_rows(text: str) -> List[Dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(text))
    rows: List[Dict[str, Any]] = []
    for r in reader:
        rows.append({k: (v if v != "" else None) for k, v in r.items()})
    return rows


def parse_json_rows(text: str) -> List[Dict[str, Any]]:
    data = json.loads(text)
    if isinstance(data, dict):
        data = data.get("items") or data.get("records") or [data]
    if not isinstance(data, list):
        raise ValueError("JSON 数据必须是数组或包含 items/records 的对象")
    return data


# ---------- actions ----------

def mark_processing(db: Session, item_id: int, req: MarkProcessedRequest) -> QCItem:
    item = _get_item_or_404(db, item_id)
    from_status = item.status
    to_status = "processing"
    _validate_status_transition(from_status, to_status)
    item.status = to_status
    item.handler = req.handler
    item.updated_at = _now()
    _append_event(
        db, item, action="mark_processing",
        actor=req.handler, reason=req.reason,
        from_status=from_status, to_status=to_status,
    )
    return item


def return_item(db: Session, item_id: int, req: ReturnRequest) -> QCItem:
    item = _get_item_or_404(db, item_id)
    from_status = item.status
    to_status = "returned"
    _validate_status_transition(from_status, to_status)
    item.status = to_status
    item.handler = req.handler
    item.updated_at = _now()
    _append_event(
        db, item, action="return",
        actor=req.handler, reason=req.reason,
        from_status=from_status, to_status=to_status,
        detail={"request_material": req.request_material},
    )
    return item


def second_review(db: Session, item_id: int, req: SecondReviewRequest) -> QCItem:
    item = _get_item_or_404(db, item_id)
    from_status = item.status
    to_status = "reviewed"
    _validate_status_transition(from_status, to_status)
    old_score = item.final_score
    if req.adjust_score is not None:
        item.final_score = float(req.adjust_score)
    item.status = to_status
    item.handler = req.reviewer
    item.reviewed_by = req.reviewer
    item.updated_at = _now()
    _append_event(
        db, item, action="second_review",
        actor=req.reviewer, reason=req.reason,
        from_status=from_status, to_status=to_status,
        detail={"old_score": old_score, "new_score": item.final_score},
    )
    return item


def approve_item(db: Session, item_id: int, req: ApproveRequest) -> QCItem:
    item = _get_item_or_404(db, item_id)
    from_status = item.status
    to_status = "approved"
    _validate_status_transition(from_status, to_status)
    if req.final_score is not None:
        item.final_score = float(req.final_score)
    item.status = to_status
    item.reviewed_by = req.reviewer
    item.updated_at = _now()
    _append_event(
        db, item, action="approve",
        actor=req.reviewer, reason=req.reason,
        from_status=from_status, to_status=to_status,
        detail={"final_score": item.final_score},
    )
    return item


def reject_item(db: Session, item_id: int, req: RejectRequest) -> QCItem:
    item = _get_item_or_404(db, item_id)
    from_status = item.status
    to_status = "rejected"
    _validate_status_transition(from_status, to_status)
    item.status = to_status
    item.reviewed_by = req.reviewer
    item.updated_at = _now()
    _append_event(
        db, item, action="reject",
        actor=req.reviewer, reason=req.reason,
        from_status=from_status, to_status=to_status,
    )
    return item


def cancel_deduction(db: Session, item_id: int, req: CancelDeductionRequest) -> QCItem:
    item = _get_item_or_404(db, item_id)
    old_deduction = item.deduction_score
    item.deduction_score = 0.0
    item.final_score = item.original_score
    item.handler = req.handler
    item.updated_at = _now()
    _append_event(
        db, item, action="cancel_deduction",
        actor=req.handler, reason=req.reason,
        from_status=item.status, to_status=item.status,
        detail={
            "old_deduction_score": old_deduction,
            "new_deduction_score": 0.0,
            "relevant_deduction_item": req.deduction_item or item.deduction_item,
        },
    )
    return item


def score_writeback(db: Session, item_id: int, req: ScoreWritebackRequest) -> QCItem:
    item = _get_item_or_404(db, item_id)
    old_score = item.final_score
    item.final_score = float(req.final_score)
    item.handler = req.handler
    item.updated_at = _now()
    _append_event(
        db, item, action="score_writeback",
        actor=req.handler, reason=req.reason,
        from_status=item.status, to_status=item.status,
        detail={"old_score": old_score, "new_score": item.final_score},
    )
    return item


# ---------- queries ----------

def build_query(db: Session, req: QueryRequest):
    q = db.query(QCItem)
    if req.agent_id:
        q = q.filter(QCItem.agent_id == req.agent_id)
    if req.deduction_item:
        q = q.filter(QCItem.deduction_item.ilike(f"%{req.deduction_item}%"))
    if req.reviewed_by:
        q = q.filter(QCItem.reviewed_by == req.reviewed_by)
    if req.status:
        q = q.filter(QCItem.status == req.status)
    if req.batch_id:
        q = q.filter(QCItem.batch_id == req.batch_id)
    if req.keyword:
        like = f"%{req.keyword}%"
        q = q.filter(
            (QCItem.agent_name.ilike(like)) |
            (QCItem.deduction_item.ilike(like)) |
            (QCItem.note.ilike(like))
        )
    return q


def query_items(db: Session, req: QueryRequest) -> List[QCItem]:
    return build_query(db, req).order_by(QCItem.id.asc()).all()


def count_items(db: Session, req: QueryRequest) -> int:
    return build_query(db, req).count()


def get_item_trace(db: Session, item_id: int) -> Dict[str, Any]:
    item = _get_item_or_404(db, item_id)
    events = db.query(QCEvent).filter(QCEvent.item_id == item.id).order_by(QCEvent.seq.asc()).all()
    appeals = db.query(Appeal).filter(Appeal.item_id == item.id).order_by(Appeal.created_at.asc()).all()
    return {"item": item, "events": events, "appeals": appeals}


def list_batches(db: Session) -> List[Batch]:
    return db.query(Batch).order_by(Batch.created_at.desc()).all()


def get_batch(db: Session, batch_id: int) -> Optional[Batch]:
    return db.query(Batch).filter(Batch.id == batch_id).first()


# ---------- export ----------

def export_items_csv(db: Session, req: QueryRequest) -> str:
    items = query_items(db, req)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "batch_id", "row_no", "agent_id", "agent_name",
        "category", "deduction_item", "deduction_score",
        "original_score", "final_score", "call_date", "call_id",
        "status", "handler", "reviewed_by", "note", "created_at", "updated_at",
    ])
    for it in items:
        writer.writerow([
            it.id, it.batch_id, it.row_no, it.agent_id, it.agent_name or "",
            it.category or "", it.deduction_item or "", it.deduction_score,
            it.original_score, it.final_score, it.call_date or "", it.call_id or "",
            it.status, it.handler or "", it.reviewed_by or "",
            it.note or "", it.created_at.isoformat(), it.updated_at.isoformat(),
        ])
    return buf.getvalue()


def export_trace_csv(db: Session, item_id: int) -> str:
    data = get_item_trace(db, item_id)
    events: List[QCEvent] = data["events"]
    appeals: List[Appeal] = data["appeals"]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["section", "seq", "action", "actor", "reason", "from_status", "to_status", "detail", "created_at"])
    for ev in events:
        writer.writerow([
            "event", ev.seq, ev.action, ev.actor, ev.reason or "",
            ev.from_status or "", ev.to_status or "",
            json.dumps(ev.detail or {}, ensure_ascii=False),
            ev.created_at.isoformat(),
        ])
    for ap in appeals:
        writer.writerow([
            "appeal", "", "appeal", ap.appellant, ap.content,
            "", "", json.dumps(ap.evidence or {}, ensure_ascii=False),
            ap.created_at.isoformat(),
        ])
    return buf.getvalue()
