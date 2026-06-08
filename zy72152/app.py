import os
import json
from datetime import datetime

from flask import Flask, render_template, request, jsonify, send_file
from io import BytesIO

from core.importer import import_parking_spots, import_approval_records
from core.merger import merge_parking_spots, detect_duplicate_complaints
from core.conflict import detect_conflicts, detect_capacity_overflow
from core.exporter import export_public_list, export_conflict_report, export_diff_report
from core.models import ParkingSpot, ApprovalRecord, Conflict

app = Flask(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

DATA_FILE = os.path.join(DATA_DIR, "store.json")


def _load_store():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"spots": [], "approval_records": [], "conflicts": [], "merge_reports": [], "snapshots": []}


def _save_store(store):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=2)


def _spots_from_dicts(dicts):
    return [ParkingSpot(**d) for d in dicts]


def _records_from_dicts(dicts):
    return [ApprovalRecord(**d) for d in dicts]


def _conflicts_from_dicts(dicts):
    return [Conflict(**d) for d in dicts]


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/state", methods=["GET"])
def get_state():
    store = _load_store()
    return jsonify(store)


@app.route("/api/import/spots", methods=["POST"])
def import_spots():
    if "file" not in request.files:
        return jsonify({"error": "未上传文件"}), 400
    file = request.files["file"]
    content = file.read().decode("utf-8")
    filename = file.filename

    store = _load_store()
    existing = _spots_from_dicts(store["spots"])

    new_spots, batch_id = import_parking_spots(content, filename)

    before_snapshot = [s.to_dict() for s in existing]

    pre_merge_duplicates = detect_duplicate_complaints(new_spots)
    merged, merge_report = merge_parking_spots(existing, new_spots)
    post_merge_duplicates = detect_duplicate_complaints(merged)
    all_duplicates = pre_merge_duplicates + post_merge_duplicates

    approval_records = _records_from_dicts(store["approval_records"])
    conflicts = detect_conflicts(merged, approval_records)
    overflow = detect_capacity_overflow(merged)

    store["spots"] = [s.to_dict() for s in merged]
    store["conflicts"] = [c.to_dict() for c in conflicts]
    store["merge_reports"] = store.get("merge_reports", []) + merge_report
    store["duplicates"] = store.get("duplicates", []) + all_duplicates
    store["overflow"] = overflow

    _save_store(store)

    return jsonify({
        "added": len(new_spots),
        "merged_total": len(merged),
        "merge_report": merge_report,
        "duplicates": all_duplicates,
        "conflicts_count": len(conflicts),
        "overflow": overflow,
    })


@app.route("/api/import/approval", methods=["POST"])
def import_approval():
    if "file" not in request.files:
        return jsonify({"error": "未上传文件"}), 400
    file = request.files["file"]
    content = file.read().decode("utf-8")
    filename = file.filename

    records = import_approval_records(content, filename)

    store = _load_store()
    store["approval_records"] = [r.to_dict() for r in records]

    spots = _spots_from_dicts(store["spots"])
    conflicts = detect_conflicts(spots, records)
    store["conflicts"] = [c.to_dict() for c in conflicts]

    _save_store(store)

    return jsonify({
        "imported": len(records),
        "conflicts_count": len(conflicts),
    })


@app.route("/api/load-sample", methods=["POST"])
def load_sample():
    sample_dir = os.path.join(DATA_DIR, "sample")
    store = {"spots": [], "approval_records": [], "conflicts": [], "merge_reports": [], "snapshots": [], "duplicates": [], "overflow": []}

    spots_csv = os.path.join(sample_dir, "停车错峰点位.csv")
    if os.path.exists(spots_csv):
        with open(spots_csv, "r", encoding="utf-8") as f:
            content = f.read()
        new_spots, batch_id = import_parking_spots(content, "停车错峰点位.csv", "sample-batch")
        pre_merge_duplicates = detect_duplicate_complaints(new_spots)
        merged, merge_report = merge_parking_spots([], new_spots)
        post_merge_duplicates = detect_duplicate_complaints(merged)
        all_duplicates = pre_merge_duplicates + post_merge_duplicates
        store["spots"] = [s.to_dict() for s in merged]
        store["merge_reports"] = merge_report
        store["duplicates"] = all_duplicates
        overflow = detect_capacity_overflow(merged)
        store["overflow"] = overflow

    approval_csv = os.path.join(sample_dir, "审批台账.csv")
    if os.path.exists(approval_csv):
        with open(approval_csv, "r", encoding="utf-8") as f:
            content = f.read()
        records = import_approval_records(content, "审批台账.csv")
        store["approval_records"] = [r.to_dict() for r in records]

        spots = _spots_from_dicts(store["spots"])
        conflicts = detect_conflicts(spots, records)
        store["conflicts"] = [c.to_dict() for c in conflicts]

    _save_store(store)
    return jsonify({"status": "ok", "spots": len(store["spots"]), "records": len(store["approval_records"]), "conflicts": len(store["conflicts"])})


