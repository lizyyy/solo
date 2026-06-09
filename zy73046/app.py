import json
import os
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, jsonify, send_file, abort
from models import get_conn, init_db
from importer import import_spare_parts, generate_sample_excel
from warning_engine import run_warning_pipeline, get_active_config
from handler import handle_warning_record, update_manual_remark
from exporter import export_anomaly_queue, export_manager_report

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024
UPLOAD_DIR = "uploads"
EXPORT_DIR = "exports"
SAMPLE_DIR = "samples"
for d in [UPLOAD_DIR, EXPORT_DIR, SAMPLE_DIR]:
    os.makedirs(d, exist_ok=True)

init_db()


@app.template_filter("fromjson")
def fromjson_filter(s):
    try:
        return json.loads(s)
    except Exception:
        return {}


@app.route("/")
def index():
    conn = get_conn()
    runs = conn.execute("""
        SELECT wr.*, tc.config_name,
            (SELECT COUNT(*) FROM warning_record w WHERE w.run_id=wr.id) as warn_cnt
        FROM warning_run wr
        LEFT JOIN threshold_config tc ON wr.config_id = tc.id
        ORDER BY wr.id DESC LIMIT 10
    """).fetchall()
    batches = conn.execute("SELECT * FROM import_batch ORDER BY id DESC LIMIT 10").fetchall()
    configs = conn.execute("SELECT * FROM threshold_config ORDER BY is_active DESC, id DESC").fetchall()
    conn.close()
    return render_template("index.html",
        runs=runs, batches=batches, configs=configs)


@app.route("/import", methods=["GET", "POST"])
def import_view():
    if request.method == "POST":
        f = request.files.get("file")
        use_sample = request.form.get("use_sample")
        operator = request.form.get("operator") or "测试用户"
        if use_sample:
            sample_path = os.path.join(SAMPLE_DIR, f"样例备件清单_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx")
            generate_sample_excel(sample_path)
            result = import_spare_parts(sample_path, os.path.basename(sample_path), operator)
        elif f and f.filename:
            stamp = datetime.now().strftime('%Y%m%d%H%M%S')
            fp = os.path.join(UPLOAD_DIR, f"{stamp}_{f.filename}")
            f.save(fp)
            result = import_spare_parts(fp, f.filename, operator)
        else:
            return render_template("import.html", error="请选择文件或使用样例数据")
        if not result.get("success"):
            return render_template("error.html", error=result.get("error", "导入失败"))
        return redirect(url_for("batch_detail", batch_id=result["batch_id"]))
    return render_template("import.html")


@app.route("/batch/<batch_id>")
def batch_detail(batch_id):
    conn = get_conn()
    batch = conn.execute("SELECT * FROM import_batch WHERE batch_id=?", (batch_id,)).fetchone()
    parts = conn.execute("SELECT * FROM spare_parts WHERE import_batch_id=? ORDER BY id", (batch_id,)).fetchall()
    conn.close()
    if not batch:
        abort(404)
    return render_template("batch_detail.html", batch=batch, parts=parts)


@app.route("/run", methods=["GET", "POST"])
def run_warning():
    conn = get_conn()
    if request.method == "POST":
        batch_id = request.form["import_batch_id"]
        config_id = request.form.get("config_id") or None
        if config_id:
            config_id = int(config_id)
        operator = request.form.get("operator") or "算法值班人"
        result = run_warning_pipeline(batch_id, config_id, operator)
        conn.close()
        if result["success"]:
            return redirect(url_for("run_detail", run_id=result["run_id"]))
        else:
            return render_template("error.html", error=result["error"])
    batches = conn.execute("SELECT * FROM import_batch ORDER BY id DESC").fetchall()
    configs = conn.execute("SELECT * FROM threshold_config ORDER BY is_active DESC, id DESC").fetchall()
    conn.close()
    return render_template("run_warning.html", batches=batches, configs=configs)


@app.route("/run/<int:run_id>")
def run_detail(run_id):
    conn = get_conn()
    run = conn.execute("""
        SELECT wr.*, tc.config_name, tc.remark as config_remark
        FROM warning_run wr
        JOIN threshold_config tc ON wr.config_id = tc.id
        WHERE wr.id = ?
    """, (run_id,)).fetchone()
    if not run:
        conn.close()
        abort(404)
    records_sql = """
        SELECT wr.*,
            sp.batch_no, sp.material_code, sp.material_name, sp.spec_model,
            sp.measured_value, sp.unit, sp.supplier, sp.raw_remark, sp.manual_remark,
            aq.queue_status, aq.priority, aq.file_conclusion
        FROM warning_record wr
        JOIN spare_parts sp ON wr.spare_part_id = sp.id
        JOIN anomaly_queue aq ON aq.warning_record_id = wr.id
        WHERE wr.run_id = ?
        ORDER BY CASE aq.priority WHEN '高' THEN 1 WHEN '中' THEN 2 ELSE 3 END, wr.id
    """
    records = conn.execute(records_sql, (run_id,)).fetchall()
    step_logs = json.loads(run["step_logs_json"]) if run["step_logs_json"] else []
    params_snapshot = json.loads(run["params_snapshot_json"])
    conn.close()
    return render_template("run_detail.html",
        run=run, records=records,
        step_logs=step_logs,
        params_snapshot=params_snapshot)


