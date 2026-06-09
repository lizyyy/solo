import os
import json
from datetime import datetime
from flask import (
    Flask, render_template, request, redirect, url_for, session,
    send_file, flash, jsonify, abort,
)
from sqlalchemy import or_, and_, desc

import config
from models import (
    init_db, Reconciliation, ExportBatch, FilterState,
    Pet, MedicalRecord, ManualNote,
)
from reconcile_engine import (
    run_reconciliation, export_csv, save_manual_note,
    save_filter_state, load_filter_state,
)

app = Flask(__name__)
app.secret_key = "pet_weight_reconcile_secret_key_2026"
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

FILTER_STATE_KEY = "filter_reconcile_main"


def get_session():
    return init_db()


def get_latest_batch(db):
    b = db.query(Reconciliation.batch_no).distinct().order_by(
        desc(Reconciliation.created_at)
    ).first()
    return b[0] if b else None


def apply_filters(query, filters, batch_no):
    query = query.filter(Reconciliation.batch_no == batch_no)
    if filters.get("review_status"):
        query = query.filter(Reconciliation.review_status == filters["review_status"])
    if filters.get("name_match_status"):
        query = query.filter(Reconciliation.name_match_status == filters["name_match_status"])
    if filters.get("weight_unit_status"):
        query = query.filter(Reconciliation.weight_unit_status == filters["weight_unit_status"])
    if filters.get("process_status"):
        query = query.filter(Reconciliation.process_status == filters["process_status"])
    if filters.get("process_round"):
        try:
            query = query.filter(Reconciliation.process_round == int(filters["process_round"]))
        except (ValueError, TypeError):
            pass
    if filters.get("pet_name"):
        kw = f"%{filters['pet_name']}%"
        query = query.filter(
            or_(Reconciliation.pet_name.like(kw), Reconciliation.handwritten_name.like(kw))
        )
    if filters.get("has_note") == "1":
        query = query.filter(Reconciliation.manual_note.isnot(None)).filter(Reconciliation.manual_note != "")
    elif filters.get("has_note") == "0":
        query = query.filter(or_(Reconciliation.manual_note.is_(None), Reconciliation.manual_note == ""))
    return query


