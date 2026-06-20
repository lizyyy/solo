from datetime import datetime
from flask import Flask, request, jsonify

from models import StudentWork, BoundaryParams, ReviewStatus
from review_service import ReviewService
from calculation_engine import CalculationEngine

app = Flask(__name__)
service = ReviewService()
engine = CalculationEngine()


def _record_to_dict(record):
    return {
        "work_id": record.work_id,
        "student": record.work.student_name,
        "problem_id": record.work.problem_id,
        "status": record.current_status.value,
        "input_type": record.work.detect_input_type(record.current_params).value,
        "anomaly_flags": record.anomaly_flags,
        "created_at": record.created_at.isoformat(),
        "updated_at": record.updated_at.isoformat(),
        "current_params": record.current_params.to_dict(),
        "last_calc_result": record.last_calc_result,
        "supplementary_notes": record.supplementary_notes,
        "withdrawal_record": record.withdrawal_record,
        "history_count": len(record.history),
    }


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
    data = request.json
    work = StudentWork(
        id=data["id"],
        student_name=data["student_name"],
        problem_id=data["problem_id"],
        answer=data.get("answer"),
        unit=data.get("unit"),
        is_draft=data.get("is_draft", False),
        raw_content=data.get("raw_content", ""),
    )
    record = service.submit_work(work)
    calc_result = engine.calculate(work, record.current_params)
    record.last_calc_result = calc_result
    record.anomaly_flags = [a["type"] for a in calc_result.get("anomalies", [])]
    return jsonify({
        "success": True,
        "record": _record_to_dict(record),
        "calc_result": calc_result,
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
    data = request.json
    reviewer = data.get("reviewer", "unknown")
    try:
        record = service.start_review(work_id, reviewer)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    return jsonify({"success": True, "record": _record_to_dict(record)})


@app.route("/api/works/<work_id>/review/approve", methods=["POST"])
def approve(work_id):
    data = request.json
    reviewer = data.get("reviewer", "unknown")
    reason = data.get("reason", "")
    try:
        record = service.approve(work_id, reviewer, reason)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    return jsonify({"success": True, "record": _record_to_dict(record)})


@app.route("/api/works/<work_id>/review/reject", methods=["POST"])
def reject(work_id):
    data = request.json
    reviewer = data.get("reviewer", "unknown")
    reason = data.get("reason", "")
    try:
        record = service.reject(work_id, reviewer, reason)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    return jsonify({"success": True, "record": _record_to_dict(record)})


@app.route("/api/works/<work_id>/review/revise", methods=["POST"])
def revise(work_id):
    data = request.json
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
    data = request.json
    reviewer = data.get("reviewer", "unknown")
    reason = data.get("reason", "")
    try:
        record = service.withdraw(work_id, reviewer, reason)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    return jsonify({"success": True, "record": _record_to_dict(record)})


@app.route("/api/works/<work_id>/notes", methods=["POST"])
def add_note(work_id):
    data = request.json
    reviewer = data.get("reviewer", "unknown")
    note = data.get("note", "")
    try:
        record = service.add_supplementary_note(work_id, reviewer, note)
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    return jsonify({"success": True, "record": _record_to_dict(record)})


@app.route("/api/works/<work_id>/recalc", methods=["POST"])
def recalc(work_id):
    data = request.json
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
    return jsonify({"success": True, **result})


@app.route("/api/anomalies", methods=["GET"])
def list_anomalies():
    return jsonify({"success": True, "anomalies": service.list_anomalies()})


@app.route("/api/reviewers/<reviewer>/daily", methods=["GET"])
def reviewer_daily(reviewer):
    date_str = request.args.get("date")
    date = datetime.fromisoformat(date_str) if date_str else None
    changes = service.get_reviewer_daily_changes(reviewer, date)
    return jsonify({
        "success": True,
        "reviewer": reviewer,
        "changes": [_history_to_dict(h) for h in changes],
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