@app.route("/record/<int:record_id>", methods=["POST"])
def handle_record(record_id):
    new_status = request.form["new_status"]
    handle_remark = request.form.get("handle_remark") or None
    conclusion = request.form.get("conclusion") or None
    operator = request.form.get("operator") or "维保主管"
    result = handle_warning_record(record_id, new_status, handle_remark, conclusion, operator)
    ref = request.referrer or url_for("index")
    if result["success"]:
        return redirect(ref + f"#r{record_id}")
    else:
        return render_template("error.html", error=result["error"])


@app.route("/remark/<int:spare_id>", methods=["POST"])
def set_remark(spare_id):
    remark = request.form["manual_remark"]
    operator = request.form.get("operator") or "人工"
    result = update_manual_remark(spare_id, remark, operator)
    return redirect(request.referrer or url_for("index"))


@app.route("/config/new", methods=["POST"])
def new_config():
    name = request.form["config_name"]
    abs_thr = request.form.get("single_value_abs_threshold")
    params = {
        "deviation_upper_pct": float(request.form.get("deviation_upper_pct", 20)),
        "deviation_lower_pct": float(request.form.get("deviation_lower_pct", 20)),
        "use_robust_stat": int(request.form.get("use_robust_stat", 1)),
        "iqr_multiplier": float(request.form.get("iqr_multiplier", 1.5)),
        "zscore_threshold": float(request.form.get("zscore_threshold", 2.5)),
        "min_sample_size": int(request.form.get("min_sample_size", 5)),
        "single_value_abs_threshold": float(abs_thr) if abs_thr else None,
        "group_by": request.form.get("group_by", "spec_model"),
    }
    remark = request.form.get("remark") or ""
    set_active = int(request.form.get("set_active", 0))
    operator = request.form.get("created_by") or "配置管理员"
    conn = get_conn()
    c = conn.cursor()
    if set_active:
        c.execute("UPDATE threshold_config SET is_active=0")
    active_val = 1 if set_active else 0
    c.execute("""
        INSERT INTO threshold_config
        (config_name, params_json, created_at, created_by, is_active, remark)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        name, json.dumps(params, ensure_ascii=False),
        datetime.now().isoformat(), operator, active_val, remark
    ))
    conn.commit()
    conn.close()
    return redirect(url_for("index"))


@app.route("/export/queue/<int:run_id>")
def do_export_queue(run_id):
    stamp = datetime.now().strftime("%Y%m%d%H%M%S")
    out = os.path.join(EXPORT_DIR, f"异常队列_run{run_id}_{stamp}.xlsx")
    result = export_anomaly_queue(run_id, out)
    if result["success"]:
        return send_file(result["output_path"], as_attachment=True)
    return render_template("error.html", error=result["error"])


@app.route("/export/report/<int:run_id>")
def do_export_report(run_id):
    stamp = datetime.now().strftime("%Y%m%d%H%M%S")
    out = os.path.join(EXPORT_DIR, f"维保主管报告_run{run_id}_{stamp}.xlsx")
    result = export_manager_report(run_id, out)
    if result["success"]:
        return send_file(result["output_path"], as_attachment=True)
    return render_template("error.html", error=result["error"])


@app.route("/api/step_logs/<int:run_id>")
def api_step_logs(run_id):
    conn = get_conn()
    row = conn.execute("SELECT step_logs_json FROM warning_run WHERE id=?", (run_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "not found"}), 404
    logs = json.loads(row["step_logs_json"]) if row["step_logs_json"] else []
    return jsonify({"run_id": run_id, "steps": logs})


@app.route("/api/compare/<int:run_id>")
def api_compare(run_id):
    conn = get_conn()
    cur = conn.execute("""
        SELECT wr.*, tc.params_json
        FROM warning_run wr JOIN threshold_config tc ON wr.config_id = tc.id
        WHERE wr.id = ?
    """, (run_id,)).fetchone()
    if not cur:
        conn.close()
        return jsonify({"error": "not found"}), 404
    prev = conn.execute("""
        SELECT wr2.*, tc2.params_json as prev_params
        FROM warning_run wr2
        JOIN threshold_config tc2 ON wr2.config_id = tc2.id
        WHERE wr2.import_batch_id = ? AND wr2.id < ? AND wr2.status = '完成'
        ORDER BY wr2.id DESC LIMIT 1
    """, (cur["import_batch_id"], run_id)).fetchone()
    conn.close()
    cur_p = json.loads(cur["params_json"])
    if prev:
        prev_p = json.loads(prev["prev_params"])
        diffs = []
        for k in sorted(set(cur_p) | set(prev_p)):
            if cur_p.get(k) != prev_p.get(k):
                diffs.append({"param": k, "old": prev_p.get(k), "new": cur_p.get(k)})
        return jsonify({"success": True, "compared_with": prev["run_no"], "diffs": diffs})
    else:
        return jsonify({"success": True, "compared_with": None, "note": "无前次运行，首次运行无可比对象", "diffs": []})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
