from flask import Flask, request, jsonify, send_from_directory, abort
import os
import sys
import csv
import io
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
from engine import run_schedule, run_diff, FIELD_ALIASES
from storage import (
    load_versions, get_version, load_records,
    load_diffs, get_diff, update_record, resolve_anomaly,
    load_sample_input, save_sample_input,
)

app = Flask(__name__, static_folder="static", static_url_path="/static")

ROOT = os.path.dirname(os.path.abspath(__file__))


@app.route("/")
def index():
    return send_from_directory(ROOT, "static/index.html")


# ============ Versions ============
@app.route("/api/versions", methods=["GET"])
def list_versions():
    vs = load_versions()
    return jsonify([{
        "version_id": v.version_id,
        "version_name": v.version_name,
        "created_by": v.created_by,
        "created_at": v.created_at,
        "note": v.note,
        "record_count": v.record_count,
        "anomaly_count": v.anomaly_count,
    } for v in vs])


@app.route("/api/versions/<version_id>", methods=["GET"])
def get_version_detail(version_id):
    v = get_version(version_id)
    if not v:
        abort(404)
    return jsonify({
        "version_id": v.version_id,
        "version_name": v.version_name,
        "created_by": v.created_by,
        "created_at": v.created_at,
        "note": v.note,
        "params": v.params,
        "record_count": v.record_count,
        "anomaly_count": v.anomaly_count,
    })


# ============ Run Schedule ============
@app.route("/api/run", methods=["POST"])
def api_run():
    body = request.get_json(force=True)
    rows = body.get("rows") or load_sample_input()
    params = body.get("params", {
        "photo_window_days": 7,
        "min_quantity": 1,
        "priority": "default",
        "urgent_categories": ["滚刀", "主轴承密封"],
    })
    version_name = body.get("version_name", f"排程-{datetime.now().strftime('%Y%m%d-%H%M')}")
    created_by = body.get("created_by", "系统")
    note = body.get("note", "")
    source_tag = body.get("source_tag", "导入")
    v = run_schedule(rows, params, version_name, created_by, note, source_tag)
    return jsonify({"version_id": v.version_id, "version_name": v.version_name})


# ============ Records ============
@app.route("/api/versions/<version_id>/records", methods=["GET"])
def list_records(version_id):
    if not get_version(version_id):
        abort(404)
    only_anomaly = request.args.get("anomaly", "0") == "1"
    records = load_records(version_id)
    out = []
    for r in records:
        if only_anomaly and not r.anomalies:
            continue
        out.append({
            "record_id": r.record_id,
            "part_id": r.part_id,
            "part_name": r.part_name,
            "category": r.category,
            "scheduled_date": r.scheduled_date,
            "quantity": r.quantity,
            "status": r.status,
            "source": r.source,
            "photo_url": r.photo_url,
            "photo_time": r.photo_time,
            "anomaly_count": len(r.anomalies),
            "has_error": any(a.severity == "error" for a in r.anomalies),
            "field_mapping_log": r.field_mapping_log,
            "source_fields": r.source_fields,
            "updated_at": r.updated_at,
        })
    return jsonify(out)


@app.route("/api/versions/<version_id>/records/<record_id>", methods=["GET"])
def get_record(version_id, record_id):
    for r in load_records(version_id):
        if r.record_id == record_id:
            return jsonify({
                "record_id": r.record_id,
                "part_id": r.part_id,
                "part_name": r.part_name,
                "category": r.category,
                "scheduled_date": r.scheduled_date,
                "quantity": r.quantity,
                "status": r.status,
                "source": r.source,
                "photo_url": r.photo_url,
                "photo_time": r.photo_time,
                "source_fields": r.source_fields,
                "field_mapping_log": r.field_mapping_log,
                "anomalies": [
                    {
                        "anomaly_id": a.anomaly_id,
                        "anomaly_type": a.anomaly_type,
                        "description": a.description,
                        "severity": a.severity,
                        "resolved": a.resolved,
                        "resolved_note": a.resolved_note,
                        "created_at": a.created_at,
                    }
                    for a in r.anomalies
                ],
                "audit_log": r.audit_log,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
            })
    abort(404)