@app.route("/", methods=["GET"])
def index():
    db = get_session()
    try:
        batch_no = request.args.get("batch") or get_latest_batch(db)
        if not batch_no:
            return render_template(
                "index.html",
                records=[],
                filters={},
                current_batch=None,
                all_batches=[],
                stats={},
                page=1,
                total_pages=1,
                total=0,
                per_page=20,
            )

        persisted = load_filter_state(db, FILTER_STATE_KEY) or {"filters": {}, "page": 1, "per_page": 20}

        url_filters = {}
        for key in ["review_status", "name_match_status", "weight_unit_status",
                    "process_status", "process_round", "pet_name", "has_note"]:
            v = request.args.get(key)
            if v is not None and v != "":
                url_filters[key] = v

        if request.args.get("reset_filter") == "1":
            filters = {}
            page = 1
        elif url_filters:
            filters = url_filters
            page = int(request.args.get("page", 1))
        else:
            filters = persisted["filters"]
            page = int(request.args.get("page", persisted["page"]))

        per_page = int(request.args.get("per_page", persisted.get("per_page", 20)))

        save_filter_state(db, FILTER_STATE_KEY, filters, page=page, per_page=per_page)

        base_q = apply_filters(db.query(Reconciliation), filters, batch_no)
        total = base_q.count()
        total_pages = max(1, (total + per_page - 1) // per_page)
        page = max(1, min(page, total_pages))

        records = (base_q.order_by(
            desc(Reconciliation.process_round),
            Reconciliation.id.asc()
        ).offset((page - 1) * per_page).limit(per_page).all())

        all_batch_rows = db.query(Reconciliation.batch_no).distinct().order_by(
            desc(Reconciliation.created_at)
        ).all()
        all_batches = []
        for (bn,) in all_batch_rows:
            cnt = db.query(Reconciliation).filter(Reconciliation.batch_no == bn).count()
            need = db.query(Reconciliation).filter(
                Reconciliation.batch_no == bn, Reconciliation.review_status == "需复核"
            ).count()
            all_batches.append({"batch_no": bn, "count": cnt, "need_review": need})

        all_q = db.query(Reconciliation).filter(Reconciliation.batch_no == batch_no)
        total_all = all_q.count()
        need_review = all_q.filter(Reconciliation.review_status == "需复核").count()
        normal = total_all - need_review
        has_note_count = all_q.filter(Reconciliation.manual_note.isnot(None)).filter(
            Reconciliation.manual_note != ""
        ).count()
        name_unmatched = all_q.filter(Reconciliation.name_match_status == "未匹配").count()
        weight_mixed = all_q.filter(Reconciliation.weight_unit_status == "混写(已转换)").count()

        stats = {
            "total": total_all,
            "need_review": need_review,
            "normal": normal,
            "has_note": has_note_count,
            "name_unmatched": name_unmatched,
            "weight_mixed": weight_mixed,
        }

        export_batches = db.query(ExportBatch).order_by(desc(ExportBatch.created_at)).limit(10).all()

        return render_template(
            "index.html",
            records=records,
            filters=filters,
            current_batch=batch_no,
            all_batches=all_batches,
            stats=stats,
            page=page,
            total_pages=total_pages,
            total=total,
            per_page=per_page,
            export_batches=export_batches,
        )
    finally:
        db.close()


@app.route("/api/note", methods=["POST"])
def api_save_note():
    db = get_session()
    try:
        data = request.get_json(silent=True) or request.form
        rec_id = data.get("rec_id")
        content = (data.get("content") or "").strip()
        created_by = data.get("created_by") or "阿岑"

        if not rec_id or not content:
            return jsonify({"ok": False, "error": "参数缺失"}), 400

        note = save_manual_note(db, int(rec_id), content, created_by=created_by)
        if note is None:
            return jsonify({"ok": False, "error": "未找到对账记录"}), 404

        return jsonify({
            "ok": True,
            "note_id": note.id,
            "content": note.note_content,
            "source": note.note_source,
            "created_by": note.created_by,
            "created_at": note.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        })
    finally:
        db.close()


@app.route("/api/note_history/<int:rec_id>")
def api_note_history(rec_id):
    db = get_session()
    try:
        notes = db.query(ManualNote).filter(
            ManualNote.reconciliation_id == rec_id
        ).order_by(desc(ManualNote.created_at)).all()
        return jsonify([
            {
                "id": n.id,
                "content": n.note_content,
                "source": n.note_source,
                "created_by": n.created_by,
                "created_at": n.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "is_latest": n.is_latest,
            }
            for n in notes
        ])
    finally:
        db.close()


@app.route("/api/reconcile", methods=["POST"])
def api_reconcile():
    db = get_session()
    try:
        data = request.get_json(silent=True) or {}
        batch_no = data.get("batch_no")
        process_round = int(data.get("process_round") or 1)

        if process_round > 1 and not batch_no:
            latest = get_latest_batch(db)
            if latest:
                batch_no = latest

        batch_no, results, logs = run_reconciliation(db, batch_no=batch_no, process_round=process_round)
        return jsonify({
            "ok": True,
            "batch_no": batch_no,
            "process_round": process_round,
            "count": len(results),
            "need_review": sum(1 for r in results if r["review_status"] == "需复核"),
            "logs": logs[-30:],
            "redirect": url_for("index", batch=batch_no),
        })
    finally:
        db.close()


@app.route("/api/export", methods=["POST"])
def api_export():
    db = get_session()
    try:
        data = request.get_json(silent=True) or {}
        batch_no = data.get("batch_no") or get_latest_batch(db)
        if not batch_no:
            return jsonify({"ok": False, "error": "无批次可导出"}), 400

        persisted = load_filter_state(db, FILTER_STATE_KEY)
        filters = data.get("filters") or (persisted["filters"] if persisted else {})
        use_filters = data.get("use_current_filters", True)
        if not use_filters:
            filters = {}

        file_path, count = export_csv(db, batch_no, filters=filters)
        file_name = os.path.basename(file_path)
        return jsonify({
            "ok": True,
            "file_name": file_name,
            "file_path": file_path,
            "count": count,
            "download_url": url_for("download_export", filename=file_name),
            "filters": filters,
        })
    finally:
        db.close()


@app.route("/exports/<path:filename>")
def download_export(filename):
    target = os.path.join(config.EXPORT_DIR, filename)
    if not os.path.exists(target) or not os.path.abspath(target).startswith(os.path.abspath(config.EXPORT_DIR)):
        abort(404)
    return send_file(target, as_attachment=True, download_name=filename, mimetype="text/csv")


@app.route("/api/restore_filter/<string:state_key>")
def api_restore_filter(state_key):
    db = get_session()
    try:
        loaded = load_filter_state(db, state_key)
        if not loaded:
            return jsonify({"ok": False, "error": "未找到状态"}), 404
        save_filter_state(db, FILTER_STATE_KEY, loaded["filters"], page=loaded["page"], per_page=loaded["per_page"])
        return jsonify({"ok": True, "filters": loaded["filters"], "redirect": url_for("index")})
    finally:
        db.close()


@app.context_processor
def inject_helpers():
    def status_class(s):
        return {
            "需复核": "badge badge-review",
            "正常": "badge badge-ok",
            "待复核": "badge badge-review",
            "已复核": "badge badge-done",
            "完全匹配": "tag tag-ok",
            "别名匹配": "tag tag-warn",
            "模糊匹配": "tag tag-warn",
            "未匹配": "tag tag-danger",
            "标准": "tag tag-ok",
            "混写(已转换)": "tag tag-warn",
            "无单位(默认kg)": "tag tag-info",
            "无法识别": "tag tag-danger",
            "首轮处理": "tag tag-info",
            "重跑(后补)": "tag tag-warn",
            "新增": "tag tag-info",
        }.get(s, "tag")
    return {"status_class": status_class, "now": datetime.now()}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print("启动宠物减重排程对账 Web 服务 ...")
    print(f"  数据目录: {config.DATA_DIR}")
    print(f"  导出目录: {config.EXPORT_DIR}")
    print(f"  访问地址: http://127.0.0.1:{port}/")
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
