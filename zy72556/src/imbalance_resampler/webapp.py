from __future__ import annotations

import os
import io
import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    Response,
    redirect,
    url_for,
    send_file,
    abort,
)

from .data_store import DataStore
from .resampler import ImbalanceResampler
from .workflow import WorkflowEngine
from .explanation import ExplanationGenerator
from .models import RecordStatus, ResampleRecord


STATUS_LABELS: Dict[str, Dict[str, str]] = {
    "imported": {"label": "已导入", "badge": "bg-gray-500"},
    "pending_review": {"label": "待审查", "badge": "bg-yellow-500"},
    "reviewed_by_ayue": {"label": "阿越已审", "badge": "bg-blue-500"},
    "confirmed_normal": {"label": "确认正常", "badge": "bg-green-600"},
    "needs_recheck": {"label": "待推荐负责人复核", "badge": "bg-orange-600"},
    "excluded": {"label": "已排除", "badge": "bg-red-600"},
    "suspicious_default_score": {"label": "可疑·特征缺失+默认分", "badge": "bg-red-500"},
}


def create_app(data_dir: str = "./data") -> Flask:
    package_dir = Path(__file__).parent
    template_folder = package_dir / "templates"
    static_folder = package_dir / "static"

    app = Flask(
        __name__,
        template_folder=str(template_folder),
        static_folder=str(static_folder),
    )

    app.config["DATA_DIR"] = data_dir

    data_store = DataStore(base_dir=data_dir)
    resampler = ImbalanceResampler()
    workflow = WorkflowEngine(data_store=data_store, resampler=resampler)
    explanation = ExplanationGenerator()

    def status_meta(status: str) -> Dict[str, str]:
        return STATUS_LABELS.get(status, {"label": status, "badge": "bg-gray-400"})

    def record_to_view(rec: ResampleRecord) -> Dict[str, Any]:
        return {
            "record_id": rec.record_id,
            "snapshot_id": rec.snapshot.snapshot_id,
            "original_line_number": rec.snapshot.original_line_number,
            "current_status": rec.current_status.value,
            "status_label": status_meta(rec.current_status.value)["label"],
            "status_badge": status_meta(rec.current_status.value)["badge"],
            "model_score": rec.snapshot.model_score,
            "true_label": rec.snapshot.true_label,
            "has_missing_features": rec.snapshot.has_missing_features,
            "missing_features": rec.snapshot.missing_features,
            "missing_count": len(rec.snapshot.missing_features),
            "used_default_score": rec.snapshot.used_default_score,
            "default_score_reason": rec.snapshot.default_score_reason,
            "final_weight": round(rec.final_weight, 6),
            "ayue_review_note": rec.ayue_review_note,
            "explanation_summary": rec.explanation_summary,
            "manual_edits_count": len(rec.manual_edits),
            "audit_log_count": len(rec.audit_log),
            "is_suspicious": rec.snapshot.used_default_score and rec.snapshot.has_missing_features,
        }

    # ========== 页面路由 ==========

    @app.route("/")
    def index():
        sessions = data_store.list_sessions()
        for s in sessions:
            try:
                dt = datetime.fromisoformat(s["created_at"])
                s["created_at_fmt"] = dt.strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                s["created_at_fmt"] = s["created_at"]
        return render_template("sessions.html", sessions=sessions)

    @app.route("/sessions/<session_id>")
    def session_detail(session_id: str):
        try:
            session = data_store.load_session(session_id)
        except FileNotFoundError:
            abort(404)

        summary = data_store.get_session_summary(session_id)

        overview = explanation.generate_overview(session)

        status_rows = []
        for status, count in summary["status_distribution"].items():
            meta = status_meta(status)
            status_rows.append({
                "status": status,
                "label": meta["label"],
                "badge": meta["badge"],
                "count": count,
            })

        records_view = [record_to_view(r) for r in session.records]
        suspicious_records = [r for r in records_view if r["is_suspicious"]]

        return render_template(
            "session_detail.html",
            session=session,
            summary=summary,
            overview=overview,
            status_rows=status_rows,
            records=records_view,
            suspicious_records=suspicious_records,
        )

    @app.route("/sessions/<session_id>/records/<record_id>")
    def record_detail(session_id: str, record_id: str):
        try:
            session = data_store.load_session(session_id)
        except FileNotFoundError:
            abort(404)

        rec = data_store.get_record_detail(session_id, record_id)
        if rec is None:
            abort(404)

        rec_view = record_to_view(rec)

        audit_log = []
        for i, entry in enumerate(rec.audit_log):
            ts = entry.timestamp
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts)
                except Exception:
                    pass
            if isinstance(ts, datetime):
                ts_str = ts.strftime("%Y-%m-%d %H:%M:%S")
            else:
                ts_str = str(ts)

            old_val = entry.old_value
            new_val = entry.new_value
            try:
                if isinstance(old_val, (dict, list)):
                    old_val = str(old_val)[:200]
                if isinstance(new_val, (dict, list)):
                    new_val = str(new_val)[:200]
            except Exception:
                pass

            audit_log.append({
                "index": i,
                "timestamp": ts_str,
                "action": entry.action.value,
                "operator": entry.operator,
                "comment": entry.comment,
                "field_name": entry.field_name,
                "old_value": old_val,
                "new_value": new_val,
            })

        boundary_rules = resampler.get_boundary_rules()
        rules_text = (
            f"特征缺失判定: 特征值={boundary_rules['missing_feature_detection']['trigger_value']}\n"
            f"默认分判定: 有缺失 + 模型分={boundary_rules['default_score_detection']['threshold']}\n"
            f"权重规则: 可疑记录权重减半，待复核"
        )

        return render_template(
            "record_detail.html",
            session_id=session_id,
            record=rec,
            rec_view=rec_view,
            audit_log=audit_log,
            detail_text=explanation.generate_detail(rec),
            status_meta=status_meta,
            boundary_rules_text=rules_text,
        )

    @app.route("/sessions/<session_id>/export")
    def export_page(session_id: str):
        try:
            session = data_store.load_session(session_id)
        except FileNotFoundError:
            abort(404)

        records_view = [record_to_view(r) for r in session.records]
        suspicious = [r for r in records_view if r["is_suspicious"]]

        status_counts: Dict[str, int] = {}
        for r in records_view:
            key = r["current_status"]
            status_counts[key] = status_counts.get(key, 0) + 1

        status_order = [
            "suspicious_default_score", "needs_recheck", "reviewed_by_ayue",
            "confirmed_normal", "imported", "pending_review", "excluded",
        ]
        status_summary_rows = []
        for key in status_order:
            if key in status_counts:
                meta = status_meta(key)
                status_summary_rows.append({
                    "status": key,
                    "label": meta["label"],
                    "badge": meta["badge"],
                    "count": status_counts[key],
                })
        for key, cnt in status_counts.items():
            if key not in status_order:
                meta = status_meta(key)
                status_summary_rows.append({
                    "status": key,
                    "label": meta["label"],
                    "badge": meta["badge"],
                    "count": cnt,
                })

        df = data_store.export_records_to_dataframe(session_id)
        columns = list(df.columns)[:25]

        preview_rows = df.head(50)[columns].fillna("").to_dict(orient="records")

        return render_template(
            "export_view.html",
            session_id=session_id,
            session=session,
            records=records_view,
            suspicious=suspicious,
            status_summary_rows=status_summary_rows,
            preview_columns=columns,
            preview_rows=preview_rows,
            total_rows=len(df),
        )

    # ========== REST API ==========

    @app.route("/api/sessions", methods=["GET"])
    def api_list_sessions():
        return jsonify(data_store.list_sessions())

    @app.route("/api/sessions/<session_id>", methods=["GET"])
    def api_session_summary(session_id: str):
        try:
            return jsonify(data_store.get_session_summary(session_id))
        except FileNotFoundError:
            return jsonify({"error": "not found"}), 404

    @app.route("/api/sessions/<session_id>/records", methods=["GET"])
    def api_list_records(session_id: str):
        try:
            session = data_store.load_session(session_id)
        except FileNotFoundError:
            return jsonify({"error": "not found"}), 404

        status_filter = request.args.getlist("status")
        only_suspicious = request.args.get("suspicious_only", "0") == "1"

        records = session.records
        if status_filter:
            records = [r for r in records if r.current_status.value in status_filter]
        if only_suspicious:
            records = [
                r for r in records
                if r.snapshot.used_default_score and r.snapshot.has_missing_features
            ]

        return jsonify([record_to_view(r) for r in records])

    @app.route("/api/sessions/<session_id>/records/<record_id>", methods=["GET"])
    def api_record_detail(session_id: str, record_id: str):
        rec = data_store.get_record_detail(session_id, record_id)
        if rec is None:
            return jsonify({"error": "not found"}), 404
        return jsonify(rec.model_dump(mode="json"))

    @app.route("/api/sessions/<session_id>/export.csv", methods=["GET"])
    def api_export_csv(session_id: str):
        try:
            df = data_store.export_records_to_dataframe(session_id)
        except FileNotFoundError:
            return jsonify({"error": "not found"}), 404

        output = io.StringIO()
        df.to_csv(output, index=False, encoding="utf-8-sig")
        csv_content = output.getvalue()

        return Response(
            csv_content,
            mimetype="text/csv; charset=utf-8-sig",
            headers={
                "Content-Disposition": f"attachment; filename=resample_{session_id}.csv"
            },
        )

    @app.route("/api/sessions/<session_id>/suspicious", methods=["GET"])
    def api_suspicious(session_id: str):
        try:
            session = data_store.load_session(session_id)
        except FileNotFoundError:
            return jsonify({"error": "not found"}), 404

        details = explanation.get_suspicious_record_details(session)
        return jsonify({
            "count": len(details),
            "records": details,
        })

    @app.route("/api/boundary-rules", methods=["GET"])
    def api_boundary_rules():
        return jsonify(resampler.get_boundary_rules())

    @app.route("/api/sessions/<session_id>/review", methods=["POST"])
    def api_ayue_review(session_id: str):
        payload = request.get_json(force=True, silent=True) or {}
        decisions = payload.get("decisions", {})
        reviewer = payload.get("reviewer", "ayue")

        try:
            session = workflow.step2_ayue_review_training_logs(
                session_id=session_id,
                record_decisions=decisions,
                reviewer=reviewer,
            )
        except FileNotFoundError:
            return jsonify({"error": "not found"}), 404

        return jsonify({
            "ok": True,
            "updated": len(decisions),
            "status_distribution": session.summary_stats.get("by_status", {}),
        })

    @app.route("/api/sessions/<session_id>/leader-review", methods=["POST"])
    def api_leader_review(session_id: str):
        payload = request.get_json(force=True, silent=True) or {}
        decisions = payload.get("decisions", {})
        operator = payload.get("operator", "recommend_leader")

        try:
            session = workflow.recommend_leader_review(
                session_id=session_id,
                record_decisions=decisions,
                operator=operator,
            )
        except FileNotFoundError:
            return jsonify({"error": "not found"}), 404

        return jsonify({
            "ok": True,
            "updated": len(decisions),
            "status_distribution": session.summary_stats.get("by_status", {}),
        })

    @app.route("/api/sessions/<session_id>/rollback", methods=["POST"])
    def api_rollback(session_id: str):
        payload = request.get_json(force=True, silent=True) or {}
        record_id = payload.get("record_id")
        to_audit_index = payload.get("to_audit_index")
        operator = payload.get("operator")
        reason = payload.get("reason")

        if not all([record_id, to_audit_index is not None, operator, reason]):
            return jsonify({"error": "missing fields"}), 400

        try:
            session = workflow.rollback_record(
                session_id=session_id,
                record_id=record_id,
                to_audit_index=int(to_audit_index),
                operator=operator,
                reason=reason,
            )
        except FileNotFoundError:
            return jsonify({"error": "not found"}), 404
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        return jsonify({"ok": True})

    @app.route("/health")
    def health():
        return jsonify({"status": "ok", "service": "imbalance-resampler"})

    return app


def run_server(
    host: str = "0.0.0.0",
    port: int = 5000,
    data_dir: str = "./data",
    debug: bool = False,
):
    app = create_app(data_dir=data_dir)
    app.run(host=host, port=port, debug=debug)