@app.route("/api/review/<spot_id>", methods=["POST"])
def review_spot(spot_id):
    data = request.json or {}
    action = data.get("action", "approve")
    note = data.get("note", "")

    store = _load_store()
    for s in store["spots"]:
        if s["id"] == spot_id:
            before = dict(s)
            if action == "approve":
                s["审核状态"] = "已通过"
            elif action == "reject":
                s["审核状态"] = "已驳回"
            elif action == "pending":
                s["审核状态"] = "待审核"
            if note:
                s["备注"] = s.get("备注", "") + f"；[审核]{note}"
            s["更新时间"] = datetime.now().isoformat()

            snapshot = {
                "id": datetime.now().strftime("%Y%m%d%H%M%S%f"),
                "时间戳": datetime.now().isoformat(),
                "操作": f"审核-{action}",
                "记录id": spot_id,
                "变更前": before,
                "变更后": dict(s),
            }
            store["snapshots"] = store.get("snapshots", []) + [snapshot]
            break

    _save_store(store)
    return jsonify({"status": "ok"})


@app.route("/api/supplement/<spot_id>", methods=["POST"])
def supplement_spot(spot_id):
    data = request.json or {}
    supplement_note = data.get("note", "")

    store = _load_store()
    before_spots = [dict(s) for s in store["spots"]]

    for s in store["spots"]:
        if s["id"] == spot_id:
            s["补录备注"] = supplement_note
            s["补录时间"] = datetime.now().isoformat()
            s["更新时间"] = datetime.now().isoformat()
            break

    after_spots = store["spots"]

    diff = export_diff_report(
        _spots_from_dicts(before_spots),
        _spots_from_dicts(after_spots),
        supplement_note
    )

    snapshot = {
        "id": datetime.now().strftime("%Y%m%d%H%M%S%f"),
        "时间戳": datetime.now().isoformat(),
        "操作": "补录备注",
        "记录id": spot_id,
        "变更前": {"补录备注": ""},
        "变更后": {"补录备注": supplement_note},
        "差异CSV": diff,
    }
    store["snapshots"] = store.get("snapshots", []) + [snapshot]
    store["last_diff"] = diff

    _save_store(store)
    return jsonify({"status": "ok", "diff": diff})


@app.route("/api/conflict/<conflict_id>", methods=["POST"])
def resolve_conflict(conflict_id):
    data = request.json or {}
    action = data.get("action", "")
    note = data.get("note", "")

    store = _load_store()
    for c in store["conflicts"]:
        if c["id"] == conflict_id:
            c["状态"] = "已处理" if action == "resolve" else "已忽略"
            c["处理备注"] = note
            break

    _save_store(store)
    return jsonify({"status": "ok"})


@app.route("/api/export/public", methods=["GET"])
def export_public():
    store = _load_store()
    spots = _spots_from_dicts(store["spots"])
    conflicts = _conflicts_from_dicts(store["conflicts"])
    merge_report = store.get("merge_reports", [])

    status_filter = request.args.get("status", "")
    if status_filter:
        spots = [s for s in spots if s.审核状态 == status_filter]

    csv_content = export_public_list(spots, conflicts, merge_report)

    buf = BytesIO(csv_content.encode("utf-8-sig"))
    buf.seek(0)
    return send_file(buf, as_attachment=True, download_name="老旧小区停车错峰_公示清单.csv", mimetype="text/csv")


@app.route("/api/export/conflicts", methods=["GET"])
def export_conflicts():
    store = _load_store()
    conflicts = _conflicts_from_dicts(store["conflicts"])

    csv_content = export_conflict_report(conflicts)

    buf = BytesIO(csv_content.encode("utf-8-sig"))
    buf.seek(0)
    return send_file(buf, as_attachment=True, download_name="老旧小区停车错峰_冲突报告.csv", mimetype="text/csv")


@app.route("/api/export/diff", methods=["GET"])
def export_diff():
    store = _load_store()
    diff_csv = store.get("last_diff", "")
    if not diff_csv:
        return jsonify({"error": "暂无差异报告，请先补录备注"}), 404

    buf = BytesIO(diff_csv.encode("utf-8-sig"))
    buf.seek(0)
    return send_file(buf, as_attachment=True, download_name="老旧小区停车错峰_差异报告.csv", mimetype="text/csv")


@app.route("/api/photo/<spot_id>", methods=["POST"])
def upload_photo(spot_id):
    if "file" not in request.files:
        return jsonify({"error": "未上传文件"}), 400
    file = request.files["file"]
    filename = f"{spot_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    file.save(filepath)

    store = _load_store()
    for s in store["spots"]:
        if s["id"] == spot_id:
            if "照片" not in s:
                s["照片"] = []
            s["照片"].append(filename)
            s["来源详情"] += f"；补充照片 {filename}"
            break
    _save_store(store)

    return jsonify({"status": "ok", "filename": filename})


@app.route("/api/reset", methods=["POST"])
def reset_data():
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
