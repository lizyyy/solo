from datetime import datetime
from flask import Flask, jsonify, request
from database import init_db, get_db
from services import (
    create_batch,
    add_policy_record,
    add_source_attachment,
    confirm_record,
    suspend_record,
    add_manual_note,
    get_record_trace,
    get_batch_summary,
)
from export_service import export_batch_to_excel, compare_records
from models import Batch, PolicyRecord

app = Flask(__name__)

with app.app_context():
    init_db()


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})


@app.route("/api/batches", methods=["POST"])
def create_batch_endpoint():
    data = request.json
    db = next(get_db())
    batch = create_batch(
        db=db,
        batch_no=data["batch_no"],
        name=data["name"],
        source=data["source"],
        created_by=data["created_by"],
    )
    return jsonify({
        "id": batch.id,
        "batch_no": batch.batch_no,
        "name": batch.name,
        "status": batch.status,
    })


@app.route("/api/batches", methods=["GET"])
def list_batches():
    db = next(get_db())
    batches = db.query(Batch).order_by(Batch.created_at.desc()).all()
    return jsonify([
        {
            "id": b.id,
            "batch_no": b.batch_no,
            "name": b.name,
            "source": b.source,
            "status": b.status,
            "created_by": b.created_by,
            "created_at": b.created_at.isoformat(),
        }
        for b in batches
    ])


@app.route("/api/batches/<int:batch_id>/summary", methods=["GET"])
def get_batch_summary_endpoint(batch_id):
    db = next(get_db())
    summary = get_batch_summary(db, batch_id)
    return jsonify(summary)


@app.route("/api/source-attachments", methods=["POST"])
def create_source_attachment():
    data = request.json
    db = next(get_db())
    received_date = None
    if data.get("received_date"):
        received_date = datetime.fromisoformat(data["received_date"])
    attachment = add_source_attachment(
        db=db,
        source_type=data["source_type"],
        reference_no=data["reference_no"],
        title=data.get("title"),
        received_date=received_date,
        original_filename=data.get("original_filename"),
        content=data.get("content"),
        notes=data.get("notes"),
    )
    return jsonify({
        "id": attachment.id,
        "source_type": attachment.source_type,
        "reference_no": attachment.reference_no,
        "title": attachment.title,
    })


@app.route("/api/batches/<int:batch_id>/records", methods=["POST"])
def add_record_to_batch(batch_id):
    data = request.json
    db = next(get_db())
    surrender_date = None
    if data.get("surrender_date"):
        surrender_date = datetime.fromisoformat(data["surrender_date"])

    record = add_policy_record(
        db=db,
        batch_id=batch_id,
        policy_no=data["policy_no"],
        policy_holder=data.get("policy_holder"),
        agent_nickname=data.get("agent_nickname"),
        raw_effective_date=data.get("raw_effective_date"),
        raw_cash_value=data.get("raw_cash_value"),
        surrender_date=surrender_date,
        surrender_amount=data.get("surrender_amount"),
        source_type=data.get("source_type", "excel_import"),
        source_reference=data.get("source_reference"),
        source_attachment_id=data.get("source_attachment_id"),
        raw_data=data.get("raw_data"),
    )
    return jsonify({
        "id": record.id,
        "policy_no": record.policy_no,
        "status": record.status,
        "is_suspended": record.is_suspended,
        "suspension_reason": record.suspension_reason,
        "parsed_cash_value": record.cash_value,
        "parsed_effective_date": record.effective_date.isoformat() if record.effective_date else None,
    })


@app.route("/api/batches/<int:batch_id>/records", methods=["GET"])
def list_batch_records(batch_id):
    db = next(get_db())
    records = db.query(PolicyRecord).filter(
        PolicyRecord.batch_id == batch_id
    ).order_by(PolicyRecord.id).all()
    return jsonify([
        {
            "id": r.id,
            "policy_no": r.policy_no,
            "policy_holder": r.policy_holder,
            "cash_value": r.cash_value,
            "currency": r.currency,
            "status": r.status,
            "is_suspended": r.is_suspended,
            "suspension_reason": r.suspension_reason,
            "confirmed_by": r.confirmed_by,
            "confirmed_at": r.confirmed_at.isoformat() if r.confirmed_at else None,
        }
        for r in records
    ])


@app.route("/api/records/<int:record_id>/confirm", methods=["POST"])
def confirm_record_endpoint(record_id):
    data = request.json
    db = next(get_db())
    overridden_date = None
    if data.get("overridden_effective_date"):
        overridden_date = datetime.fromisoformat(data["overridden_effective_date"])

    record = confirm_record(
        db=db,
        record_id=record_id,
        operator=data["operator"],
        notes=data.get("notes"),
        decision_reasoning=data.get("decision_reasoning"),
        overridden_cash_value=data.get("overridden_cash_value"),
        overridden_effective_date=overridden_date,
    )
    return jsonify({
        "id": record.id,
        "status": record.status,
        "confirmed_by": record.confirmed_by,
        "confirmed_at": record.confirmed_at.isoformat(),
        "confirmation_notes": record.confirmation_notes,
    })


@app.route("/api/records/<int:record_id>/suspend", methods=["POST"])
def suspend_record_endpoint(record_id):
    data = request.json
    db = next(get_db())
    record = suspend_record(
        db=db,
        record_id=record_id,
        operator=data["operator"],
        reason=data["reason"],
        decision_reasoning=data.get("decision_reasoning"),
    )
    return jsonify({
        "id": record.id,
        "status": record.status,
        "is_suspended": record.is_suspended,
        "suspension_reason": record.suspension_reason,
    })


@app.route("/api/records/<int:record_id>/note", methods=["POST"])
def add_note_endpoint(record_id):
    data = request.json
    db = next(get_db())
    record = add_manual_note(
        db=db,
        record_id=record_id,
        operator=data["operator"],
        note=data["note"],
        decision_reasoning=data.get("decision_reasoning"),
    )
    return jsonify({
        "id": record.id,
        "confirmation_notes": record.confirmation_notes,
    })


@app.route("/api/records/<int:record_id>/trace", methods=["GET"])
def get_record_trace_endpoint(record_id):
    db = next(get_db())
    trace = get_record_trace(db, record_id)
    return jsonify(trace)


@app.route("/api/records/<int:record_id>/compare", methods=["GET"])
def compare_record_endpoint(record_id):
    db = next(get_db())
    comparison = compare_records(db, record_id)
    return jsonify(comparison)


@app.route("/api/batches/<int:batch_id>/export", methods=["POST"])
def export_batch_endpoint(batch_id):
    data = request.json
    db = next(get_db())
    excel_path, json_path = export_batch_to_excel(
        db=db,
        batch_id=batch_id,
        operator=data.get("operator", "system"),
    )
    return jsonify({
        "excel_file": excel_path,
        "json_file": json_path,
        "batch_id": batch_id,
    })


if __name__ == "__main__":
    print("=" * 60)
    print("保单现金价值试算系统")
    print("=" * 60)
    print(f"数据库位置: data/cash_value.db")
    print(f"导出目录: exports/")
    print("API 地址: http://localhost:5000")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=False)
