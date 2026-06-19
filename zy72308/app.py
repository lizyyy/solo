"""线性回归残差复盘 - Web 应用
页面展示 / HTTP API / 参数版本页 全部读取同一份存储数据。
"""

import os
import tempfile
from pathlib import Path
from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    send_from_directory,
    redirect,
    url_for,
    abort,
    send_file,
)
from werkzeug.utils import secure_filename

from residual_review.storage import StorageManager
from residual_review.importer import DataImporter
from residual_review.row_manager import RowManager
from residual_review.exporter import UnifiedExporter
from residual_review.workflow import ReviewWorkflow


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXT = {".csv", ".xlsx", ".xls"}


def create_app(data_dir: str = None) -> Flask:
    app = Flask(
        __name__,
        template_folder=str(BASE_DIR / "templates"),
        static_folder=str(BASE_DIR / "static"),
    )
    app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

    data_root = Path(data_dir) if data_dir else DATA_DIR
    storage = StorageManager(str(data_root))
    exporter = UnifiedExporter(storage)
    importer = DataImporter(storage)
    row_mgr = RowManager(storage)
    workflow = ReviewWorkflow(str(data_root))

    app.config["STORAGE"] = storage
    app.config["EXPORTER"] = exporter
    app.config["IMPORTER"] = importer
    app.config["ROW_MGR"] = row_mgr
    app.config["WORKFLOW"] = workflow

    # ---------- 页面路由 ----------

    @app.get("/")
    def index():
        """复盘记录列表页"""
        records = []
        for imp_id in storage.list_records():
            try:
                data = exporter.export_for_display(imp_id)
                records.append(data)
            except Exception:
                continue
        return render_template("list.html", records=records)

    @app.get("/record/<import_id>")
    def record_detail(import_id):
        """复盘详情页（展示、补录、批注、重算全部同一份）"""
        try:
            data = exporter.export_for_display(import_id)
        except Exception:
            abort(404)
        return render_template("detail.html", data=data, import_id=import_id)

    @app.get("/record/<import_id>/params")
    def record_params(import_id):
        """参数版本页（触发更新并显示版本变化）"""
        try:
            data = exporter.export_for_display(import_id)
        except Exception:
            abort(404)
        return render_template("params.html", data=data, import_id=import_id)

    # ---------- API 路由（全部读取同一份 UnifiedExporter 结果） ----------

    @app.get("/api/health")
    def api_health():
        return jsonify({"status": "ok", "service": "residual-review"})

    @app.get("/api/records")
    def api_list_records():
        out = []
        for imp_id in storage.list_records():
            try:
                d = exporter.export_for_api(imp_id)
                out.append(
                    {
                        "导入ID": d["导入ID"],
                        "源文件": d["源文件"],
                        "状态": d["状态"],
                        "参数版本": d["参数版本"],
                        "总行数": d["总行数"],
                        "有效行数": d["有效行数"],
                        "断档行数": d["断档行数"],
                        "待复核行数": d["待复核行数"],
                        "一致性校验": d["数据一致性校验"],
                    }
                )
            except Exception:
                continue
        return jsonify({"count": len(out), "records": out})

    @app.get("/api/records/<import_id>")
    def api_record_detail(import_id):
        """接口详情 - 和页面/导出同源"""
        try:
            data = exporter.export_for_api(import_id)
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        return jsonify(data)

    @app.get("/api/records/<import_id>/history")
    def api_history(import_id):
        try:
            data = exporter.export_for_api(import_id)
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        return jsonify(
            {
                "import_id": import_id,
                "params_version": data["参数版本"],
                "regression_params": data["回归参数"],
                "params_history": data["参数历史快照"],
                "change_log": data["变更历史"],
            }
        )

    @app.post("/api/import")
    def api_import():
        """上传 CSV/Excel 并导入 —— 和命令行 `import` 走同一条 DataImporter 链路"""
        if "file" not in request.files:
            return jsonify({"error": "missing file"}), 400
        f = request.files["file"]
        if not f or f.filename == "":
            return jsonify({"error": "empty filename"}), 400
        ext = Path(f.filename).suffix.lower()
        if ext not in ALLOWED_EXT:
            return jsonify({"error": f"unsupported extension: {ext}, allow: {ALLOWED_EXT}"}), 400

        safe = secure_filename(f.filename) or ("upload" + ext)
        if not Path(safe).suffix:
            safe = safe + ext
        target = UPLOAD_DIR / f"{os.getpid()}_{safe}"
        f.save(target)

        author = request.form.get("author", "阿岚")
        source = request.form.get("source_name") or safe
        try:
            record, is_dup = importer.import_from_file(
                str(target), source_name=source, author=author
            )
        except Exception as e:
            return jsonify({"error": f"import failed: {e}"}), 400
        finally:
            try:
                target.unlink(missing_ok=True)
            except Exception:
                pass

        data = exporter.export_for_api(record.import_id)
        return jsonify(
            {
                "import_id": record.import_id,
                "duplicate": is_dup,
                "display_url": url_for("record_detail", import_id=record.import_id),
                "params_url": url_for("record_params", import_id=record.import_id),
                "record": data,
            }
        )

    @app.post("/api/records/<import_id>/delete_row")
    def api_delete_row(import_id):
        body = request.get_json(force=True, silent=True) or request.form
        line = int(body["line_no"])
        reason = body.get("reason", "人工删除")
        author = body.get("author", "阿岚")
        row_mgr.delete_row(import_id, line, notes=reason, author=author)
        return jsonify(exporter.export_for_api(import_id))

    @app.post("/api/records/<import_id>/supplement")
    def api_supplement(import_id):
        """补录一条记录 —— 自动触发残差重算，返回最新同一份数据"""
        body = request.get_json(force=True, silent=True) or request.form
        line = int(body["line_no"])
        xv = float(body["x_value"])
        yv = float(body["y_value"])
        reason = body.get("reason", "补录")
        author = body.get("author", "阿岚")
        skip_recalc = str(body.get("skip_recalc", "")).lower() in {"1", "true", "yes"}
        record, needs = row_mgr.supplement_row(
            import_id, line, xv, yv, notes=reason, author=author
        )
        if (not skip_recalc) and needs:
            importer.recalculate_residuals(
                import_id, trigger=f"页面补录行{line}后重算", author=author
            )
        return jsonify(exporter.export_for_api(import_id))

    @app.post("/api/records/<import_id>/review")
    def api_review(import_id):
        body = request.get_json(force=True, silent=True) or request.form
        line = int(body["line_no"])
        approve = str(body.get("approve", "true")).lower() in {"1", "true", "yes"}
        comment = body.get("comment", "")
        reviewer = body.get("reviewer", "教研组")
        record, needs = row_mgr.review_row(
            import_id, line, approve, comment=comment, reviewer=reviewer
        )
        if needs:
            importer.recalculate_residuals(
                import_id,
                trigger=f"页面复核行{line}（{'通过' if approve else '退回'}）后重算",
                author=reviewer,
            )
        return jsonify(exporter.export_for_api(import_id))

    @app.post("/api/records/<import_id>/annotate")
    def api_annotate(import_id):
        body = request.get_json(force=True, silent=True) or request.form
        line = int(body["line_no"])
        text = body["annotation"]
        author = body.get("author", "阿岚")
        row_mgr.add_annotation(import_id, line, text, author=author)
        return jsonify(exporter.export_for_api(import_id))

    @app.post("/api/records/<import_id>/recalc")
    def api_recalc(import_id):
        """参数版本页『更新参数』/ 详情页『重算』走同一条链路"""
        body = request.get_json(force=True, silent=True) or request.form
        trigger = body.get("trigger", "页面触发重算")
        author = body.get("author", "阿岚")
        row_mgr.update_params_and_recalc(import_id, author=author, trigger=trigger)
        return jsonify(exporter.export_for_api(import_id))

    # ---------- 导出接口（和页面/API 同源） ----------

    @app.get("/api/records/<import_id>/export/<fmt>")
    def api_export(import_id, fmt):
        try:
            if fmt == "json":
                path = exporter.export_to_json(import_id)
            elif fmt == "csv":
                path = exporter.export_to_csv(import_id)
            elif fmt == "changelog_csv":
                path = exporter.export_change_log_csv(import_id)
            elif fmt == "report":
                path = exporter.export_summary_report(import_id)
            else:
                return jsonify({"error": "format must be json/csv/changelog_csv/report"}), 400
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        return send_file(path, as_attachment=True, download_name=Path(path).name)

    @app.get("/api/records/<import_id>/export_all")
    def api_export_all(import_id):
        try:
            files = exporter.export_all(import_id)
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        return jsonify({"import_id": import_id, "files": files})

    return app


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5055"))
    create_app().run(host="127.0.0.1", port=port, debug=False)
