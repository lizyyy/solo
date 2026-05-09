from typing import Dict, List, Set, Any
from datetime import datetime

from ..models import EventStatus, RegistrationStatus, UserRole
from ..exceptions import StateTransitionError

class StateTransition:
    def __init__(self, from_state: Any, to_state: Any, allowed_roles: List[UserRole] = None, condition=None):
        self.from_state = from_state
        self.to_state = to_state
        self.allowed_roles = allowed_roles or [UserRole.ADMIN]
        self.condition = condition

    def is_allowed(self, user_role: UserRole, context: Dict = None) -> bool:
        if user_role not in self.allowed_roles:
            return False
        if self.condition and not self.condition(context):
            return False
        return True

class StateMachine:
    def __init__(self, transitions: List[StateTransition]):
        self.transitions = transitions

    def can_transition(self, from_state: Any, to_state: Any, user_role: UserRole, context: Dict = None) -> bool:
        for transition in self.transitions:
            if transition.from_state == from_state and transition.to_state == to_state:
                return transition.is_allowed(user_role, context)
        return False

    def get_valid_transitions(self, from_state: Any, user_role: UserRole, context: Dict = None) -> List[Any]:
        valid = []
        for transition in self.transitions:
            if transition.from_state == from_state and transition.is_allowed(user_role, context):
                valid.append(transition.to_state)
        return valid

def _event_is_before_start(context):
    start_time = context.get('start_time') if context else None
    if start_time:
        return datetime.utcnow() < start_time
    return True

def _event_is_after_start(context):
    start_time = context.get('start_time') if context else None
    if start_time:
        return datetime.utcnow() >= start_time
    return False

event_state_machine = StateMachine([
    StateTransition(EventStatus.DRAFT, EventStatus.PUBLISHED, [UserRole.ADMIN, UserRole.ORGANIZER], _event_is_before_start),
    StateTransition(EventStatus.PUBLISHED, EventStatus.DRAFT, [UserRole.ADMIN], _event_is_before_start),
    StateTransition(EventStatus.PUBLISHED, EventStatus.ONGOING, [UserRole.ADMIN, UserRole.ORGANIZER], _event_is_after_start),
    StateTransition(EventStatus.ONGOING, EventStatus.COMPLETED, [UserRole.ADMIN, UserRole.ORGANIZER]),
    StateTransition(EventStatus.PUBLISHED, EventStatus.CANCELLED, [UserRole.ADMIN, UserRole.ORGANIZER]),
    StateTransition(EventStatus.ONGOING, EventStatus.CANCELLED, [UserRole.ADMIN]),
])

registration_state_machine = StateMachine([
    StateTransition(RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED, [UserRole.ADMIN, UserRole.ORGANIZER, UserRole.VOLUNTEER]),
    StateTransition(RegistrationStatus.PENDING, RegistrationStatus.CANCELLED, [UserRole.ADMIN, UserRole.ORGANIZER, UserRole.VOLUNTEER]),
    StateTransition(RegistrationStatus.CONFIRMED, RegistrationStatus.CANCELLED, [UserRole.ADMIN, UserRole.ORGANIZER, UserRole.VOLUNTEER]),
    StateTransition(RegistrationStatus.CONFIRMED, RegistrationStatus.COMPLETED, [UserRole.ADMIN, UserRole.ORGANIZER]),
    StateTransition(RegistrationStatus.CONFIRMED, RegistrationStatus.NO_SHOW, [UserRole.ADMIN, UserRole.ORGANIZER]),
    StateTransition(RegistrationStatus.CANCELLED, RegistrationStatus.PENDING, [UserRole.ADMIN, UserRole.ORGANIZER]),
])

def validate_event_transition(from_status: EventStatus, to_status: EventStatus, user_role: UserRole, context: Dict = None):
    if not event_state_machine.can_transition(from_status, to_status, user_role, context):
        valid = event_state_machine.get_valid_transitions(from_status, user_role, context)
        valid_str = ', '.join([s.value for s in valid]) if valid else '无'
        raise StateTransitionError(
            f'无法从 {from_status.value} 转换到 {to_status.value}。'
            f'当前角色 {user_role.value} 允许的转换: {valid_str}'
        )

def validate_registration_transition(from_status: RegistrationStatus, to_status: RegistrationStatus, user_role: UserRole):
    if not registration_state_machine.can_transition(from_status, to_status, user_role):
        valid = registration_state_machine.get_valid_transitions(from_status, user_role)
        valid_str = ', '.join([s.value for s in valid]) if valid else '无'
        raise StateTransitionError(
            f'无法从 {from_status.value} 转换到 {to_status.value}。'
            f'当前角色 {user_role.value} 允许的转换: {valid_str}'
        )
