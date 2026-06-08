from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os

from db import init_db, RECORD_STATUSES, MATERIAL_TYPES, STATUS_SNAPSHOT_NOTES
import services

app = Flask(__name__, static_folder="frontend", static_url_path="")
CORS(app)

init_db()


@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")


@app.route("/api/enums", methods=["GET"])
def api_enums():
    return jsonify(
        {
            "statuses": RECORD_STATUSES,
            "material_types": MATERIAL_TYPES,
            "snapshot_notes": STATUS_SNAPSHOT_NOTES,
        }
    )


@app.route("/api/dashboard", methods=["GET"])
def api_dashboard():
    return jsonify(services.dashboard_stats())


@app.route("/api/batches", methods=["GET"])
def api_list_batches():
    return jsonify(services.list_batches())


@app.route("/api/batches/<int:batch_id>", methods=["GET"])
def api_get_batch(batch_id):
    info = services.get_batch_info(batch_id)
    if not info:
        return jsonify({"error": "not found"}), 404
    return jsonify(info)


@app.route("/api/records", methods=["GET"])
def api_list_records():
    status = request.args.get("status") or None
    vaccine_only = request.args.get("vaccine_missing_only", "0") == "1"
    batch_id = request.args.get("batch_id")
    batch_id = int(batch_id) if batch_id and batch_id.isdigit() else None
    return jsonify(
        services.list_records(status=status, vaccine_missing_only=vaccine_only, batch_id=batch_id)
    )


@app.route("/api/records/<int:record_id>", methods=["GET"])
def api_get_record(record_id):
    d = services.get_record_detail(record_id)
    if not d:
        return jsonify({"error": "not found"}), 404
    return jsonify(d)


@app.route("/api/records/<int:record_id>/status", methods=["PUT"])
def api_update_status(record_id):
    body = request.get_json(force=True, silent=True) or {}
    status = body.get("status")
    operator = body.get("operator") or "项目经理"
    if not status:
        return jsonify({"error": "status 必填"}), 400
    try:
        res = services.update_record_status(record_id, status, operator=operator)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(res)


@app.route("/api/records/<int:record_id>/notes", methods=["POST"])
def api_add_note(record_id):
    body = request.get_json(force=True, silent=True) or {}
    content = body.get("content") or ""
    author = body.get("author") or "项目经理"
    return jsonify(services.add_manual_note(record_id, content, author))


@app.route("/api/import", methods=["POST"])
def api_import():
    body = request.get_json(force=True, silent=True) or {}
    items = body.get("items") or []
    operator = body.get("operator") or "系统"
    remark = body.get("remark")
    rerun = bool(body.get("rerun"))
    if not items:
        return jsonify({"error": "items 不能为空"}), 400
    return jsonify(
        services.import_items(items, operator=operator, remark=remark, rerun=rerun)
    )


@app.route("/api/export", methods=["GET"])
def api_export():
    batch_id = request.args.get("batch_id")
    batch_id = int(batch_id) if batch_id and batch_id.isdigit() else None
    return jsonify(services.export_snapshot_records(batch_id=batch_id))


@app.route("/api/batches/<int:batch_id>/rerun", methods=["POST"])
def api_rerun(batch_id):
    body = request.get_json(force=True, silent=True) or {}
    operator = body.get("operator") or "系统重跑"
    return jsonify(services.rerun_batch(batch_id, operator=operator))


@app.route("/api/seed", methods=["POST"])
def api_seed():
    return jsonify(services.seed_demo_data())


if __name__ == "__main__":
    os.makedirs("frontend", exist_ok=True)
    app.run(host="0.0.0.0", port=5001, debug=True)
