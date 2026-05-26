import csv
import io
import json
from datetime import datetime

from flask import Blueprint, jsonify, request, send_file

from .extensions import db
from .models import AuditLog, Batch, Record
from .services import build_record_from_input, classify_record


bp = Blueprint("api", __name__)


def _record_to_dict(record: Record) -> dict:
    return {
        "id": record.id,
        "batch_id": record.batch_id,
        "seq": record.seq,
        "region": record.region,
        "pesticide_code": record.pesticide_code,
        "pesticide_name": record.pesticide_name,
        "dosage": record.dosage,
        "dosage_unit": record.dosage_unit,
        "standard_dosage": record.standard_dosage,
        "wind_speed": record.wind_speed,
        "safety_interval_hours": record.safety_interval_hours,
        "reentry_hours": record.reentry_hours,
        "operator": record.operator,
        "sprayed_at": record.sprayed_at,
        "status": record.status,
        "reason": record.reason,
        "action_taken": record.action_taken,
        "final_verdict": record.final_verdict,
        "reviewed_by": record.reviewed_by,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }


def _batch_to_dict(batch: Batch) -> dict:
    return {
        "id": batch.id,
        "name": batch.name,
        "created_by": batch.created_by,
        "status": batch.status,
        "total_count": batch.total_count,
        "normal_count": batch.normal_count,
        "need_replenish_count": batch.need_replenish_count,
        "blocked_count": batch.blocked_count,
        "created_at": batch.created_at.isoformat() if batch.created_at else None,
        "updated_at": batch.updated_at.isoformat() if batch.updated_at else None,
    }


def _refresh_batch_status(batch: Batch) -> None:
    total = len(batch.records)
    normal = sum(1 for r in batch.records if r.status == "normal")
    need = sum(1 for r in batch.records if r.status == "need_replenish")
    blocked = sum(1 for r in batch.records if r.status == "blocked")
    batch.total_count = total
    batch.normal_count = normal
    batch.need_replenish_count = need
    batch.blocked_count = blocked
    if total == 0:
        batch.status = "processing"
    elif need > 0 or blocked > 0:
        batch.status = "manual_review"
    else:
        batch.status = "exported" if batch.status == "exported" else "processing"


def _write_audit(batch_id, record_id, operator, field, old, new, reason):
    db.session.add(
        AuditLog(
            batch_id=batch_id,
            record_id=record_id,
            operator=operator,
            field_name=field,
            old_value=json.dumps(old, ensure_ascii=False) if isinstance(old, (dict, list)) else str(old) if old is not None else "",
            new_value=json.dumps(new, ensure_ascii=False) if isinstance(new, (dict, list)) else str(new) if new is not None else "",
            reason=reason or "",
        )
    )


@bp.post("/batches")
def create_batch():
    payload = request.get_json(silent=True) or {}
    name = payload.get("name") or f"batch-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
    created_by = payload.get("created_by", "unknown")
    items = payload.get("records", []) or []

    if not isinstance(items, list):
        return jsonify({"error": "records 必须为列表"}), 400

    batch = Batch(
        name=name,
        created_by=created_by,
        status="processing",
        raw_payload=json.dumps(payload, ensure_ascii=False),
    )
    db.session.add(batch)
    db.session.flush()

    for i, item in enumerate(items, start=1):
        record = build_record_from_input(batch.id, i, item)
        db.session.add(record)

    db.session.flush()
    _refresh_batch_status(batch)
    db.session.commit()
    return jsonify(_batch_to_dict(batch)), 201


@bp.get("/batches")
def list_batches():
    batches = Batch.query.order_by(Batch.created_at.desc()).all()
    return jsonify([_batch_to_dict(b) for b in batches])


@bp.get("/batches/<int:batch_id>")
def get_batch(batch_id):
    batch = db.session.get(Batch, batch_id)
    if not batch:
        return jsonify({"error": "批次不存在"}), 404
    data = _batch_to_dict(batch)
    data["records"] = [_record_to_dict(r) for r in sorted(batch.records, key=lambda x: x.seq)]
    return jsonify(data)


@bp.post("/records/<int:record_id>/submit")
def submit_record(record_id):
    record = db.session.get(Record, record_id)
    if not record:
        return jsonify({"error": "记录不存在"}), 404
    payload = request.get_json(silent=True) or {}
    operator = payload.get("operator", "unknown")
    updates = payload.get("updates", {}) or {}

    allowed = {
        "region", "pesticide_code", "pesticide_name", "dosage", "dosage_unit",
        "standard_dosage", "wind_speed", "safety_interval_hours", "reentry_hours",
        "operator", "sprayed_at",
    }
    for field, value in updates.items():
        if field not in allowed:
            continue
        old = getattr(record, field)
        if old != value:
            setattr(record, field, value)
            _write_audit(record.batch_id, record.id, operator, field, old, value,
                         payload.get("reason", "补充或修正原始输入"))

    classify_record(record)
    batch = record.batch
    _refresh_batch_status(batch)
    db.session.commit()
    return jsonify(_record_to_dict(record))


