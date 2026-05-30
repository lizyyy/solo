from app.models import AuthStatus


VALID_TRANSITIONS: dict[AuthStatus, set[AuthStatus]] = {
    AuthStatus.PENDING: {AuthStatus.CONFIRMED, AuthStatus.RETURNED},
    AuthStatus.RETURNED: {AuthStatus.PENDING},
    AuthStatus.CONFIRMED: {AuthStatus.RETURNED},
}


def is_valid_transition(from_status: AuthStatus, to_status: AuthStatus) -> bool:
    allowed = VALID_TRANSITIONS.get(from_status, set())
    return to_status in allowed


def get_allowed_transitions(current_status: AuthStatus) -> set[AuthStatus]:
    return VALID_TRANSITIONS.get(current_status, set())
