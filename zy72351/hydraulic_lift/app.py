import os
import json
from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for
from hydraulic_lift.database import db, get_db_uri
from hydraulic_lift.models import CalculationRecord, Parameter, Screenshot
from hydraulic_lift.engine import HydraulicLiftEngine
from hydraulic_lift.audit import log_audit, get_record_audit_trail, get_parameter_audit_trail


def create_app(db_path=None):
    app = Flask(
        __name__,
        template_folder=os.path.join(os.path.dirname(__file__), "templates"),
        static_folder=os.path.join(os.path.dirname(__file__), "static"),
    )
    app.config["SQLALCHEMY_DATABASE_URI"] = get_db_uri(db_path)
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["UPLOAD_FOLDER"] = os.path.join(os.path.dirname(__file__), "uploads")
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    db.init_app(app)
    with app.app_context():
        db.create_all()

    register_page_routes(app)
    register_api_routes(app)
    return app


def register_page_routes(app):
    @app.route("/")
    def dashboard():
        records = CalculationRecord.query.order_by(CalculationRecord.updated_at.desc()).all()
        return render_template("dashboard.html", records=records)

    @app.route("/record/<int:record_id>")
    def replay(record_id):
        record = CalculationRecord.query.get_or_404(record_id)
        params = record.parameters.all()
        input_params = [p for p in params if p.category == "input"]
        output_params = [p for p in params if p.category == "output"]
        screenshots = record.screenshots.all()
        audit_trail = get_record_audit_trail(record_id)
        return render_template(
            "replay.html",
            record=record,
            input_params=input_params,
            output_params=output_params,
            screenshots=screenshots,
            audit_trail=audit_trail,
        )

    @app.route("/import", methods=["GET", "POST"])
    def import_page():
        if request.method == "POST":
            name = request.form.get("name", "新建载荷试算")
            source_chat = request.form.get("source_chat", "维修群")
            description = request.form.get("description", "")
            params_json = request.form.get("params", "{}")
            manual_overrides = request.form.get("manual_overrides", "{}")

            record = CalculationRecord(name=name, status="draft")
            db.session.add(record)
            db.session.commit()

            log_audit(record.id, "create", "系统", "system", note="创建试算记录")

            screenshot = Screenshot(
                record_id=record.id,
                filename="imported_from_chat.png",
                description=description,
                source_chat=source_chat,
                extracted_summary=params_json,
            )
            db.session.add(screenshot)
            db.session.commit()

            log_audit(record.id, "import_screenshot", "训练教练老唐", "training_coach",
                       note="从{}导入截图".format(source_chat))

            params_data = json.loads(params_json) if params_json else {}
            overrides = json.loads(manual_overrides) if manual_overrides else {}

            all_params = dict(HydraulicLiftEngine.DEFAULT_PARAMS)
            all_params.update(params_data)

            for key, meta in all_params.items():
                is_override = key in overrides
                p = Parameter(
                    record_id=record.id,
                    name=key,
                    display_name=meta.get("display_name", key),
                    value=meta.get("value", 0),
                    original_value=HydraulicLiftEngine.DEFAULT_PARAMS.get(key, {}).get("value") if is_override else None,
                    unit=meta.get("unit", ""),
                    category=meta.get("category", "input"),
                    source="manual_override" if is_override else "screenshot_import",
                    is_manual_override=is_override,
                    override_reason=None,
                    override_by="训练教练老唐" if is_override else None,
                )
                db.session.add(p)
                if is_override:
                    log_audit(
                        record.id, "manual_override", "训练教练老唐", "training_coach",
                        parameter_id=None,
                        old_value=str(p.original_value),
                        new_value=str(p.value),
                        reason=None,
                        note="人工修正{}：{}→{}（未写原因）".format(
                            p.display_name, p.original_value, p.value),
                    )

            db.session.commit()

            _recalculate(record.id)

            if record.has_unresolved_flags():
                record.status = "needs_engineer_review"
                db.session.commit()

            return redirect(url_for("replay", record_id=record.id))

        return render_template("import_page.html", default_params=HydraulicLiftEngine.DEFAULT_PARAMS)


