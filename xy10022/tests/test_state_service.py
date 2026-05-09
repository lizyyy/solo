import pytest
from datetime import datetime, timedelta

from event_manager.services.state_service import (
    StateMachine, StateTransition, validate_event_transition, 
    validate_registration_transition, event_state_machine, registration_state_machine
)
from event_manager.models import EventStatus, RegistrationStatus, UserRole
from event_manager.exceptions import StateTransitionError


class TestStateMachine:
    
    def test_can_transition(self):
        machine = StateMachine([
            StateTransition('A', 'B', ['admin']),
            StateTransition('A', 'C', ['admin', 'user']),
            StateTransition('B', 'C', ['user']),
        ])
        
        assert machine.can_transition('A', 'B', 'admin') == True
        assert machine.can_transition('A', 'B', 'user') == False
        assert machine.can_transition('A', 'C', 'admin') == True
        assert machine.can_transition('A', 'C', 'user') == True
        assert machine.can_transition('B', 'C', 'user') == True
        assert machine.can_transition('A', 'D', 'admin') == False

    def test_get_valid_transitions(self):
        machine = StateMachine([
            StateTransition('A', 'B', ['admin']),
            StateTransition('A', 'C', ['admin', 'user']),
            StateTransition('A', 'D', ['superuser']),
        ])
        
        transitions = machine.get_valid_transitions('A', 'admin')
        assert set(transitions) == {'B', 'C'}
        
        transitions = machine.get_valid_transitions('A', 'user')
        assert transitions == ['C']
        
        transitions = machine.get_valid_transitions('X', 'admin')
        assert transitions == []

    def test_transition_with_condition(self):
        def is_allowed(context):
            return context.get('value', 0) > 10
        
        machine = StateMachine([
            StateTransition('A', 'B', ['admin'], condition=is_allowed),
        ])
        
        assert machine.can_transition('A', 'B', 'admin', {'value': 20}) == True
        assert machine.can_transition('A', 'B', 'admin', {'value': 5}) == False
        assert machine.can_transition('A', 'B', 'user', {'value': 20}) == False


class TestEventStateTransitions:
    
    def test_draft_to_published(self):
        context = {'start_time': datetime.now() + timedelta(days=7)}
        
        assert event_state_machine.can_transition(
            EventStatus.DRAFT, EventStatus.PUBLISHED, UserRole.ORGANIZER, context
        ) == True
        assert event_state_machine.can_transition(
            EventStatus.DRAFT, EventStatus.PUBLISHED, UserRole.VOLUNTEER, context
        ) == False

    def test_published_to_draft_requires_admin(self):
        context = {'start_time': datetime.now() + timedelta(days=7)}
        
        assert event_state_machine.can_transition(
            EventStatus.PUBLISHED, EventStatus.DRAFT, UserRole.ADMIN, context
        ) == True
        assert event_state_machine.can_transition(
            EventStatus.PUBLISHED, EventStatus.DRAFT, UserRole.ORGANIZER, context
        ) == False

    def test_published_to_ongoing_after_start(self):
        context_before = {'start_time': datetime.now() + timedelta(days=7)}
        context_after = {'start_time': datetime.utcnow() - timedelta(hours=1)}
        
        assert event_state_machine.can_transition(
            EventStatus.PUBLISHED, EventStatus.ONGOING, UserRole.ORGANIZER, context_before
        ) == False
        
        assert event_state_machine.can_transition(
            EventStatus.PUBLISHED, EventStatus.ONGOING, UserRole.ORGANIZER, context_after
        ) == True

    def test_validate_event_transition_success(self):
        context = {'start_time': datetime.now() + timedelta(days=7)}
        
        validate_event_transition(
            EventStatus.DRAFT, 
            EventStatus.PUBLISHED, 
            UserRole.ORGANIZER,
            context
        )

    def test_validate_event_transition_failure(self):
        context = {'start_time': datetime.now() + timedelta(days=7)}
        
        with pytest.raises(StateTransitionError):
            validate_event_transition(
                EventStatus.COMPLETED, 
                EventStatus.PUBLISHED, 
                UserRole.ADMIN,
                context
            )


class TestRegistrationStateTransitions:
    
    def test_pending_to_confirmed(self):
        for role in [UserRole.ADMIN, UserRole.ORGANIZER, UserRole.VOLUNTEER]:
            assert registration_state_machine.can_transition(
                RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED, role
            ) == True

    def test_confirmed_to_cancelled(self):
        for role in [UserRole.ADMIN, UserRole.ORGANIZER, UserRole.VOLUNTEER]:
            assert registration_state_machine.can_transition(
                RegistrationStatus.CONFIRMED, RegistrationStatus.CANCELLED, role
            ) == True

    def test_completed_to_no_show_invalid(self):
        for role in [UserRole.ADMIN, UserRole.ORGANIZER]:
            assert registration_state_machine.can_transition(
                RegistrationStatus.COMPLETED, RegistrationStatus.NO_SHOW, role
            ) == False

    def test_validate_registration_transition_success(self):
        validate_registration_transition(
            RegistrationStatus.PENDING,
            RegistrationStatus.CONFIRMED,
            UserRole.VOLUNTEER
        )

    def test_validate_registration_transition_failure(self):
        with pytest.raises(StateTransitionError):
            validate_registration_transition(
                RegistrationStatus.COMPLETED,
                RegistrationStatus.PENDING,
                UserRole.ADMIN
            )
