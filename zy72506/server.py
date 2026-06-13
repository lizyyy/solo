from flask import Flask, jsonify, request, send_file, render_template
from flask_cors import CORS
from pathlib import Path
import tempfile

from src.models import VerificationStatus, ConflictType
from src import storage, engine, result_reader, importer

app = Flask(__name__,
            template_folder=str(Path(__file__).parent / "templates"),
            static_folder=str(Path(__file__).parent / "static"))
CORS(app)

storage.init_db()


def _parse_enum_list(param_str, enum_cls):
    if not param_str:
        return None
    try:
        return [enum_cls(s.strip()) for s in param_str.split(",")]
    except Exception:
        return None


@app.route("/")
def index():
    batches = storage.list_batches()
    return render_template("index.html", batches=batches)


@app.route("/batch/<batch_id>")
def batch_page(batch_id):
    batch = storage.get_batch(batch_id)
    if not batch:
        return "批次不存在", 404
    summary = result_reader.get_batch_summary(batch_id)
    return render_template("batch.html", batch=batch, summary=summary)


@app.route("/record/<record_id>")
def record_page(record_id):
    view = engine.get_record_for_review(record_id)
    if not view:
        return "记录不存在", 404
    explanation = engine.get_processing_explanation(record_id)
    return render_template("record.html", view=view, explanation=explanation)


@app.route("/api/v1/batches", methods=["GET"])
def api_list_batches():
    batches = storage.list_batches()
    return jsonify({
        "code": 0,
        "data": [b.model_dump() for b in batches]
    })


@app.route("/api/v1/batches/<batch_id>", methods=["GET"])
def api_get_batch(batch_id):
    batch = storage.get_batch(batch_id)
    if not batch:
        return jsonify({"code": 404, "msg": "批次不存在"}), 404
    summary = result_reader.get_batch_summary(batch_id)
    return jsonify({
        "code": 0,
        "data": {
            "batch": batch.model_dump(),
            "summary": summary
        }
    })


@app.route("/api/v1/batches/<batch_id>/records", methods=["GET"])
def api_list_records(batch_id):
    status_filter = request.args.get("status")
    conflict_filter = request.args.get("conflict")
    statuses = _parse_enum_list(status_filter, VerificationStatus)
    conflicts = _parse_enum_list(conflict_filter, ConflictType)

    results = result_reader.get_batch_results(
        batch_id,
        status_filter=statuses,
        conflict_filter=conflicts
    )
    return jsonify({
        "code": 0,
        "data": results,
        "total": len(results),
        "consistency_note": "此数据与 CLI list、Excel 导出、页面展示读同一份 SQLite 数据，经 engine.get_record_for_review() 统一转换"
    })


@app.route("/api/v1/records/<record_id>", methods=["GET"])
def api_get_record(record_id):
    view = engine.get_record_for_review(record_id)
    if not view:
        return jsonify({"code": 404, "msg": "记录不存在"}), 404
    explanation = engine.get_processing_explanation(record_id)
    return jsonify({
        "code": 0,
        "data": view,
        "processing_explanation": explanation,
        "consistency_note": "此数据与 CLI show、Excel 导出、页面展示读同一份 SQLite 数据，经 engine.get_record_for_review() 统一转换"
    })


@app.route("/api/v1/records/<record_id>/explanation", methods=["GET"])
def api_get_explanation(record_id):
    explanation = engine.get_processing_explanation(record_id)
    if not explanation:
        return jsonify({"code": 404, "msg": "记录不存在"}), 404
    return jsonify({
        "code": 0,
        "data": explanation
    })


