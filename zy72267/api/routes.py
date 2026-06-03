from flask import Flask, jsonify, request, render_template, Response
from dataclasses import asdict
from datetime import datetime
import json

from services import (
    DataStore,
    ImportService,
    SelfCheckService,
    ReviewService,
    ExportService,
)
from models import ReviewStatus, ReviewIssue


def create_app():
    app = Flask(__name__, template_folder="../templates", static_folder="../static")

    data_store = DataStore()
    import_service = ImportService()
    self_check_service = SelfCheckService()
    review_service = ReviewService()
    export_service = ExportService()

    @app.route("/")
    def index():
        batches = []
        for pc_log in data_store.get_all_point_cloud_logs():
            summary = data_store.get_batch_summary(pc_log.batch_id)
            workflow = review_service.get_review_workflow_status(pc_log.batch_id)
            batches.append({
                "batch_id": pc_log.batch_id,
                "file_name": pc_log.file_name,
                "imported_at": pc_log.imported_at.isoformat(),
                "imported_by": pc_log.imported_by,
                "is_duplicate": pc_log.is_duplicate,
                "summary": summary,
                "workflow": workflow
            })
        return render_template("index.html", batches=batches)

    @app.route("/batch/<batch_id>")
    def batch_detail(batch_id):
        summary = data_store.get_batch_summary(batch_id)
        review_records = data_store.get_all_review_records(batch_id)
        self_check_result = self_check_service.get_self_check_result(batch_id)
        workflow = review_service.get_review_workflow_status(batch_id)

        records_with_details = []
        for review in review_records:
            detail = data_store.get_point_detail(batch_id, review.point_id)
            records_with_details.append(detail)

        return render_template(
            "batch_detail.html",
            batch_id=batch_id,
            summary=summary,
            self_check_result=self_check_result,
            workflow=workflow,
            records=records_with_details,
            status_options=[s.value for s in ReviewStatus],
            issue_options=[i.value for i in ReviewIssue]
        )

    @app.route("/api/import/point_cloud", methods=["POST"])
    def api_import_point_cloud():
        data = request.json
        file_name = data.get("file_name", "point_cloud.csv")
        file_content = data.get("file_content", "")
        imported_by = data.get("imported_by", "小陶")

        pc_log, is_duplicate, duplicate_of = import_service.import_point_cloud_log(
            file_name, file_content, imported_by
        )

        return jsonify({
            "success": True,
            "batch_id": pc_log.batch_id,
            "is_duplicate": is_duplicate,
            "duplicate_of_batch": duplicate_of,
            "record_count": len(pc_log.records)
        })

    @app.route("/api/import/coordinate", methods=["POST"])
    def api_import_coordinate():
        data = request.json
        batch_id = data["batch_id"]
        file_name = data.get("file_name", "coordinate.csv")
        file_content = data.get("file_content", "")
        imported_by = data.get("imported_by", "小陶")

        coord_table = import_service.import_coordinate_table(
            batch_id, file_name, file_content, imported_by
        )

        self_check_service.check_missing_coordinates(batch_id, imported_by)

        return jsonify({
            "success": True,
            "table_id": coord_table.table_id,
            "record_count": len(coord_table.records)
        })

    @app.route("/api/import/photo_points", methods=["POST"])
    def api_import_photo_points():
        data = request.json
        batch_id = data["batch_id"]
        photo_points_data = data.get("photo_points", [])
        imported_by = data.get("imported_by", "小陶")

        photo_points = import_service.import_photo_points(
            batch_id, photo_points_data, imported_by
        )

        import_service.initialize_review_records(batch_id, imported_by)

        return jsonify({
            "success": True,
            "count": len(photo_points)
        })

    @app.route("/api/self_check/<batch_id>")
    def api_self_check(batch_id):
        result = self_check_service.run_self_check(batch_id)
        return jsonify(result)

    @app.route("/api/review/initialize/<batch_id>")
    def api_initialize_review(batch_id):
        records = import_service.initialize_review_records(batch_id)
        return jsonify({
            "success": True,
            "count": len(records)
        })

    @app.route("/api/review/supplement_coordinate", methods=["POST"])
    def api_supplement_coordinate():
        data = request.json
        batch_id = data["batch_id"]
        point_id = data["point_id"]
        x = float(data["x"])
        y = float(data["y"])
        z = float(data["z"])
        operator = data.get("operator", "小陶")

        result = review_service.supplement_coordinate(
            batch_id, point_id, x, y, z, operator
        )

        return jsonify({"success": True, "detail": result})

    @app.route("/api/review/safety_radius", methods=["POST"])
    def api_check_safety_radius():
        data = request.json
        batch_id = data["batch_id"]
        safety_data = data.get("safety_data", [])
        operator = data.get("operator", "小陶")

        result = review_service.check_safety_radius(
            batch_id, safety_data, operator
        )

        return jsonify({
            "success": True,
            "count": len(result.records)
        })

    @app.route("/api/review/occlusion", methods=["POST"])
    def api_update_occlusion():
        data = request.json
        batch_id = data["batch_id"]
        occlusion_data = data.get("occlusion_data", [])
        operator = data.get("operator", "小陶")

        result = review_service.update_occlusion_list(
            batch_id, occlusion_data, operator
        )

        return jsonify({
            "success": True,
            "count": len(result.records)
        })

    @app.route("/api/review/recalculate", methods=["POST"])
    def api_recalculate():
        data = request.json
        batch_id = data["batch_id"]
        point_id = data.get("point_id")
        operator = data.get("operator", "小陶")

        result = review_service.recalculate(batch_id, point_id, operator)
        return jsonify(result)

    @app.route("/api/review/submit", methods=["POST"])
    def api_submit_for_review():
        data = request.json
        batch_id = data["batch_id"]
        point_id = data["point_id"]
        operator = data.get("operator", "小陶")

        result = review_service.submit_for_safety_review(
            batch_id, point_id, operator
        )

        return jsonify({"success": True, "detail": result})

    @app.route("/api/review/safety_review", methods=["POST"])
    def api_safety_review():
        data = request.json
        batch_id = data["batch_id"]
        point_id = data["point_id"]
        is_approved = data.get("is_approved", True)
        remarks = data.get("remarks", "")
        operator = data.get("operator", "安全员")

        result = review_service.safety_review(
            batch_id, point_id, is_approved, remarks, operator
        )

        return jsonify({"success": True, "detail": result})

    @app.route("/api/review/manual_modify", methods=["POST"])
    def api_manual_modify():
        data = request.json
        batch_id = data["batch_id"]
        point_id = data["point_id"]
        new_x = float(data["new_x"])
        new_y = float(data["new_y"])
        new_z = float(data["new_z"])
        reason = data.get("reason", "")
        operator = data.get("operator", "小陶")

        result = review_service.manually_modify_point_cloud(
            batch_id, point_id, new_x, new_y, new_z, reason, operator
        )

        return jsonify({"success": True, "detail": result})

    @app.route("/api/export/<batch_id>")
    def api_export(batch_id):
        result = export_service.export_details(batch_id)
        return jsonify(result)

    @app.route("/api/export/csv/<batch_id>")
    def api_export_csv(batch_id):
        csv_content = export_service.export_to_csv(batch_id)
        return Response(
            csv_content,
            mimetype="text/csv",
            headers={"Content-disposition": f"attachment; filename=skyline_review_{batch_id}.csv"}
        )

    @app.route("/api/export/consistency/<batch_id>")
    def api_check_consistency(batch_id):
        result = export_service.check_export_consistency(batch_id)
        return jsonify(result)

    @app.route("/api/batch/<batch_id>/summary")
    def api_batch_summary(batch_id):
        summary = data_store.get_batch_summary(batch_id)
        return jsonify(summary)

    @app.route("/api/batch/<batch_id>/workflow")
    def api_batch_workflow(batch_id):
        workflow = review_service.get_review_workflow_status(batch_id)
        return jsonify(workflow)

    @app.route("/api/point/<batch_id>/<point_id>")
    def api_point_detail(batch_id, point_id):
        detail = data_store.get_point_detail(batch_id, point_id)
        return jsonify(detail)

    @app.route("/api/audit_logs/<batch_id>")
    def api_audit_logs(batch_id):
        logs = data_store.get_audit_logs(batch_id=batch_id)
        return jsonify([log.to_dict() for log in logs])

    @app.route("/api/batches")
    def api_batches():
        batches = []
        for pc_log in data_store.get_all_point_cloud_logs():
            summary = data_store.get_batch_summary(pc_log.batch_id)
            batches.append({
                "batch_id": pc_log.batch_id,
                "file_name": pc_log.file_name,
                "imported_at": pc_log.imported_at.isoformat(),
                "imported_by": pc_log.imported_by,
                "is_duplicate": pc_log.is_duplicate,
                "summary": summary
            })
        return jsonify(batches)

    return app
