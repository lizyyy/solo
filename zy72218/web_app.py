import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for
from datetime import date

from models import (
    FundMatchRecord,
    HolidayExtension,
    TailAdjustment,
    MatchStatus,
    RecordType,
    entity_to_dict,
)
from repository import MatchRepository
from services import (
    MatchingEngine,
    ConflictDetector,
    SelfChecker,
    AuditService,
    WorkflowEngine,
    ExportService,
)


def create_app(data_dir: str = None):
    app = Flask(
        __name__,
        template_folder=os.path.join(os.path.dirname(__file__), "templates"),
        static_folder=os.path.join(os.path.dirname(__file__), "static"),
    )

    MatchRepository.reset_instances()
    repo = MatchRepository(data_dir=data_dir)
    matching_engine = MatchingEngine(repo)
    conflict_detector = ConflictDetector(repo)
    self_checker = SelfChecker(repo)
    audit_service = AuditService(repo)
    workflow_engine = WorkflowEngine(repo, matching_engine, conflict_detector, self_checker, audit_service)
    export_service = ExportService(output_dir=os.path.join(data_dir or ".", "exports"))

    @app.route("/")
    def index():
        records = repo.get_match_records_for_display()
        discrepancies = repo.get_all_discrepancies()
        conflicts = repo.get_all_conflict_evidences()
        return render_template("index.html", records=records, discrepancies=discrepancies, conflicts=conflicts)

    @app.route("/records")
    def records_page():
        records = repo.get_match_records_for_display()
        return render_template("records.html", records=records)

    @app.route("/discrepancies")
    def discrepancies_page():
        discrepancies = repo.get_all_discrepancies()
        return render_template("discrepancies.html", discrepancies=discrepancies)

    @app.route("/audit/<business_no>")
    def audit_page(business_no):
        impact = audit_service.get_impact_analysis(business_no)
        return render_template("audit.html", impact=impact, business_no=business_no)

    @app.route("/conflict/<business_no>")
    def conflict_page(business_no):
        decision = conflict_detector.present_conflict_for_decision(business_no)
        if not decision:
            return redirect(url_for("records_page"))
        return render_template("conflict.html", decision=decision)

    @app.route("/workflow/<business_no>")
    def workflow_page(business_no):
        state = workflow_engine.get_workflow_state(business_no)
        records = repo.get_records_by_business_no(business_no)
        return render_template("workflow.html", state=state, records=records, business_no=business_no)

    @app.route("/api/records", methods=["GET"])
    def api_get_records():
        return jsonify(repo.get_match_records_for_api())

    @app.route("/api/records/<business_no>", methods=["GET"])
    def api_get_records_by_business(business_no):
        records = repo.get_records_by_business_no(business_no)
        return jsonify([entity_to_dict(r) for r in records])

    @app.route("/api/invoices", methods=["POST"])
    def api_add_invoice():
        data = request.get_json()
        from models import Invoice
        invoice = Invoice(
            invoice_id=data.get("invoice_id", ""),
            invoice_no=data["invoice_no"],
            invoice_date=date.fromisoformat(data["invoice_date"]),
            amount=float(data["amount"]),
            tax_amount=float(data.get("tax_amount", 0)),
            total_amount=float(data["total_amount"]),
            seller=data["seller"],
            buyer=data["buyer"],
            business_no=data.get("business_no"),
            imported_by=data.get("operator", "api"),
        )
        repo.add_invoice(invoice)
        return jsonify({"status": "ok", "invoice_id": invoice.invoice_id})

    @app.route("/api/match-records", methods=["POST"])
    def api_create_match_records():
        data = request.get_json()
        business_no = data["business_no"]
        invoices = repo.get_all_invoices()
        biz_invoices = [i for i in invoices if i.business_no == business_no]
        if not biz_invoices:
            record = FundMatchRecord(
                business_no=business_no,
                record_type=RecordType.COMBINED,
                expected_amount=float(data.get("expected_amount", 0)),
                matched_amount=float(data.get("matched_amount", 0)),
                status=MatchStatus.PENDING,
                updated_by=data.get("operator", "api"),
            )
            repo.add_match_record(record)
            return jsonify({"status": "ok", "record_id": record.record_id})
        records = matching_engine.create_match_records_from_invoices(biz_invoices, data.get("operator", "api"))
        return jsonify({"status": "ok", "record_count": len(records)})

    @app.route("/api/holiday-extension", methods=["POST"])
    def api_import_holiday():
        data = request.get_json()
        business_no = data["business_no"]
        extension = HolidayExtension(
            business_no=business_no,
            extension_days=int(data["extension_days"]),
            original_due_date=date.fromisoformat(data["original_due_date"]) if data.get("original_due_date") else None,
            extended_due_date=date.fromisoformat(data["extended_due_date"]) if data.get("extended_due_date") else None,
            reason=data.get("reason", ""),
            conclusion=data.get("conclusion", ""),
            imported_by=data.get("operator", "api"),
            import_batch=data.get("import_batch"),
        )
        result = workflow_engine.step_1_import_holiday_extension(business_no, extension, data.get("operator", "投研助理小周"))
        return jsonify(result)

    @app.route("/api/tail-adjustment", methods=["POST"])
    def api_review_tail():
        data = request.get_json()
        business_no = data["business_no"]
        adjustment = TailAdjustment(
            business_no=business_no,
            adjustment_amount=float(data["adjustment_amount"]),
            adjustment_date=date.fromisoformat(data["adjustment_date"]) if data.get("adjustment_date") else None,
            reason=data.get("reason", ""),
            calculation_rule=data.get("calculation_rule", ""),
            imported_by=data.get("operator", "api"),
            import_batch=data.get("import_batch"),
        )
        result = workflow_engine.step_2_review_tail_adjustment(business_no, adjustment, data.get("operator", "投研助理小周"))
        return jsonify(result)

    @app.route("/api/resolve-conflict", methods=["POST"])
    def api_resolve_conflict():
        data = request.get_json()
        result = workflow_engine.resolve_conflict(
            business_no=data["business_no"],
            action=data["action"],
            operator=data.get("operator", "投研助理小周"),
            reason=data.get("reason", ""),
        )
        return jsonify(result)

    @app.route("/api/update-discrepancies", methods=["POST"])
    def api_update_discrepancies():
        data = request.get_json()
        result = workflow_engine.step_3_update_discrepancy_list(
            business_no=data["business_no"],
            operator=data.get("operator", "投研助理小周"),
        )
        return jsonify(result)

    @app.route("/api/supervisor-review", methods=["POST"])
    def api_supervisor_review():
        data = request.get_json()
        result = workflow_engine.supervisor_review_split_records(
            business_no=data["business_no"],
            operator=data.get("operator", "结算主管"),
            confirm=data.get("confirm", True),
            notes=data.get("notes", ""),
        )
        return jsonify(result)

    @app.route("/api/self-check", methods=["POST"])
    def api_self_check():
        results = self_checker.run_all_checks()
        return jsonify([{"type": r.check_type.value, "passed": r.passed, "message": r.message, "business_no": r.business_no} for r in results])

    @app.route("/api/export/excel")
    def api_export_excel():
        records = repo.get_match_records_for_export()
        formatted = export_service.format_records_for_export(records)
        filepath = export_service.export_excel(formatted, "invoice_pool_match.xlsx")
        return send_file(filepath, as_attachment=True, download_name="发票池融资匹配.xlsx")

    @app.route("/api/export/csv")
    def api_export_csv():
        records = repo.get_match_records_for_export()
        formatted = export_service.format_records_for_export(records)
        filepath = export_service.export_csv(formatted, "invoice_pool_match.csv")
        return send_file(filepath, as_attachment=True, download_name="发票池融资匹配.csv")

    @app.route("/api/export/audit/<business_no>/excel")
    def api_export_audit_excel(business_no):
        logs = audit_service.get_change_history(business_no)
        filepath = export_service.export_audit_trail(logs, f"audit_{business_no}.xlsx")
        return send_file(filepath, as_attachment=True, download_name=f"审计日志_{business_no}.xlsx")

    return app


if __name__ == "__main__":
    data_dir = os.environ.get("DATA_DIR", "./data")
    app = create_app(data_dir=data_dir)
    app.run(host="0.0.0.0", port=5000, debug=True)