@bp.post("/records/<int:record_id>/review")
def review_record(record_id):
    record = db.session.get(Record, record_id)
    if not record:
        return jsonify({"error": "记录不存在"}), 404
    payload = request.get_json(silent=True) or {}
    operator = payload.get("operator", "unknown")
    new_status = payload.get("status")
    reason = payload.get("reason", "")
    new_verdict = payload.get("final_verdict")

    if new_status not in ("normal", "need_replenish", "blocked"):
        return jsonify({"error": "status 必须是 normal / need_replenish / blocked"}), 400

    _write_audit(record.batch_id, record.id, operator, "status", record.status, new_status, reason)
    if new_verdict:
        _write_audit(record.batch_id, record.id, operator, "final_verdict", record.final_verdict, new_verdict, reason)

    record.status = new_status
    record.reviewed_by = operator
    if new_verdict:
        record.final_verdict = new_verdict
    if reason:
        record.reason = (record.reason or "") + f" | 人工复核: {reason}"
    record.action_taken = payload.get("action_taken") or record.action_taken

    _refresh_batch_status(record.batch)
    db.session.commit()
    return jsonify(_record_to_dict(record))


@bp.get("/batches/<int:batch_id>/audit")
def list_audit(batch_id):
    batch = db.session.get(Batch, batch_id)
    if not batch:
        return jsonify({"error": "批次不存在"}), 404
    logs = AuditLog.query.filter_by(batch_id=batch_id).order_by(AuditLog.changed_at.asc()).all()
    return jsonify([
        {
            "id": l.id,
            "record_id": l.record_id,
            "operator": l.operator,
            "field_name": l.field_name,
            "old_value": l.old_value,
            "new_value": l.new_value,
            "reason": l.reason,
            "changed_at": l.changed_at.isoformat() if l.changed_at else None,
        }
        for l in logs
    ])


@bp.get("/batches/<int:batch_id>/report")
def download_report(batch_id):
    batch = db.session.get(Batch, batch_id)
    if not batch:
        return jsonify({"error": "批次不存在"}), 404

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "seq", "region", "pesticide_code", "pesticide_name",
        "dosage", "dosage_unit", "standard_dosage",
        "wind_speed", "safety_interval_hours", "reentry_hours",
        "operator", "sprayed_at",
        "status", "final_verdict", "reason", "action_taken", "reviewed_by",
    ])
    for r in sorted(batch.records, key=lambda x: x.seq):
        writer.writerow([
            r.seq, r.region, r.pesticide_code, r.pesticide_name,
            r.dosage, r.dosage_unit, r.standard_dosage,
            r.wind_speed, r.safety_interval_hours, r.reentry_hours,
            r.operator, r.sprayed_at,
            r.status, r.final_verdict, r.reason, r.action_taken, r.reviewed_by,
        ])

    buffer.seek(0)
    data = io.BytesIO(buffer.getvalue().encode("utf-8-sig"))
    data.seek(0)

    batch.status = "exported"
    db.session.commit()

    return send_file(
        data,
        mimetype="text/csv; charset=utf-8",
        as_attachment=True,
        download_name=f"batch-{batch.id}-{batch.name}.csv",
    )


@bp.get("/records/<int:record_id>/trace")
def trace_record(record_id):
    record = db.session.get(Record, record_id)
    if not record:
        return jsonify({"error": "记录不存在"}), 404
    try:
        raw = json.loads(record.raw_data) if record.raw_data else {}
    except Exception:
        raw = record.raw_data
    logs = AuditLog.query.filter_by(record_id=record.id).order_by(AuditLog.changed_at.asc()).all()
    return jsonify({
        "raw_input": raw,
        "final": _record_to_dict(record),
        "audit_trail": [
            {
                "field_name": l.field_name,
                "old_value": l.old_value,
                "new_value": l.new_value,
                "operator": l.operator,
                "reason": l.reason,
                "changed_at": l.changed_at.isoformat() if l.changed_at else None,
            }
            for l in logs
        ],
    })


@bp.post("/batches/<int:batch_id>/mark-failed")
def mark_batch_failed(batch_id):
    batch = db.session.get(Batch, batch_id)
    if not batch:
        return jsonify({"error": "批次不存在"}), 404
    payload = request.get_json(silent=True) or {}
    batch.status = "failed"
    _write_audit(batch.id, None, payload.get("operator", "system"), "batch.status", "processing", "failed",
                 payload.get("reason", "处理失败"))
    db.session.commit()
    return jsonify(_batch_to_dict(batch))
