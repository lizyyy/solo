import pytest
from app.services import StateMachineService
from app.models.models import RuleStatus
from app.services.state_machine import StateTransitionError


class TestStateMachine:
    def setup_method(self):
        self.state_machine = StateMachineService()

    def test_valid_transitions(self):
        valid_transitions = [
            (RuleStatus.DRAFT, RuleStatus.PENDING_REVIEW),
            (RuleStatus.DRAFT, RuleStatus.DEPRECATED),
            (RuleStatus.PENDING_REVIEW, RuleStatus.PENDING_GRAY),
            (RuleStatus.PENDING_REVIEW, RuleStatus.REVIEW_REJECTED),
            (RuleStatus.REVIEW_REJECTED, RuleStatus.DRAFT),
            (RuleStatus.PENDING_GRAY, RuleStatus.IN_GRAY),
            (RuleStatus.IN_GRAY, RuleStatus.PRODUCTION),
            (RuleStatus.IN_GRAY, RuleStatus.ROLLED_BACK),
            (RuleStatus.PRODUCTION, RuleStatus.ROLLED_BACK),
            (RuleStatus.ROLLED_BACK, RuleStatus.DRAFT),
        ]
        
        for from_status, to_status in valid_transitions:
            assert self.state_machine.can_transition(from_status, to_status) is True

    def test_invalid_transitions(self):
        invalid_transitions = [
            (RuleStatus.DRAFT, RuleStatus.PRODUCTION),
            (RuleStatus.PENDING_REVIEW, RuleStatus.PRODUCTION),
            (RuleStatus.REVIEW_REJECTED, RuleStatus.IN_GRAY),
            (RuleStatus.DEPRECATED, RuleStatus.DRAFT),
            (RuleStatus.PRODUCTION, RuleStatus.DRAFT),
        ]
        
        for from_status, to_status in invalid_transitions:
            assert self.state_machine.can_transition(from_status, to_status) is False

    def test_same_status_transition_raises_error(self):
        with pytest.raises(StateTransitionError) as excinfo:
            self.state_machine.validate_transition(RuleStatus.DRAFT, RuleStatus.DRAFT)
        
        assert excinfo.value.error_code == "STATUS_ALREADY_SET"
        assert "已经处于" in excinfo.value.error_message

    def test_invalid_transition_raises_error_with_details(self):
        with pytest.raises(StateTransitionError) as excinfo:
            self.state_machine.validate_transition(RuleStatus.DRAFT, RuleStatus.PRODUCTION)
        
        assert excinfo.value.error_code == "INVALID_STATE_TRANSITION"
        assert excinfo.value.details is not None
        assert "草稿" in excinfo.value.error_message

    def test_get_allowed_transitions(self):
        allowed = self.state_machine.get_allowed_transitions(RuleStatus.DRAFT)
        assert len(allowed) == 2
        statuses = [t["status"] for t in allowed]
        assert RuleStatus.PENDING_REVIEW.value in statuses
        assert RuleStatus.DEPRECATED.value in statuses

    def test_terminal_state_no_transitions(self):
        allowed = self.state_machine.get_allowed_transitions(RuleStatus.DEPRECATED)
        assert len(allowed) == 0

    def test_get_transition_description(self):
        desc = self.state_machine.get_transition_description(
            RuleStatus.DRAFT, RuleStatus.PENDING_REVIEW
        )
        assert desc == "提交审核"

    def test_get_status_workflow(self):
        workflow = self.state_machine.get_status_workflow()
        assert "statuses" in workflow
        assert "transitions" in workflow
        assert len(workflow["statuses"]) == len(RuleStatus)
