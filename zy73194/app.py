import csv
import io
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from models import store, Status

app = Flask(__name__, static_folder="static", static_url_path="/static")
CORS(app)


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/records", methods=["GET"])
def list_records():
    status_filter = request.args.get("status")
    records = store.list_records(status_filter)
    result = []
    for r in records:
        result.append({
            "id": r["id"],
            "title": r["title"],
            "formula": r["formula"],
            "status": r["status"],
            "unit": r["unit"],
            "current_version": r["current_version"],
            "has_division_by_zero": r["has_division_by_zero"],
            "result_summary": r["result_summary"],
            "updated_at": r["updated_at"],
            "last_operator": r["lifecycle"][-1]["operator"] if r["lifecycle"] else "",
            "last_action": r["lifecycle"][-1]["action"] if r["lifecycle"] else "",
        })
    return jsonify(result)


@app.route("/api/records/<record_id>", methods=["GET"])
def get_record(record_id):
    rec = store.get_record(record_id)
    if not rec:
        return jsonify({"error": "记录不存在"}), 404
    return jsonify(rec)


@app.route("/api/records/<record_id>/history", methods=["GET"])
def get_history(record_id):
    history = store.get_history(record_id)
    return jsonify(history)


@app.route("/api/records", methods=["POST"])
def create_record():
    data = request.json
    rec = store.create_record(
        title=data.get("title", "新建回放"),
        formula=data.get("formula", "a_n = a_{n-1} + d"),
        params=data.get("params", {"a0": 0, "d": 1, "n": 10}),
        unit=data.get("unit", "个"),
        status=data.get("status", Status.PENDING_EVIDENCE.value),
        remark=data.get("remark", ""),
        operator=data.get("operator", "当前用户"),
        has_division_by_zero=data.get("has_division_by_zero", False),
        screenshot_url=data.get("screenshot_url"),
    )
    return jsonify(rec), 201


@app.route("/api/records/<record_id>", methods=["PUT"])
def update_record(record_id):
    data = request.json
    rec = store.update_record(
        record_id=record_id,
        params=data.get("params"),
        unit=data.get("unit"),
        status=data.get("status"),
        remark=data.get("remark"),
        operator=data.get("operator", "当前用户"),
        screenshot_url=data.get("screenshot_url"),
        unit_changed=data.get("unit_changed", False),
        old_unit=data.get("old_unit"),
        old_result_ref=data.get("old_result_ref"),
    )
    if not rec:
        return jsonify({"error": "记录不存在"}), 404
    return jsonify(rec)


@app.route("/api/records/<record_id>/recompute", methods=["POST"])
def recompute(record_id):
    data = request.json
    rec = store.recompute_with_attachment(
        record_id=record_id,
        attachment_name=data.get("attachment_name", "晚到附件"),
        attachment_url=data.get("attachment_url", ""),
        params=data.get("params"),
        operator=data.get("operator", "系统"),
    )
    if not rec:
        return jsonify({"error": "记录不存在"}), 404
    return jsonify(rec)


@app.route("/api/records/<record_id>/csv", methods=["GET"])
def export_csv(record_id):
    main_rows, detail_rows = store.export_csv_rows(record_id)
    output = io.StringIO()
    writer = csv.writer(output)
    for row in main_rows:
        writer.writerow(row)
    for row in detail_rows:
        writer.writerow(row)
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"数列递推参数回放_{record_id}_明细.csv",
    )


@app.route("/api/records/csv", methods=["GET"])
def export_all_csv():
    status_filter = request.args.get("status")
    rows = store.export_all_csv_rows(status_filter)
    output = io.StringIO()
    writer = csv.writer(output)
    for row in rows:
        writer.writerow(row)
    output.seek(0)
    filename = "数列递推参数回放_全部明细.csv"
    if status_filter:
        filename = f"数列递推参数回放_{status_filter}_明细.csv"
    return send_file(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        mimetype="text/csv",
        as_attachment=True,
        download_name=filename,
    )


@app.route("/api/status-options", methods=["GET"])
def status_options():
    return jsonify([s.value for s in Status])


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
