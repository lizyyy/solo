import os
import sys
from flask import Flask, render_template, request, redirect, url_for, jsonify, send_file
import io

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import get_db, init_db
from importer import import_csv
from conflict import get_all_conflicts, get_conflicts_for_record, resolve_conflict, build_conflict_evidence
from exporter import (
    export_batch_report,
    export_conflict_report,
    export_full_report,
    export_diff_report,
    to_csv,
)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024


@app.before_request
def ensure_db():
    init_db()


@app.route("/")
def index():
    conn = get_db()
    batches = conn.execute("SELECT * FROM batch ORDER BY import_time DESC").fetchall()
    stats = conn.execute(
        "SELECT status, COUNT(*) as cnt FROM record GROUP BY status"
    ).fetchall()
    conflict_count = conn.execute("SELECT COUNT(*) as cnt FROM conflict WHERE resolution IS NULL").fetchone()["cnt"]
    conn.close()

    status_map = {s["status"]: s["cnt"] for s in stats}
    return render_template("index.html", batches=batches, status_map=status_map, conflict_count=conflict_count)


@app.route("/batch/<int:batch_id>")
def batch_detail(batch_id):
    conn = get_db()
    batch = conn.execute("SELECT * FROM batch WHERE id=?", (batch_id,)).fetchone()
    records = conn.execute("SELECT * FROM record WHERE batch_id=? ORDER BY transfer_date, from_branch", (batch_id,)).fetchall()
    conn.close()
    if not batch:
        return "批次不存在", 404
    return render_template("batch.html", batch=batch, records=records)


@app.route("/record/<int:record_id>")
def record_detail(record_id):
    conn = get_db()
    record = conn.execute("SELECT * FROM record WHERE id=?", (record_id,)).fetchone()
    conflicts = conn.execute("SELECT * FROM conflict WHERE record_id=? ORDER BY created_at", (record_id,)).fetchall()
    audit = conn.execute("SELECT * FROM audit_log WHERE record_id=? ORDER BY created_at", (record_id,)).fetchall()
    conn.close()
    if not record:
        return "记录不存在", 404
    return render_template("record.html", record=record, conflicts=conflicts, audit=audit)


@app.route("/record/<int:record_id>/confirm", methods=["POST"])
def confirm_record(record_id):
    conn = get_db()
    from datetime import datetime
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    operator = request.form.get("operator", "unknown")
    conn.execute("UPDATE record SET status='confirmed', updated_at=? WHERE id=?", (now, record_id))
    conn.execute(
        "INSERT INTO audit_log (record_id, action, old_value, new_value, operator, source, created_at) VALUES (?, 'status_change', 'pending', 'confirmed', ?, 'manual', ?)",
        (record_id, operator, now),
    )
    conn.commit()
    conn.close()
    return redirect(url_for("record_detail", record_id=record_id))


@app.route("/conflicts")
def conflict_list():
    status_filter = request.args.get("status", "all")
    conflicts = get_all_conflicts(status_filter if status_filter != "all" else None)
    return render_template("conflicts.html", conflicts=conflicts, current_filter=status_filter)


@app.route("/conflict/<int:conflict_id>/resolve", methods=["POST"])
def resolve_conflict_view(conflict_id):
    resolution = request.form.get("resolution")
    resolved_by = request.form.get("resolved_by", "unknown")
    if resolution not in ("use_import", "use_email", "manual_review", "other"):
        return "无效的处理方式", 400
    result = resolve_conflict(conflict_id, resolution, resolved_by)
    if not result:
        return "冲突不存在", 404
    conflict = get_conflicts_for_record(result.get("record_id", 0))
    if conflict:
        return redirect(url_for("record_detail", record_id=conflict[0]["record_id"]))
    return redirect(url_for("conflict_list"))


@app.route("/evidence/<int:record_id>")
def evidence_view(record_id):
    evidence = build_conflict_evidence(record_id)
    if not evidence:
        return "无冲突证据", 404
    return render_template("evidence.html", evidence=evidence)


@app.route("/import", methods=["GET", "POST"])
def import_data():
    if request.method == "POST":
        file = request.files.get("file")
        source_type = request.form.get("source_type", "bank_receipt")
        batch_name = request.form.get("batch_name", "")
        dedup_strategy = request.form.get("dedup_strategy", "skip")
        is_supplement = request.form.get("is_supplement") == "on"
        supplement_batch_id = request.form.get("supplement_batch_id", type=int)

        if not file or not file.filename:
            return "请选择文件", 400

        upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        from datetime import datetime
        safe_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        file_path = os.path.join(upload_dir, safe_name)
        file.save(file_path)

        result = import_csv(
            file_path,
            source_type=source_type,
            batch_name=batch_name or None,
            dedup_strategy=dedup_strategy,
            is_supplement=is_supplement,
            supplement_batch_id=supplement_batch_id,
        )
        return render_template("import_result.html", result=result)

    conn = get_db()
    batches = conn.execute("SELECT id, name FROM batch ORDER BY import_time DESC").fetchall()
    conn.close()
    return render_template("import.html", batches=batches)


@app.route("/export/full")
def export_full():
    rows = export_full_report()
    fields = [
        "record_id", "batch_name", "batch_source_type", "transfer_date",
        "from_branch", "to_branch", "amount", "currency", "operator",
        "transfer_type", "voucher_no", "approval_email_ref", "status",
        "original_source", "is_supplement", "created_at", "updated_at",
    ]
    csv_data = to_csv(rows, fields)
    buf = io.BytesIO(csv_data.encode("utf-8-sig"))
    return send_file(buf, as_attachment=True, download_name="尾箱调拨全量报告.csv", mimetype="text/csv")


@app.route("/export/conflicts")
def export_conflicts_route():
    rows = export_conflict_report()
    fields = [
        "conflict_id", "record_id", "transfer_date", "from_branch", "to_branch",
        "record_amount", "voucher_no", "conflict_field", "email_value",
        "import_value", "email_source", "import_source", "suggested_action",
        "resolution", "resolved_by", "resolved_at", "record_status", "created_at",
    ]
    csv_data = to_csv(rows, fields)
    buf = io.BytesIO(csv_data.encode("utf-8-sig"))
    return send_file(buf, as_attachment=True, download_name="冲突差异报告.csv", mimetype="text/csv")


@app.route("/export/batch/<int:batch_id>")
def export_batch(batch_id):
    report = export_batch_report(batch_id)
    if not report:
        return "批次不存在", 404
    fields = [
        "id", "transfer_date", "from_branch", "to_branch", "amount",
        "currency", "operator", "transfer_type", "voucher_no",
        "approval_email_ref", "status", "original_source", "created_at", "updated_at",
    ]
    csv_data = to_csv(report["records"], fields)
    buf = io.BytesIO(csv_data.encode("utf-8-sig"))
    return send_file(buf, as_attachment=True, download_name=f"批次{batch_id}_报告.csv", mimetype="text/csv")


@app.route("/diff", methods=["GET", "POST"])
def diff_view():
    conn = get_db()
    batches = conn.execute("SELECT id, name, source_type FROM batch ORDER BY import_time DESC").fetchall()

    if request.method == "POST":
        b1 = request.form.get("batch_id_1", type=int)
        b2 = request.form.get("batch_id_2", type=int)
        if not b1 or not b2:
            conn.close()
            return "请选择两个批次", 400
        result = export_diff_report(b1, b2)
        conn.close()
        if not result:
            return "批次不存在", 404
        return render_template("diff.html", diff=result, batches=batches)

    conn.close()
    return render_template("diff.html", diff=None, batches=batches)


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5050)
