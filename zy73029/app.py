from flask import Flask, render_template, request, redirect, url_for, jsonify, abort
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import storage
import algorithms
from models import (
    STATUS_PENDING, STATUS_ALIGNED, STATUS_FLAGGED, STATUS_BLOCKED, STATUS_CLOSED,
    FLAG_LEVEL_INFO, FLAG_LEVEL_WARNING, FLAG_LEVEL_BLOCKER,
)

app = Flask(__name__)
app.secret_key = "exotic-pet-temp-tracking-secret"

STATUS_LABEL = {
    STATUS_PENDING: ("待对齐", "bg-gray-100 text-gray-800 border-gray-300"),
    STATUS_ALIGNED: ("信息对齐", "bg-green-100 text-green-800 border-green-300"),
    STATUS_FLAGGED: ("有疑点", "bg-yellow-100 text-yellow-800 border-yellow-300"),
    STATUS_BLOCKED: ("结论拦截", "bg-red-100 text-red-800 border-red-300"),
    STATUS_CLOSED: ("已归档", "bg-blue-50 text-blue-700 border-blue-200"),
}

LEVEL_LABEL = {
    FLAG_LEVEL_INFO: ("提示", "bg-blue-50 text-blue-700 border-blue-200"),
    FLAG_LEVEL_WARNING: ("警告", "bg-yellow-100 text-yellow-800 border-yellow-400"),
    FLAG_LEVEL_BLOCKER: ("拦截", "bg-red-100 text-red-800 border-red-500"),
}

EVENT_ICON = {
    "create": "📥",
    "status": "🔄",
    "flag": "⚠️",
    "blocker": "🛑",
    "dosage": "💊",
    "override": "✏️",
    "resolve": "✔️",
    "close": "📦",
}


@app.template_filter("status_badge")
def status_badge(status):
    label, cls = STATUS_LABEL.get(status, (status, "bg-gray-100"))
    return f'<span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border {cls}">{label}</span>'


@app.template_filter("level_badge")
def level_badge(level):
    label, cls = LEVEL_LABEL.get(level, (level, "bg-gray-100"))
    return f'<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border {cls}">{label}</span>'


@app.template_filter("event_icon")
def event_icon(etype):
    return EVENT_ICON.get(etype, "•")


@app.route("/")
def index():
    records = storage.list_records()
    stats = storage.get_stats()
    return render_template("index.html", records=records, stats=stats,
                           STATUS_LABEL=STATUS_LABEL, LEVEL_LABEL=LEVEL_LABEL)


@app.route("/record/<record_id>")
def record_detail(record_id):
    rec = storage.get_record(record_id)
    if not rec:
        abort(404)
    unresolved_blockers = [f for f in rec.flags if f.level == FLAG_LEVEL_BLOCKER and not f.resolved]
    unresolved = [f for f in rec.flags if not f.resolved]
    return render_template("record_detail.html", rec=rec,
                           unresolved_blockers=unresolved_blockers,
                           unresolved=unresolved,
                           STATUS_LABEL=STATUS_LABEL, LEVEL_LABEL=LEVEL_LABEL,
                           EVENT_ICON=EVENT_ICON)


@app.route("/record/new", methods=["GET", "POST"])
def record_new():
    if request.method == "POST":
        form = request.form
        try:
            rec = storage.create_record(
                pet_name=form.get("pet_name", "").strip(),
                pet_type=form.get("pet_type", "").strip(),
                owner_name=form.get("owner_name", "").strip(),
                original_temp=float(form.get("original_temp", 0) or 0),
                target_temp_min=float(form.get("target_temp_min", 0) or 0),
                target_temp_max=float(form.get("target_temp_max", 0) or 0),
                current_temp=float(form.get("current_temp", 0) or 0),
                owner_contact=form.get("owner_contact", "").strip(),
            )
            notes_raw = form.get("notes_text", "").strip()
            if notes_raw:
                for line in [x.strip() for x in notes_raw.split("\n") if x.strip()]:
                    algorithms.add_wechat_note(rec.record_id, line)
            algorithms.initial_align(rec.record_id)
            return redirect(url_for("record_detail", record_id=rec.record_id))
        except Exception as e:
            return render_template("record_new.html", error=str(e), form=form)
    return render_template("record_new.html", form={})


@app.route("/record/<record_id>/add_note", methods=["POST"])
def add_note(record_id):
    form = request.form
    raw = form.get("raw_text", "").strip()
    if not raw:
        return redirect(url_for("record_detail", record_id=record_id))
    try:
        algorithms.add_wechat_note(record_id, raw)
    except Exception as e:
        traceback.print_exc()
    return redirect(url_for("record_detail", record_id=record_id))


@app.route("/record/<record_id>/resolve_flag/<flag_id>", methods=["POST"])
def resolve_flag(record_id, flag_id):
    resolver = request.form.get("resolver", "匿名值班人").strip() or "匿名值班人"
    note = request.form.get("note", "").strip()
    if not note:
        return redirect(url_for("record_detail", record_id=record_id) + "#flags")
    try:
        algorithms.resolve_flag(record_id, flag_id, resolver, note)
    except Exception as e:
        traceback.print_exc()
    return redirect(url_for("record_detail", record_id=record_id) + "#flags")


@app.route("/record/<record_id>/override", methods=["POST"])
def override(record_id):
    operator = request.form.get("operator", "").strip() or "匿名值班人"
    new_status = request.form.get("new_status", "").strip()
    reason = request.form.get("reason", "").strip()
    resolve_flag_ids = request.form.getlist("resolve_flag_ids") or None
    if not (new_status and reason):
        return redirect(url_for("record_detail", record_id=record_id) + "#overrides")
    try:
        algorithms.manual_override(record_id, operator, new_status, reason, resolve_flag_ids)
    except Exception as e:
        traceback.print_exc()
    return redirect(url_for("record_detail", record_id=record_id) + "#timeline")


@app.route("/record/<record_id>/close", methods=["POST"])
def close_record(record_id):
    operator = request.form.get("operator", "").strip() or "系统"
    note = request.form.get("close_note", "").strip() or "正常归档"
    try:
        algorithms.close_record(record_id, operator, note)
    except ValueError as e:
        return redirect(url_for("record_detail", record_id=record_id) + f"?error={str(e)}#flags")
    except Exception:
        traceback.print_exc()
    return redirect(url_for("record_detail", record_id=record_id))


@app.route("/api/records")
def api_records():
    return jsonify([r.to_dict() for r in storage.list_records()])


@app.route("/api/records/<record_id>")
def api_record(record_id):
    rec = storage.get_record(record_id)
    if not rec:
        return jsonify({"error": "not found"}), 404
    return jsonify(rec.to_dict())


@app.route("/api/stats")
def api_stats():
    return jsonify(storage.get_stats())


@app.errorhandler(404)
def not_found(e):
    return render_template("404.html"), 404


if __name__ == "__main__":
    import seed_data
    seed_data.seed_if_empty()
    port = int(os.environ.get("PORT", 5050))
    print(f"🌡  异宠温控回访追踪服务启动: http://127.0.0.1:{port}")
    print(f"   数据持久化路径: {storage.DATA_FILE}")
    app.run(host="0.0.0.0", port=port, debug=False)
