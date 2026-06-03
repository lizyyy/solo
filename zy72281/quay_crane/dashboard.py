"""小看板 Web 界面."""
import json
from flask import Blueprint, render_template, request, redirect, url_for, flash

from .models import db, SafetyRadius, OriginNote, OperationRecord, PlaybackPath
from .services.radius_import import RadiusImportService
from .services.origin_note import OriginNoteService
from .services.playback import PlaybackService

bp = Blueprint("dashboard", __name__)


@bp.route("/")
def index():
    total_radius = SafetyRadius.query.count()
    normal_count = SafetyRadius.query.filter_by(status="normal").count()
    reversed_count = SafetyRadius.query.filter_by(status="z_reversed").count()
    updated_count = SafetyRadius.query.filter_by(status="updated").count()
    total_notes = OriginNote.query.count()
    unapplied_notes = OriginNote.query.filter_by(is_applied=False).count()
    total_playbacks = PlaybackPath.query.count()
    recent_ops = OperationRecord.query.order_by(OperationRecord.operation_time.desc()).limit(10).all()

    return render_template("dashboard.html",
        total_radius=total_radius,
        normal_count=normal_count,
        reversed_count=reversed_count,
        updated_count=updated_count,
        total_notes=total_notes,
        unapplied_notes=unapplied_notes,
        total_playbacks=total_playbacks,
        recent_ops=recent_ops
    )


@bp.route("/radius")
def radius_list():
    status = request.args.get("status")
    query = SafetyRadius.query
    if status:
        query = query.filter_by(status=status)
    records = query.order_by(SafetyRadius.created_at.desc()).all()
    return render_template("radius_list.html", records=records, current_status=status)


@bp.route("/radius/<int:record_id>")
def radius_detail(record_id):
    sr = SafetyRadius.query.get_or_404(record_id)
    playbacks = PlaybackService.get_playback_by_record(sr.record_no)
    origin_notes = OriginNoteService.get_notes_by_record(sr.record_no)
    return render_template("radius_detail.html",
        record=sr,
        playbacks=playbacks,
        origin_notes=origin_notes
    )


@bp.route("/radius/<int:record_id>/correct", methods=["POST"])
def radius_correct(record_id):
    correct_z = request.form.get("correct_z", type=float)
    correct_direction = request.form.get("correct_direction")
    operator = request.form.get("operator", "许工")
    try:
        op_record, sr = RadiusImportService.manual_correct(record_id, correct_z, correct_direction, operator)
        flash(f"修正完成：{sr.record_no}，状态: {sr.status}", "success")
    except ValueError as e:
        flash(str(e), "error")
    return redirect(url_for("dashboard.radius_detail", record_id=record_id))


@bp.route("/origin-notes")
def origin_note_list():
    notes = OriginNote.query.order_by(OriginNote.supplementary_at.desc()).all()
    return render_template("origin_note_list.html", notes=notes)


@bp.route("/origin-notes/add", methods=["GET", "POST"])
def origin_note_add():
    if request.method == "POST":
        try:
            note = OriginNoteService.add_note(
                note_no=request.form["note_no"],
                crane_no=request.form["crane_no"],
                record_no=request.form["record_no"],
                origin_x=float(request.form["origin_x"]),
                origin_y=float(request.form["origin_y"]),
                origin_z=float(request.form["origin_z"]),
                old_caliber=request.form.get("old_caliber"),
                z_direction_note=request.form.get("z_direction_note"),
                operator=request.form.get("operator", "许工")
            )
            flash(f"补录完成：{note.note_no}", "success")
            return redirect(url_for("dashboard.origin_note_list"))
        except Exception as e:
            flash(str(e), "error")
    return render_template("origin_note_form.html")


@bp.route("/playback")
def playback_list():
    playbacks = PlaybackPath.query.order_by(PlaybackPath.playback_time.desc()).all()
    return render_template("playback_list.html", playbacks=playbacks)


@bp.route("/playback/<record_no>/compare")
def playback_compare(record_no):
    comparison = PlaybackService.compare_results(record_no)
    return render_template("playback_compare.html", comparison=comparison)


@bp.route("/playback/generate", methods=["POST"])
def playback_generate():
    operator = request.form.get("operator", "许工")
    apply_origin = "apply_origin" in request.form
    record_id = request.form.get("safety_radius_id", type=int)
    description = request.form.get("description", "路径回放")
    try:
        op_record, playbacks = PlaybackService.generate_playback(
            safety_radius_id=record_id,
            operator=operator,
            apply_origin=apply_origin,
            description=description
        )
        flash(f"回放生成完成，{len(playbacks)} 条路径", "success")
    except Exception as e:
        flash(str(e), "error")
    return redirect(url_for("dashboard.playback_list"))


@bp.route("/playback/rerun-with-origin", methods=["POST"])
def playback_rerun():
    operator = request.form.get("operator", "许工")
    try:
        op_record, playbacks = PlaybackService.rerun_with_origin(operator)
        flash(f"重跑完成，{len(playbacks)} 条路径已更新", "success")
    except Exception as e:
        flash(str(e), "error")
    return redirect(url_for("dashboard.playback_list"))


@bp.route("/operations")
def operation_list():
    ops = OperationRecord.query.order_by(OperationRecord.operation_time.desc()).all()
    return render_template("operation_list.html", operations=ops)