@app.route("/api/versions/<version_id>/records/<record_id>", methods=["PUT"])
def api_update_record(version_id, record_id):
    body = request.get_json(force=True)
    updates = body.get("updates", {})
    operator = body.get("operator", "未知")
    reason = body.get("reason", "")
    if not reason:
        return jsonify({"error": "必须填写变更原因"}), 400
    allowed = {"status", "scheduled_date", "quantity", "category", "part_name"}
    updates = {k: v for k, v in updates.items() if k in allowed}
    if not updates:
        return jsonify({"error": "没有可更新字段"}), 400
    rec = update_record(version_id, record_id, updates, operator, reason)
    if not rec:
        abort(404)
    return jsonify({"ok": True})


@app.route("/api/versions/<version_id>/records/<record_id>/anomalies/<anomaly_id>/resolve", methods=["POST"])
def api_resolve_anomaly(version_id, record_id, anomaly_id):
    body = request.get_json(force=True)
    note = body.get("note", "")
    operator = body.get("operator", "未知")
    a = resolve_anomaly(version_id, record_id, anomaly_id, note, operator)
    if not a:
        abort(404)
    return jsonify({"ok": True})


# ============ Export ============
@app.route("/api/versions/<version_id>/export", methods=["GET"])
def export_csv(version_id):
    if not get_version(version_id):
        abort(404)
    records = load_records(version_id)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "备件编号", "备件名称", "分类", "排程日期", "数量", "状态", "来源",
        "异常数", "是否有严重异常", "照片时间", "照片链接",
        "异常详情", "变更次数", "最近更新",
    ])
    for r in records:
        anom_detail = " | ".join(
            f"[{a.anomaly_type}-{a.severity}]{a.description}"
            + ("(已处理)" if a.resolved else "")
            for a in r.anomalies
        )
        w.writerow([
            r.part_id, r.part_name, r.category, r.scheduled_date, r.quantity,
            r.status, r.source, len(r.anomalies),
            "是" if any(a.severity == "error" for a in r.anomalies) else "否",
            r.photo_time, r.photo_url,
            anom_detail, len(r.audit_log), r.updated_at,
        ])
    return app.response_class(
        buf.getvalue(),
        mimetype="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename=排程_{version_id}.csv"},
    )


# ============ Diff ============
@app.route("/api/diff", methods=["POST"])
def api_diff():
    body = request.get_json(force=True)
    d = run_diff(body["base"], body["compare"])
    return jsonify({
        "diff_id": d.diff_id,
        "summary": d.summary,
        "param_changes": d.param_changes,
        "record_changes": d.record_changes,
    })


@app.route("/api/diffs", methods=["GET"])
def list_diffs():
    ds = load_diffs()
    return jsonify([{
        "diff_id": d.diff_id,
        "base_version": d.base_version,
        "compare_version": d.compare_version,
        "created_at": d.created_at,
        "summary": d.summary,
    } for d in ds])


# ============ Samples ============
@app.route("/api/sample-input", methods=["GET"])
def api_sample():
    return jsonify(load_sample_input())


@app.route("/api/field-aliases", methods=["GET"])
def api_aliases():
    return jsonify(FIELD_ALIASES)


# ============ Summary / Drill-down ============
@app.route("/api/versions/<version_id>/summary", methods=["GET"])
def api_summary(version_id):
    v = get_version(version_id)
    if not v:
        abort(404)
    records = load_records(version_id)
    by_status = {}
    by_category = {}
    by_anom_type = {}
    anomaly_list = []
    for r in records:
        by_status[r.status] = by_status.get(r.status, 0) + 1
        by_category[r.category or "未分类"] = by_category.get(r.category or "未分类", 0) + 1
        for a in r.anomalies:
            by_anom_type[a.anomaly_type] = by_anom_type.get(a.anomaly_type, 0) + 1
            anomaly_list.append({
                "record_id": r.record_id,
                "part_id": r.part_id,
                "part_name": r.part_name,
                "anomaly_id": a.anomaly_id,
                "anomaly_type": a.anomaly_type,
                "description": a.description,
                "severity": a.severity,
                "resolved": a.resolved,
                "created_at": a.created_at,
            })
    return jsonify({
        "version_id": v.version_id,
        "version_name": v.version_name,
        "total": len(records),
        "anomaly_total": len(anomaly_list),
        "by_status": by_status,
        "by_category": by_category,
        "by_anom_type": by_anom_type,
        "anomalies": anomaly_list,
        "params": v.params,
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
