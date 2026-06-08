import os
import json
from flask import Flask, render_template, request, jsonify, send_file
from datetime import datetime
from uuid import uuid4
from station_passenger_flow.processor import StationFlowProcessor
from station_passenger_flow.store import DataStore, DateTimeEncoder
from station_passenger_flow.models import RangefinderRecord


def create_app(data_dir=None):
    if data_dir is None:
        data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

    app = Flask(__name__, template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates"),
                static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), "static"))
    app.config["DATA_DIR"] = data_dir

    _processors = {}

    def _get_processor(session_id="default"):
        if session_id not in _processors:
            _processors[session_id] = StationFlowProcessor(data_dir=data_dir)
        return _processors[session_id]

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/api/cad/import", methods=["POST"])
    def api_cad_import():
        p = _get_processor()
        data = request.json
        result = p.import_cad_layer(
            layer_name=data["layer_name"],
            source_file=data.get("source_file", "upload.dwg"),
            z_direction=float(data["z_direction"]),
            points=data.get("points", []),
            operator=data.get("operator", "小陶"),
            import_batch=data.get("import_batch")
        )
        if p.get_store():
            p.get_store().save_result(result)
        return jsonify(_result_to_dict(result))

    @app.route("/api/rangefinder/supplement", methods=["POST"])
    def api_rangefinder_supplement():
        p = _get_processor()
        data = request.json
        records = []
        for r in data.get("records", []):
            records.append(RangefinderRecord(
                record_id=r.get("record_id", str(uuid4())),
                measure_time=datetime.now(),
                z_direction=float(r["z_direction"]),
                distance=float(r["distance"]),
                measure_point=r["measure_point"],
                operator=r.get("operator", "小陶"),
                is_supplement=r.get("is_supplement", False),
                notes=r.get("notes")
            ))
        result = p.supplement_rangefinder_records(records)
        if p.get_store():
            p.get_store().save_result(result)
        return jsonify(_result_to_dict(result))

    @app.route("/api/bottleneck/calculate", methods=["POST"])
    def api_calculate_bottleneck():
        p = _get_processor()
        result = p.calculate_bottleneck()
        if p.get_store():
            p.get_store().save_result(result)
        return jsonify(_result_to_dict(result))

    @app.route("/api/replay/update", methods=["POST"])
    def api_replay_update():
        p = _get_processor()
        data = request.json
        result = p.update_path_replay(data.get("path_points", []))
        return jsonify(_result_to_dict(result))

    @app.route("/api/replay/versions", methods=["GET"])
    def api_replay_versions():
        p = _get_processor()
        return jsonify(p.replay_list_versions())

    @app.route("/api/replay/detail/<int:version>", methods=["GET"])
    def api_replay_detail(version):
        p = _get_processor()
        detail = p.replay_version_detail(version)
        if detail.get("path_points"):
            detail["path_points"] = [_pathpoint_to_dict(pp) for pp in detail["path_points"]]
        return jsonify(detail)

    @app.route("/api/replay/compare", methods=["GET"])
    def api_replay_compare():
        p = _get_processor()
        v1 = request.args.get("v1", type=int)
        v2 = request.args.get("v2", type=int)
        if v1 is None or v2 is None:
            return jsonify({"error": "请提供v1和v2版本号"}), 400
        return jsonify(p.replay_compare(v1, v2))

    @app.route("/api/replay/verify/<int:replay_version>", methods=["GET"])
    def api_replay_verify(replay_version):
        p = _get_processor()
        return jsonify(p.replay_verify_latest(replay_version))

    @app.route("/api/conflicts", methods=["GET"])
    def api_list_conflicts():
        p = _get_processor()
        conflicts = p.list_conflicts()
        return jsonify([_conflict_to_dict(c) for c in conflicts])

    @app.route("/api/conflicts/<int:conflict_index>/resolve", methods=["POST"])
    def api_resolve_conflict(conflict_index):
        p = _get_processor()
        data = request.json
        result = p.resolve_conflict(
            conflict_index=conflict_index,
            confirmed=data.get("confirmed", True),
            operator=data.get("operator", "小陶"),
            comment=data.get("comment")
        )
        if p.get_store():
            p.get_store().save_result(result)
        return jsonify(_result_to_dict(result))

    @app.route("/api/export", methods=["GET"])
    def api_export():
        p = _get_processor()
        result_dict = p.export_result()
        return jsonify(result_dict)

    @app.route("/api/export/download", methods=["GET"])
    def api_export_download():
        p = _get_processor()
        result_dict = p.export_result()
        temp_path = os.path.join(data_dir, "temp_export.json")
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(result_dict, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)
        return send_file(temp_path, as_attachment=True, download_name="bottleneck_report.json", mimetype="application/json")

    @app.route("/api/results", methods=["GET"])
    def api_list_results():
        store = DataStore(data_dir)
        return jsonify(store.list_all_results())

    @app.route("/api/results/<result_id>", methods=["GET"])
    def api_load_result(result_id):
        store = DataStore(data_dir)
        version = request.args.get("version", type=int)
        result = store.load_result(result_id, version)
        if result is None:
            return jsonify({"error": "找不到该结果"}), 404
        return jsonify(_result_to_dict(result))

    @app.route("/api/selfcheck", methods=["GET"])
    def api_run_selfcheck():
        p = _get_processor()
        result = p.get_current_result()
        if not result:
            return jsonify({"error": "没有当前处理的结果"}), 400
        checks = p.validator.run_all_checks(result)
        return jsonify([{
            "check_name": c.check_name,
            "passed": c.passed,
            "message": c.message,
            "details": c.details
        } for c in checks])

    @app.route("/api/status", methods=["GET"])
    def api_status():
        p = _get_processor()
        result = p.get_current_result()
        if not result:
            return jsonify({"status": "empty", "message": "还没有开始操作，请先导入CAD图层。"})
        step_names = {
            "cad_import": "CAD图层导入",
            "rangefinder_supplement": "补看测距仪记录",
            "path_replay_update": "路径回放更新",
            "completed": "已完成"
        }
        return jsonify({
            "status": result.current_step,
            "status_label": step_names.get(result.current_step, result.current_step),
            "hall_name": result.hall_name,
            "version": result.version,
            "conflict_count": len(result.conflicts),
            "z_direction_status": result.z_direction_status,
            "is_supplemented": result.is_supplemented
        })

    def _result_to_dict(result):
        d = result.model_dump(mode="json")
        return d

    def _conflict_to_dict(c):
        return {
            "conflict_type": c.conflict_type,
            "cad_value": str(c.cad_value),
            "rangefinder_value": str(c.rangefinder_value),
            "description": c.description,
            "location": c.location,
            "confidence": c.confidence
        }

    def _pathpoint_to_dict(pp):
        return {"x": pp.x, "y": pp.y, "z": pp.z, "passenger_count": pp.passenger_count}

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
