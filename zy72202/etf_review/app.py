import json
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_from_directory
from etf_review.models import init_db
from etf_review.services import (
    import_from_file,
    supplement_holiday_note,
    confirm_approver_name,
    generate_report,
    get_batch_detail,
    get_stats,
    list_batches,
    get_component,
)

BASE_DIR = Path(__file__).parent.parent
TEMPLATE_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"

app = Flask(
    __name__,
    template_folder=str(TEMPLATE_DIR),
    static_folder=str(STATIC_DIR),
)


@app.template_filter("status_label")
def status_label(status):
    labels = {
        "imported": "已导入",
        "normal": "正常",
        "pending_review": "待复核",
        "missing_note": "缺说明",
        "flagged": "已标记",
    }
    return labels.get(status, status)


@app.before_request
def ensure_db():
    init_db()


@app.route("/")
def index():
    return render_template("dashboard.html")


@app.route("/batch/<batch_id>")
def batch_detail(batch_id):
    detail = get_batch_detail(batch_id)
    if "error" in detail:
        return render_template("error.html", message=detail["error"]), 404
    return render_template("batch_detail.html", detail=detail)


@app.route("/report/<batch_id>")
def view_report(batch_id):
    report = generate_report(batch_id)
    return render_template("report.html", report=report, batch_id=batch_id)


@app.route("/api/stats")
def api_stats():
    return jsonify(get_stats())


@app.route("/api/batches")
def api_batches():
    return jsonify(list_batches())


@app.route("/api/batch/<batch_id>")
def api_batch_detail(batch_id):
    return jsonify(get_batch_detail(batch_id))


@app.route("/api/import", methods=["POST"])
def api_import():
    data = request.get_json()
    if not data or "filepath" not in data:
        return jsonify({"error": "缺少 filepath 参数"}), 400
    try:
        result = import_from_file(data["filepath"])
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/component/<int:component_id>/note", methods=["POST"])
def api_update_note(component_id):
    data = request.get_json()
    if not data or "note" not in data:
        return jsonify({"error": "缺少 note 参数"}), 400
    result = supplement_holiday_note(component_id, data["note"])
    if "error" in result:
        return jsonify(result), 404
    return jsonify(result)


@app.route("/api/component/<int:component_id>/confirm", methods=["POST"])
def api_confirm_approver(component_id):
    data = request.get_json()
    if not data or "name" not in data:
        return jsonify({"error": "缺少 name 参数"}), 400
    result = confirm_approver_name(component_id, data["name"])
    if "error" in result:
        return jsonify(result), 404
    return jsonify(result)


@app.route("/api/report/<batch_id>")
def api_report(batch_id):
    report = generate_report(batch_id)
    return jsonify({"report": report, "batch_id": batch_id})
