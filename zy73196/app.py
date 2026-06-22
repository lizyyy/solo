from datetime import datetime
from flask import Flask, request, jsonify
import json

from models import StudentWork, BoundaryParams, ReviewStatus
from review_service import ReviewService
from calculation_engine import CalculationEngine, _json_safe_value

app = Flask(__name__)
service = ReviewService()
engine = CalculationEngine()


class _SafeEncoder(json.JSONEncoder):
    def default(self, o):
        try:
            return _json_safe_value(o)
        except TypeError:
            return str(o)


app.json_encoder = _SafeEncoder


def _anomaly_summary(anomalies):
    parts = []
    for a in anomalies:
        line = f"[{a.get('severity', '?')}] {a.get('type')}: {a.get('message')}"
        if a.get("source"):
            line += f" (source={a['source']})"
        parts.append(line)
    return "\n".join(parts) if parts else None


def _record_to_dict(record):
    work = record.work
    input_type = work.detect_input_type(record.current_params)
    anomaly_details = []
    if record.last_calc_result:
        anomaly_details = record.last_calc_result.get("anomalies", [])
    d = {
        "work_id": record.work_id,
        "student": work.student_name,
        "problem_id": work.problem_id,
        "status": record.current_status.value,
        "input_type": input_type.value,
        "student_answer": {
            "value": _json_safe_value(work.answer),
            "unit": work.unit,
            "is_draft": work.is_draft,
            "raw_content": work.raw_content,
        },
        "draft_source": (
            "student_draft" if work.is_draft else None
        ),
        "empty_set_source": (
            "student_submit" if work.answer is None or (
                isinstance(work.answer, list) and len(work.answer) == 0
            ) else None
        ),
        "anomaly_flags": record.anomaly_flags,
        "anomaly_details": anomaly_details,
        "current_status_hint": (
            record.last_calc_result.get("current_status_hint")
            if record.last_calc_result else None
        ),
        "is_correct": (
            record.last_calc_result.get("is_correct")
            if record.last_calc_result else None
        ),
        "created_at": record.created_at.isoformat(),
        "updated_at": record.updated_at.isoformat(),
        "current_params": record.current_params.to_dict(),
        "last_calc_result": record.last_calc_result,
        "supplementary_notes": record.supplementary_notes,
        "withdrawal_record": record.withdrawal_record,
        "history_count": len(record.history),
    }
    return _json_safe_value(d)


def _history_to_dict(h):
    return {
        "id": h.id,
        "work_id": h.work_id,
        "reviewer": h.reviewer,
        "old_status": h.old_status.value if h.old_status else None,
        "new_status": h.new_status.value,
        "reason": h.reason,
        "source": h.source,
        "timestamp": h.timestamp.isoformat(),
        "params_snapshot": h.params_snapshot,
        "notes": h.notes,
    }


@app.route("/api/works", methods=["POST"])
def submit_work():
    data = request.json or {}
    work = StudentWork(
        id=data["id"],
        student_name=data["student_name"],
        problem_id=data["problem_id"],
        answer=data.get("answer"),
        unit=data.get("unit"),
        is_draft=data.get("is_draft", False),
        raw_content=data.get("raw_content", ""),
    )
    params = BoundaryParams()
    calc_result = engine.calculate(work, params)
    anomalies = calc_result.get("anomalies", [])
    flags = [a["type"] for a in anomalies]
    submission_notes = _anomaly_summary(anomalies)

    record = service.submit_work(
        work,
        submission_notes=submission_notes,
        anomaly_flags=flags,
    )
    record.current_params = params
    record.last_calc_result = calc_result
    return jsonify({
        "success": True,
        "record": _record_to_dict(record),
        "calc_result": _json_safe_value(calc_result),
    }), 201


@app.route("/api/works", methods=["GET"])
def list_works():
    status_str = request.args.get("status")
    status = ReviewStatus(status_str) if status_str else None
    reviewer = request.args.get("reviewer")
    records = service.list_records(status=status, reviewer=reviewer)
    return jsonify({
        "success": True,
        "records": [_record_to_dict(r) for r in records],
    })


@app.route("/api/works/<work_id>", methods=["GET"])
def get_work(work_id):
    record = service.get_record(work_id)
    if not record:
        return jsonify({"success": False, "error": "未找到记录"}), 404
    return jsonify({
        "success": True,
        "record": _record_to_dict(record),
        "calc_history": engine.get_calc_history(work_id),
    })


