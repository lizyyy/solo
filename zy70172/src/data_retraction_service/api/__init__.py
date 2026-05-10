from flask import Flask, request, jsonify
from sqlalchemy.orm import Session

from ..database import init_db, SessionLocal
from ..sample_data import init_sample_data, get_test_scenarios
from ..services import (
    RequestService,
    RetractionWorkflowService
)
from ..validation import (
    ModelImpactService,
    ReceiptService,
    ComplianceReportService
)
from ..models import RetractionRequestStatus


def create_app() -> Flask:
    app = Flask(__name__)
    
    init_db()
    init_sample_data()
    
    def get_db_session() -> Session:
        return SessionLocal()
    
    @app.route("/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "ok",
            "service": "training_data_retraction_service"
        })
    
    @app.route("/api/requests", methods=["POST"])
    def submit_request():
        data = request.get_json()
        
        required_fields = ["user_id", "retraction_reason", "location_criteria"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        db = get_db_session()
        try:
            workflow = RetractionWorkflowService(db)
            auto_approve = data.get("auto_approve", False)
            
            result = workflow.submit_and_process(
                requester_id=data["user_id"],
                retraction_reason=data["retraction_reason"],
                location_criteria=data["location_criteria"],
                auto_approve=auto_approve
            )
            
            return jsonify(result), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        finally:
            db.close()
    
    @app.route("/api/requests/<request_id>", methods=["GET"])
    def get_request(request_id: str):
        db = get_db_session()
        try:
            request_service = RequestService(db)
            req = request_service.get_request(request_id)
            
            if not req:
                return jsonify({"error": "Request not found"}), 404
            
            return jsonify({
                "request_id": req.id,
                "requester_id": req.requester_id,
                "status": req.status,
                "retraction_reason": req.retraction_reason,
                "created_at": req.created_at,
                "approved_at": req.approved_at,
                "completed_at": req.completed_at,
                "rejection_reason": req.rejection_reason,
                "ruleset_version": req.ruleset_version
            }), 200
        finally:
            db.close()
    
    @app.route("/api/requests/<request_id>/approve", methods=["POST"])
    def approve_request(request_id: str):
        data = request.get_json() or {}
        notes = data.get("notes", "")
        
        db = get_db_session()
        try:
            request_service = RequestService(db)
            req = request_service.approve_request(request_id, notes)
            
            return jsonify({
                "request_id": req.id,
                "status": req.status,
                "approved_at": req.approved_at
            }), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        finally:
            db.close()
    
    @app.route("/api/requests/<request_id>/execute", methods=["POST"])
    def execute_request(request_id: str):
        db = get_db_session()
        try:
            workflow = RetractionWorkflowService(db)
            result = workflow.execute_approved_request(request_id)
            
            return jsonify(result), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        finally:
            db.close()
    
    @app.route("/api/requests/<request_id>/impacts", methods=["GET"])
    def get_impacts(request_id: str):
        db = get_db_session()
        try:
            impact_service = ModelImpactService(db)
            impacts = impact_service.get_impacts_for_request(request_id)
            
            return jsonify([
                {
                    "model_id": i.model_id,
                    "severity": i.severity,
                    "affected_features": i.affected_features_count,
                    "retraining_required": i.retraining_required,
                    "description": i.impact_description
                }
                for i in impacts
            ]), 200
        finally:
            db.close()
    
    @app.route("/api/requests/<request_id>/receipts", methods=["GET"])
    def get_receipts(request_id: str):
        db = get_db_session()
        try:
            receipt_service = ReceiptService(db)
            receipts = receipt_service.get_receipts_for_request(request_id)
            
            return jsonify([
                {
                    "id": r.id,
                    "type": r.receipt_type,
                    "signature": r.signature,
                    "created_at": r.created_at,
                    "payload": r.payload
                }
                for r in receipts
            ]), 200
        finally:
            db.close()
    
    @app.route("/api/requests/<request_id>/reports", methods=["GET"])
    def get_reports(request_id: str):
        db = get_db_session()
        try:
            report_service = ComplianceReportService(db)
            reports = report_service.get_reports_for_request(request_id)
            
            if not reports:
                return jsonify([]), 200
            
            report = reports[0]
            return jsonify({
                "id": report.id,
                "type": report.report_type,
                "status": report.status,
                "generated_at": report.generated_at,
                "finalized_at": report.finalized_at,
                "content": report.content
            }), 200
        finally:
            db.close()
    
    @app.route("/api/test/scenarios", methods=["GET"])
    def list_scenarios():
        scenarios = get_test_scenarios()
        return jsonify([
            {
                "name": s["name"],
                "description": s["description"],
                "scenario_type": s["scenario_type"],
                "expected_status": s["expected_status"]
            }
            for s in scenarios
        ]), 200
    
    @app.route("/api/users/<user_id>/requests", methods=["GET"])
    def get_user_requests(user_id: str):
        db = get_db_session()
        try:
            request_service = RequestService(db)
            requests = request_service.get_user_requests(user_id)
            
            return jsonify([
                {
                    "request_id": r.id,
                    "status": r.status,
                    "created_at": r.created_at,
                    "completed_at": r.completed_at
                }
                for r in requests
            ]), 200
        finally:
            db.close()
    
    return app
