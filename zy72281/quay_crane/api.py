"""Flask REST API 接口."""
import json
from flask import Blueprint, request, jsonify

from .models import db, SafetyRadius, OriginNote, OperationRecord, PlaybackPath
from .services.radius_import import RadiusImportService
from .services.origin_note import OriginNoteService
from .services.playback import PlaybackService

bp = Blueprint("api", __name__)


@bp.route("/safety-radius", methods=["GET"])
def list_safety_radius():
    status = request.args.get("status")
    query = SafetyRadius.query
    if status:
        query = query.filter_by(status=status)
    records = query.all()
    return jsonify({"data": [r.to_dict() for r in records], "count": len(records)})


@bp.route("/safety-radius", methods=["POST"])
def import_safety_radius():
    data = request.get_json()
    if not data or "records" not in data:
        return jsonify({"error": "请求体需包含records数组"}), 400
    operator = data.get("operator", "API用户")
    description = data.get("description", "API导入安全半径表")
    try:
        op_record, results = RadiusImportService.import_from_records(data["records"], operator, description)
        return jsonify({
            "operation_id": op_record.id,
            "results": results,
            "affected_count": op_record.affected_count
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@bp.route("/safety-radius/<int:record_id>", methods=["GET"])
def get_safety_radius(record_id):
    sr = SafetyRadius.query.get(record_id)
    if not sr:
        return jsonify({"error": "记录不存在"}), 404
    return jsonify(sr.to_dict())


@bp.route("/safety-radius/<int:record_id>/correct", methods=["POST"])
def manual_correct(record_id):
    data = request.get_json()
    try:
        op_record, sr = RadiusImportService.manual_correct(
            record_id,
            correct_z=data.get("correct_z"),
            correct_direction=data.get("correct_direction"),
            operator=data.get("operator", "许工")
        )
        return jsonify({"operation_id": op_record.id, "record": sr.to_dict()})
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@bp.route("/safety-radius/pending-review", methods=["GET"])
def pending_review():
    records = RadiusImportService.get_pending_review()
    return jsonify({"data": [r.to_dict() for r in records], "count": len(records)})


@bp.route("/origin-notes", methods=["GET"])
def list_origin_notes():
    record_no = request.args.get("record_no")
    if record_no:
        notes = OriginNoteService.get_notes_by_record(record_no)
    else:
        notes = OriginNote.query.all()
    return jsonify({"data": [n.to_dict() for n in notes], "count": len(notes)})


@bp.route("/origin-notes", methods=["POST"])
def add_origin_note():
    data = request.get_json()
    if not data:
        return jsonify({"error": "请求体不能为空"}), 400
    try:
        note = OriginNoteService.add_note(
            note_no=data["note_no"],
            crane_no=data["crane_no"],
            record_no=data["record_no"],
            origin_x=float(data["origin_x"]),
            origin_y=float(data["origin_y"]),
            origin_z=float(data["origin_z"]),
            old_caliber=data.get("old_caliber"),
            z_direction_note=data.get("z_direction_note"),
            operator=data.get("operator", "许工"),
            operation_record_id=data.get("operation_record_id")
        )
        return jsonify(note.to_dict()), 201
    except (KeyError, ValueError) as e:
        return jsonify({"error": str(e)}), 400


@bp.route("/origin-notes/unapplied", methods=["GET"])
def unapplied_notes():
    notes = OriginNoteService.get_unapplied_notes()
    return jsonify({"data": [n.to_dict() for n in notes], "count": len(notes)})


@bp.route("/playback/generate", methods=["POST"])
def generate_playback():
    data = request.get_json() or {}
    record_id = data.get("safety_radius_id")
    operator = data.get("operator", "许工")
    apply_origin = data.get("apply_origin", True)
    description = data.get("description", "路径回放")
    try:
        op_record, playbacks = PlaybackService.generate_playback(
            safety_radius_id=record_id,
            operator=operator,
            apply_origin=apply_origin,
            description=description
        )
        return jsonify({
            "operation_id": op_record.id,
            "playbacks": [pp.to_dict() for pp in playbacks],
            "affected_count": op_record.affected_count
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@bp.route("/playback/rerun-with-origin", methods=["POST"])
def rerun_with_origin():
    data = request.get_json() or {}
    operator = data.get("operator", "许工")
    try:
        op_record, playbacks = PlaybackService.rerun_with_origin(operator)
        return jsonify({
            "operation_id": op_record.id,
            "playbacks": [pp.to_dict() for pp in playbacks],
            "affected_count": op_record.affected_count
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@bp.route("/playback/<record_no>", methods=["GET"])
def get_playback(record_no):
    playbacks = PlaybackService.get_playback_by_record(record_no)
    return jsonify({"data": [pp.to_dict() for pp in playbacks], "count": len(playbacks)})


@bp.route("/playback/<record_no>/compare", methods=["GET"])
def compare_playback(record_no):
    comparison = PlaybackService.compare_results(record_no)
    return jsonify(comparison)


@bp.route("/operations", methods=["GET"])
def list_operations():
    records = OperationRecord.query.order_by(OperationRecord.operation_time.desc()).all()
    return jsonify({"data": [r.to_dict() for r in records], "count": len(records)})


@bp.route("/dashboard/summary", methods=["GET"])
def dashboard_summary():
    total_radius = SafetyRadius.query.count()
    normal_count = SafetyRadius.query.filter_by(status="normal").count()
    reversed_count = SafetyRadius.query.filter_by(status="z_reversed").count()
    updated_count = SafetyRadius.query.filter_by(status="updated").count()
    total_notes = OriginNote.query.count()
    unapplied_notes = OriginNote.query.filter_by(is_applied=False).count()
    total_playbacks = PlaybackPath.query.count()
    total_operations = OperationRecord.query.count()

    return jsonify({
        "safety_radius": {
            "total": total_radius,
            "normal": normal_count,
            "z_reversed": reversed_count,
            "updated": updated_count
        },
        "origin_notes": {
            "total": total_notes,
            "unapplied": unapplied_notes
        },
        "playbacks": total_playbacks,
        "operations": total_operations
    })