@app.route("/api/works/<work_id>/history", methods=["GET"])
def get_history(work_id):
    try:
        history = service.get_history(work_id)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    return jsonify({
        "success": True,
        "history": [_history_to_dict(h) for h in history],
    })


@app.route("/api/works/<work_id>/review/start", methods=["POST"])
def start_review(work_id):
    data = request.json or {}
    reviewer = data.get("reviewer", "unknown")
    try:
        record = service.start_review(work_id, reviewer)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    return jsonify({"success": True, "record": _record_to_dict(record)})


@app.route("/api/works/<work_id>/review/approve", methods=["POST"])
def approve(work_id):
    data = request.json or {}
    reviewer = data.get("reviewer", "unknown")
    reason = data.get("reason", "")
    try:
        record = service.approve(work_id, reviewer, reason)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    return jsonify({"success": True, "record": _record_to_dict(record)})


@app.route("/api/works/<work_id>/review/reject", methods=["POST"])
def reject(work_id):
    data = request.json or {}
    reviewer = data.get("reviewer", "unknown")
    reason = data.get("reason", "")
    try:
        record = service.reject(work_id, reviewer, reason)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    return jsonify({"success": True, "record": _record_to_dict(record)})


@app.route("/api/works/<work_id>/review/revise", methods=["POST"])
def revise(work_id):
    data = request.json or {}
    reviewer = data.get("reviewer", "unknown")
    new_status = ReviewStatus(data["new_status"])
    reason = data.get("reason", "")
    source = data.get("source", "revise")
    notes = data.get("notes")
    try:
        record = service.revise(work_id, reviewer, new_status, reason, source, notes)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    return jsonify({"success": True, "record": _record_to_dict(record)})


@app.route("/api/works/<work_id>/review/withdraw", methods=["POST"])
def withdraw(work_id):
    data = request.json or {}
    reviewer = data.get("reviewer", "unknown")
    reason = data.get("reason", "")
    try:
        record = service.withdraw(work_id, reviewer, reason)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    return jsonify({"success": True, "record": _record_to_dict(record)})


@app.route("/api/works/<work_id>/notes", methods=["POST"])
def add_note(work_id):
    data = request.json or {}
    reviewer = data.get("reviewer", "unknown")
    note = data.get("note", "")
    try:
        record = service.add_supplementary_note(work_id, reviewer, note)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    return jsonify({"success": True, "record": _record_to_dict(record)})


@app.route("/api/works/<work_id>/recalc", methods=["POST"])
def recalc(work_id):
    data = request.json or {}
    record = service.get_record(work_id)
    if not record:
        return jsonify({"success": False, "error": "未找到记录"}), 404

    new_params = BoundaryParams(
        tolerance=data.get("tolerance", record.current_params.tolerance),
        min_value=data.get("min_value", record.current_params.min_value),
        max_value=data.get("max_value", record.current_params.max_value),
        unit_required=data.get("unit_required", record.current_params.unit_required),
        strict_mode=data.get("strict_mode", record.current_params.strict_mode),
    )
    result = engine.recalculate_with_new_params(record, new_params)
    return jsonify(_json_safe_value({"success": True, **result}))


@app.route("/api/anomalies", methods=["GET"])
def list_anomalies():
    anomalies = service.list_anomalies()
    enriched = []
    for a in anomalies:
        record = service.get_record(a["work_id"])
        if record and record.last_calc_result:
            a2 = dict(a)
            a2["anomaly_details"] = record.last_calc_result.get("anomalies", [])
            a2["current_status_hint"] = record.last_calc_result.get(
                "current_status_hint"
            )
            enriched.append(a2)
        else:
            enriched.append(a)
    return jsonify({"success": True, "anomalies": enriched})


@app.route("/api/reviewers/<reviewer>/daily", methods=["GET"])
def reviewer_daily(reviewer):
    date_str = request.args.get("date")
    date = datetime.fromisoformat(date_str) if date_str else None
    changes = service.get_reviewer_daily_changes(reviewer, date)
    return jsonify({
        "success": True,
        "reviewer": reviewer,
        "date": (date.date().isoformat() if date else datetime.now().date().isoformat()),
        "changes": [_history_to_dict(h) for h in changes],
    })


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"success": True, "status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