@app.route("/api/v1/batches/<batch_id>/export", methods=["GET"])
def api_export(batch_id):
    status_filter = request.args.get("status")
    conflict_filter = request.args.get("conflict")
    statuses = _parse_enum_list(status_filter, VerificationStatus)
    conflicts = _parse_enum_list(conflict_filter, ConflictType)

    tmp_dir = Path(tempfile.gettempdir())
    out_path = str(tmp_dir / f"verification_export_{batch_id}.xlsx")

    result_path = result_reader.export_to_excel(
        batch_id, out_path,
        status_filter=statuses,
        conflict_filter=conflicts
    )

    return send_file(
        result_path,
        as_attachment=True,
        download_name=f"工单摘要事实校验_{batch_id}.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@app.route("/api/v1/batches/<batch_id>/logs", methods=["GET"])
def api_get_logs(batch_id):
    limit = int(request.args.get("limit", 100))
    logs = result_reader.get_operation_log_view(batch_id, limit=limit)
    return jsonify({
        "code": 0,
        "data": logs,
        "total": len(logs)
    })


@app.route("/api/v1/records/<record_id>/ai-review", methods=["POST"])
def api_ai_review(record_id):
    data = request.json or {}
    approve = data.get("approve", True)
    comment = data.get("comment", "")
    operator = data.get("operator", "阿宁")

    try:
        record = engine.ai_pm_review(record_id, operator, comment, approve)
        return jsonify({
            "code": 0,
            "msg": "复核完成",
            "data": {
                "record_id": record.id,
                "new_status": record.status,
                "new_status_display": engine.get_status_display(record.status)
            }
        })
    except Exception as e:
        return jsonify({"code": 500, "msg": str(e)}), 500


@app.route("/api/v1/records/<record_id>/operation-review", methods=["POST"])
def api_operation_review(record_id):
    data = request.json or {}
    approve = data.get("approve", True)
    comment = data.get("comment", "")
    operator = data.get("operator", "运营")

    try:
        record = engine.operation_review(record_id, operator, approve, comment)
        return jsonify({
            "code": 0,
            "msg": "运营复核完成",
            "data": {
                "record_id": record.id,
                "new_status": record.status,
                "new_status_display": engine.get_status_display(record.status)
            }
        })
    except Exception as e:
        return jsonify({"code": 500, "msg": str(e)}), 500


@app.route("/api/v1/records/<record_id>/mark-page-updated", methods=["POST"])
def api_mark_page_updated(record_id):
    data = request.json or {}
    comment = data.get("comment", "")
    operator = data.get("operator", "system")

    try:
        record = engine.mark_review_page_updated(record_id, operator, comment)
        return jsonify({
            "code": 0,
            "msg": "已标记复盘页更新",
            "data": {
                "record_id": record.id,
                "new_status": record.status
            }
        })
    except Exception as e:
        return jsonify({"code": 500, "msg": str(e)}), 500


@app.route("/api/v1/records/<record_id>/rollback", methods=["POST"])
def api_rollback(record_id):
    data = request.json or {}
    reason = data.get("reason", "")
    operator = data.get("operator", "system")
    rollback_to_step = data.get("rollback_to_step")

    try:
        record = engine.rollback_record(record_id, operator, reason, rollback_to_step)
        return jsonify({
            "code": 0,
            "msg": "回滚完成，导出的明细和报告关联状态已恢复到对应快照版本",
            "data": {
                "record_id": record.id,
                "new_status": record.status,
                "rollbacked_fields": "status, conflict_type, model_version, review_fields"
            }
        })
    except Exception as e:
        return jsonify({"code": 500, "msg": str(e)}), 500


@app.route("/api/v1/health", methods=["GET"])
def api_health():
    batches = storage.list_batches()
    return jsonify({
        "code": 0,
        "status": "ok",
        "data": {
            "db_initialized": True,
            "batch_count": len(batches),
            "storage_engine": "SQLite",
            "single_source_of_truth": "data/verification.db → storage.py → engine.get_record_for_review()",
            "consistency": "CLI / API / Web / Excel Export 全部通过同一数据层读取"
        }
    })


def run_server(host="0.0.0.0", port=5000, debug=False):
    print(f"=" * 60)
    print(f"工单摘要事实校验 - Web服务启动")
    print(f"=" * 60)
    print(f"  页面入口: http://{host}:{port}/")
    print(f"  API入口:  http://{host}:{port}/api/v1/")
    print(f"  健康检查: http://{host}:{port}/api/v1/health")
    print(f"")
    print(f"  三端数据一致性保证:")
    print(f"    CLI / Web页面 / REST API / Excel导出")
    print(f"    → 全部通过 storage.py 读同一个 SQLite 库")
    print(f"    → 全部通过 engine.get_record_for_review() 统一转换")
    print(f"=" * 60)
    app.run(host=host, port=port, debug=debug)


if __name__ == "__main__":
    run_server()
