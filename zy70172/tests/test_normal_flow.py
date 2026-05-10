import pytest

from data_retraction_service.models import (
    RetractionRequestStatus,
    FeatureCleanupStatus,
    ComplianceReportStatus
)
from data_retraction_service.services import (
    RetractionWorkflowService,
    RequestService
)
from data_retraction_service.validation import (
    ModelImpactService,
    ReceiptService,
    ComplianceReportService
)
from data_retraction_service.sample_data import get_test_scenarios


class TestNormalFlow:
    
    def test_scenario_1_normal_retraction_by_user_id(self, fresh_db):
        scenarios = get_test_scenarios()
        scenario = scenarios[0]
        
        db = fresh_db()
        try:
            workflow = RetractionWorkflowService(db)
            
            result = workflow.submit_and_process(
                requester_id=scenario["user_id"],
                retraction_reason=scenario["retraction_reason"],
                location_criteria=scenario["location_criteria"],
                auto_approve=True
            )
            
            assert result["status"].upper() == "APPROVED"
            assert result["located_records"] == 3
            
            request_id = result["request_id"]
            exec_result = workflow.execute_approved_request(request_id)
            
            assert exec_result["status"] == "COMPLETED"
            assert exec_result["features_cleaned"] == 5
            assert exec_result["models_impacted"] == 3
            assert exec_result["receipts_generated"] == 4
            assert exec_result["reports_generated"] == 1
            
            request_service = RequestService(db)
            final_request = request_service.get_request(request_id)
            assert final_request.status == RetractionRequestStatus.COMPLETED
            assert final_request.completed_at is not None
        finally:
            db.close()
    
    def test_scenario_6_normal_retraction_by_external_id(self, fresh_db):
        scenarios = get_test_scenarios()
        scenario = scenarios[5]
        
        db = fresh_db()
        try:
            workflow = RetractionWorkflowService(db)
            
            result = workflow.submit_and_process(
                requester_id=scenario["user_id"],
                retraction_reason=scenario["retraction_reason"],
                location_criteria=scenario["location_criteria"],
                auto_approve=False
            )
            
            assert result["status"].upper() == "PENDING"
            assert result["located_records"] == 1
            
            request_id = result["request_id"]
            request_service = RequestService(db)
            request_service.approve_request(request_id)
            
            exec_result = workflow.execute_approved_request(request_id)
            
            assert exec_result["status"] == "COMPLETED"
        finally:
            db.close()
    
    def test_receipts_generated_after_execution(self, fresh_db):
        scenarios = get_test_scenarios()
        scenario = scenarios[0]
        
        db = fresh_db()
        try:
            workflow = RetractionWorkflowService(db)
            result = workflow.submit_and_process(
                requester_id=scenario["user_id"],
                retraction_reason=scenario["retraction_reason"],
                location_criteria=scenario["location_criteria"],
                auto_approve=True
            )
            request_id = result["request_id"]
            workflow.execute_approved_request(request_id)
            
            receipt_service = ReceiptService(db)
            receipts = receipt_service.get_receipts_for_request(request_id)
            
            assert len(receipts) == 4
            
            receipt_types = {r.receipt_type for r in receipts}
            expected_types = {
                "request_submission",
                "data_location",
                "feature_cleanup",
                "completion"
            }
            assert receipt_types == expected_types
            
            for receipt in receipts:
                assert receipt.signature
                assert receipt.payload
                assert receipt_service.verify_receipt(receipt)
        finally:
            db.close()
    
    def test_model_impact_assessment(self, fresh_db):
        scenarios = get_test_scenarios()
        scenario = scenarios[0]
        
        db = fresh_db()
        try:
            workflow = RetractionWorkflowService(db)
            result = workflow.submit_and_process(
                requester_id=scenario["user_id"],
                retraction_reason=scenario["retraction_reason"],
                location_criteria=scenario["location_criteria"],
                auto_approve=True
            )
            request_id = result["request_id"]
            workflow.execute_approved_request(request_id)
            
            impact_service = ModelImpactService(db)
            impacts = impact_service.get_impacts_for_request(request_id)
            
            assert len(impacts) == 3
            
            severities = [i.severity for i in impacts]
            assert all(s in ["low", "medium", "high", "critical"] for s in severities)
            
            for impact in impacts:
                assert impact.affected_features_count > 0
        finally:
            db.close()
    
    def test_compliance_report(self, fresh_db):
        scenarios = get_test_scenarios()
        scenario = scenarios[0]
        
        db = fresh_db()
        try:
            workflow = RetractionWorkflowService(db)
            result = workflow.submit_and_process(
                requester_id=scenario["user_id"],
                retraction_reason=scenario["retraction_reason"],
                location_criteria=scenario["location_criteria"],
                auto_approve=True
            )
            request_id = result["request_id"]
            workflow.execute_approved_request(request_id)
            
            report_service = ComplianceReportService(db)
            reports = report_service.get_reports_for_request(request_id)
            
            assert len(reports) == 1
            report = reports[0]
            
            assert report.status == ComplianceReportStatus.FINALIZED
            assert "request_overview" in report.content
            assert "data_retraction_details" in report.content
            assert "feature_cleanup" in report.content
            assert "model_impact_assessment" in report.content
            assert "rule_evaluation_trail" in report.content
            assert "compliance_checks" in report.content
            
            checks = report.content["compliance_checks"]
            assert checks["data_tracked"] is True
            assert checks["features_tracked"] is True
            assert checks["models_assessed"] is True
            assert checks["receipts_generated"] is True
            assert checks["report_generated"] is True
            assert checks["audit_trail_complete"] is True
        finally:
            db.close()
    
    def test_data_record_marked_as_retracted(self, fresh_db):
        from data_retraction_service.models import DataRecord
        
        scenarios = get_test_scenarios()
        scenario = scenarios[5]
        
        db = fresh_db()
        try:
            workflow = RetractionWorkflowService(db)
            result = workflow.submit_and_process(
                requester_id=scenario["user_id"],
                retraction_reason=scenario["retraction_reason"],
                location_criteria=scenario["location_criteria"],
                auto_approve=True
            )
            request_id = result["request_id"]
            workflow.execute_approved_request(request_id)
            
            record = (
                db.query(DataRecord)
                .filter(DataRecord.external_id == "ext-lisi-a")
                .first()
            )
            
            assert record is not None
            assert record.is_retracted is True
            assert record.retracted_at is not None
        finally:
            db.close()
    
    def test_rule_evaluations_persisted(self, fresh_db):
        from data_retraction_service.models import RuleEvaluation
        
        scenarios = get_test_scenarios()
        scenario = scenarios[0]
        
        db = fresh_db()
        try:
            workflow = RetractionWorkflowService(db)
            result = workflow.submit_and_process(
                requester_id=scenario["user_id"],
                retraction_reason=scenario["retraction_reason"],
                location_criteria=scenario["location_criteria"],
                auto_approve=False
            )
            request_id = result["request_id"]
            
            evaluations = (
                db.query(RuleEvaluation)
                .filter(RuleEvaluation.request_id == request_id)
                .all()
            )
            
            assert len(evaluations) >= 4
            
            for eval_item in evaluations:
                assert eval_item.rule_id is not None
                assert eval_item.input_values is not None
                assert isinstance(eval_item.evaluation_result, bool)
        finally:
            db.close()