def register_api_routes(app):
    @app.route("/api/records", methods=["GET"])
    def api_list_records():
        records = CalculationRecord.query.order_by(CalculationRecord.updated_at.desc()).all()
        return jsonify([r.to_dict() for r in records])

    @app.route("/api/records", methods=["POST"])
    def api_create_record():
        data = request.get_json()
        name = data.get("name", "新建载荷试算")
        record = CalculationRecord(name=name, status="draft")
        db.session.add(record)
        db.session.commit()
        log_audit(record.id, "create", data.get("operator", "系统"), data.get("role", "system"),
                   note="创建试算记录")
        return jsonify(record.to_dict()), 201

    @app.route("/api/records/<int:record_id>", methods=["GET"])
    def api_get_record(record_id):
        record = CalculationRecord.query.get_or_404(record_id)
        params = [p.to_dict() for p in record.parameters]
        screenshots = [s.to_dict() for s in record.screenshots]
        audit = [a.to_dict() for a in get_record_audit_trail(record_id)]
        return jsonify({
            **record.to_dict(),
            "parameters": params,
            "screenshots": screenshots,
            "audit_trail": audit,
        })

    @app.route("/api/records/<int:record_id>/import_screenshot", methods=["POST"])
    def api_import_screenshot(record_id):
        record = CalculationRecord.query.get_or_404(record_id)
        data = request.get_json()
        screenshot = Screenshot(
            record_id=record_id,
            filename=data.get("filename", "imported.png"),
            description=data.get("description", ""),
            source_chat=data.get("source_chat", "维修群"),
            extracted_summary=data.get("extracted_summary", ""),
        )
        db.session.add(screenshot)
        db.session.commit()
        log_audit(record_id, "import_screenshot",
                   data.get("operator", "训练教练老唐"),
                   data.get("role", "training_coach"),
                   note="从{}导入截图：{}".format(screenshot.source_chat, screenshot.description))
        return jsonify(screenshot.to_dict()), 201

    @app.route("/api/records/<int:record_id>/override", methods=["POST"])
    def api_manual_override(record_id):
        record = CalculationRecord.query.get_or_404(record_id)
        data = request.get_json()
        param_name = data.get("param_name")
        new_value = data.get("value")
        reason = data.get("reason")
        operator = data.get("operator", "训练教练老唐")
        role = data.get("role", "training_coach")

        param = Parameter.query.filter_by(record_id=record_id, name=param_name).first()
        if not param:
            return jsonify({"error": "参数 {} 不存在".format(param_name)}), 404

        old_value = param.value
        param.original_value = old_value
        param.value = new_value
        param.is_manual_override = True
        param.override_by = operator
        if reason:
            param.override_reason = reason
        param.source = "manual_override"
        param.updated_at = datetime.now()
        db.session.commit()

        action = "manual_override" if not reason else "add_override_reason"
        log_audit(record_id, action, operator, role,
                   parameter_id=param.id,
                   old_value=str(old_value),
                   new_value=str(new_value),
                   reason=reason,
                   note="人工修正{}：{}→{}".format(param.display_name, old_value, new_value))

        if record.has_unresolved_flags():
            record.status = "needs_engineer_review"
            db.session.commit()

        _recalculate(record_id)
        return jsonify(param.to_dict())

    @app.route("/api/records/<int:record_id>/supplement_interval", methods=["POST"])
    def api_supplement_interval(record_id):
        record = CalculationRecord.query.get_or_404(record_id)
        data = request.get_json()
        param_name = data.get("param_name")
        interval_note = data.get("sampling_interval_note", "")
        operator = data.get("operator", "训练教练老唐")
        role = data.get("role", "training_coach")

        param = Parameter.query.filter_by(record_id=record_id, name=param_name).first()
        if not param:
            return jsonify({"error": "参数 {} 不存在".format(param_name)}), 404

        old_note = param.sampling_interval_note
        param.sampling_interval_note = interval_note
        param.updated_at = datetime.now()
        db.session.commit()

        log_audit(record_id, "supplement_interval", operator, role,
                   parameter_id=param.id,
                   old_value=old_note,
                   new_value=interval_note,
                   note="补录{}采样间隔说明：{}".format(param.display_name, interval_note))

        return jsonify(param.to_dict())

    @app.route("/api/records/<int:record_id>/add_reason", methods=["POST"])
    def api_add_override_reason(record_id):
        record = CalculationRecord.query.get_or_404(record_id)
        data = request.get_json()
        param_id = data.get("parameter_id")
        reason = data.get("reason")
        operator = data.get("operator", "设备工程师")
        role = data.get("role", "equipment_engineer")

        param = Parameter.query.get(param_id)
        if not param or param.record_id != record_id:
            return jsonify({"error": "参数不存在"}), 404

        param.override_reason = reason
        param.updated_at = datetime.now()
        db.session.commit()

        log_audit(record_id, "add_override_reason", operator, role,
                   parameter_id=param.id,
                   reason=reason,
                   note="补充修正原因：{}——{}".format(param.display_name, reason))

        if not record.has_unresolved_flags():
            record.status = "under_review"
            db.session.commit()

        return jsonify(param.to_dict())

    @app.route("/api/records/<int:record_id>/rerun", methods=["POST"])
    def api_rerun(record_id):
        record = CalculationRecord.query.get_or_404(record_id)
        data = request.get_json() or {}
        operator = data.get("operator", "训练教练老唐")
        role = data.get("role", "training_coach")

        _recalculate(record_id)

        log_audit(record_id, "rerun", operator, role,
                   note="重跑载荷试算，结论：{}".format(record.conclusion))

        return jsonify(record.to_dict())

    @app.route("/api/records/<int:record_id>/audit", methods=["GET"])
    def api_audit_trail(record_id):
        entries = get_record_audit_trail(record_id)
        return jsonify([e.to_dict() for e in entries])

    @app.route("/api/records/<int:record_id>/parameters", methods=["GET"])
    def api_list_parameters(record_id):
        params = Parameter.query.filter_by(record_id=record_id).all()
        return jsonify([p.to_dict() for p in params])

    @app.route("/api/parameters/<int:param_id>/audit", methods=["GET"])
    def api_parameter_audit(param_id):
        entries = get_parameter_audit_trail(param_id)
        return jsonify([e.to_dict() for e in entries])

    @app.route("/api/demo/load", methods=["POST"])
    def api_load_demo():
        from hydraulic_lift.demo import load_demo_data
        record = load_demo_data()
        return jsonify(record.to_dict())


def _recalculate(record_id):
    record = CalculationRecord.query.get(record_id)
    if not record:
        return

    params = Parameter.query.filter_by(record_id=record_id, category="input").all()
    params_dict = {p.name: p.value for p in params}

    results, conclusion, passed = HydraulicLiftEngine.calculate(params_dict)

    existing_outputs = {p.name: p for p in Parameter.query.filter_by(record_id=record_id, category="output").all()}

    for key, meta in results.items():
        if key in existing_outputs:
            p = existing_outputs[key]
            p.value = meta["value"]
            p.updated_at = datetime.now()
        else:
            p = Parameter(
                record_id=record_id,
                name=key,
                display_name=meta["display_name"],
                value=meta["value"],
                unit=meta["unit"],
                category="output",
                source="calculated",
            )
            db.session.add(p)

    record.conclusion = conclusion
    record.updated_at = datetime.now()
    db.session.commit()
