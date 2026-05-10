import pytest

from data_retraction_service.models import RetractionRequestStatus
from data_retraction_service.services import RetractionWorkflowService
from data_retraction_service.sample_data import get_test_scenarios


class TestErrorValidationCases:
    
    def test_scenario_2_reason_too_short(self, fresh_db):
        scenarios = get_test_scenarios()
        scenario = scenarios[1]
        
        db = fresh_db()
        try:
            workflow = RetractionWorkflowService(db)
            
            result = workflow.submit_and_process(
                requester_id=scenario["user_id"],
                retraction_reason=scenario["retraction_reason"],
                location_criteria=scenario["location_criteria"],
                auto_approve=False
            )
            
            assert result["status"].upper() == "REJECTED"
            assert "rejection_reason" in result
            assert "reason_is_provided" in result["rejection_reason"]
        finally:
            db.close()
    
    def test_scenario_3_invalid_scope(self, fresh_db):
        scenarios = get_test_scenarios()
        scenario = scenarios[2]
        
        db = fresh_db()
        try:
            workflow = RetractionWorkflowService(db)
            
            result = workflow.submit_and_process(
                requester_id=scenario["user_id"],
                retraction_reason=scenario["retraction_reason"],
                location_criteria=scenario["location_criteria"],
                auto_approve=False
            )
            
            assert result["status"].upper() == "REJECTED"
            assert "valid_retraction_scope" in result["rejection_reason"]
        finally:
            db.close()
    
    def test_scenario_4_no_data_found(self, fresh_db):
        scenarios = get_test_scenarios()
        scenario = scenarios[3]
        
        db = fresh_db()
        try:
            workflow = RetractionWorkflowService(db)
            
            result = workflow.submit_and_process(
                requester_id=scenario["user_id"],
                retraction_reason=scenario["retraction_reason"],
                location_criteria=scenario["location_criteria"],
                auto_approve=False
            )
            
            assert result["status"].upper() == "REJECTED"
            assert "at_least_one_record_found" in result["rejection_reason"]
        finally:
            db.close()
    
    def test_scenario_5_already_retracted(self, fresh_db):
        scenarios = get_test_scenarios()
        scenario = scenarios[4]
        
        db = fresh_db()
        try:
            workflow = RetractionWorkflowService(db)
            
            result = workflow.submit_and_process(
                requester_id=scenario["user_id"],
                retraction_reason=scenario["retraction_reason"],
                location_criteria=scenario["location_criteria"],
                auto_approve=False
            )
            
            assert result["status"].upper() == "REJECTED"
        finally:
            db.close()
    
    def test_cannot_execute_unapproved_request(self, fresh_db):
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
            
            with pytest.raises(ValueError) as exc_info:
                workflow.execute_approved_request(request_id)
            
            assert "APPROVED" in str(exc_info.value)
        finally:
            db.close()
    
    def test_cannot_double_approve(self, fresh_db):
        from data_retraction_service.services import RequestService
        
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
            
            request_service = RequestService(db)
            request_service.approve_request(request_id)
            
            with pytest.raises(ValueError) as exc_info:
                request_service.approve_request(request_id)
            
            assert "PENDING" in str(exc_info.value)
        finally:
            db.close()
    
    def test_rule_evaluation_history_stored(self, fresh_db):
        from data_retraction_service.models import RuleEvaluation
        
        scenarios = get_test_scenarios()
        scenario = scenarios[1]
        
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
            
            passed_rules = [e for e in evaluations if e.evaluation_result]
            failed_rules = [e for e in evaluations if not e.evaluation_result]
            
            assert len(failed_rules) >= 1
            
            for eval_item in evaluations:
                assert "retraction_reason" in eval_item.input_values
                assert "scope" in eval_item.input_values
        finally:
            db.close()
