from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set


class TokenState(Enum):
    CREATED = "CREATED"
    BOUND = "BOUND"
    UNBOUND = "UNBOUND"
    UNSUBSCRIBED = "UNSUBSCRIBED"
    EXPIRED = "EXPIRED"
    INVALID = "INVALID"
    FAILED = "FAILED"


class FailureReason(Enum):
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    TOKEN_INVALID = "TOKEN_INVALID"
    DEVICE_REBOUND = "DEVICE_REBOUND"
    USER_UNSUBSCRIBED = "USER_UNSUBSCRIBED"
    TOKEN_UNBOUND = "TOKEN_UNBOUND"
    UNKNOWN = "UNKNOWN"


@dataclass
class StateEvent:
    event_type: str
    event_time: Optional[str]
    source: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TokenLifecycle:
    token: str
    current_state: TokenState
    state_history: List[StateEvent] = field(default_factory=list)
    user_id: Optional[str] = None
    device_id: Optional[str] = None
    create_time: Optional[str] = None
    last_update_time: Optional[str] = None
    bind_count: int = 0
    unbind_count: int = 0
    failure_count: int = 0
    is_unsubscribed: bool = False
    rebound_to: Optional[str] = None
    rebound_from: List[str] = field(default_factory=list)
    failure_reason: Optional[FailureReason] = None
    source_traces: List[str] = field(default_factory=list)

    def add_state_event(self, event: StateEvent) -> None:
        self.state_history.append(event)
        self.state_history.sort(key=lambda e: e.event_time or "")

    def add_source_trace(self, trace: str) -> None:
        if trace not in self.source_traces:
            self.source_traces.append(trace)


class TokenStateMachine:
    def __init__(self):
        self.tokens: Dict[str, TokenLifecycle] = {}
        self.user_device_map: Dict[str, Set[str]] = {}
        self.device_token_map: Dict[str, str] = {}
        self.unsubscribed_tokens: Set[str] = set()

    def _parse_time(self, time_str: Optional[str]) -> Optional[datetime]:
        if not time_str:
            return None
        try:
            return datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            try:
                return datetime.fromisoformat(time_str.replace("Z", "+00:00"))
            except ValueError:
                return None

    def _time_compare(self, t1: Optional[str], t2: Optional[str]) -> int:
        dt1 = self._parse_time(t1)
        dt2 = self._parse_time(t2)
        if dt1 is None and dt2 is None:
            return 0
        if dt1 is None:
            return -1
        if dt2 is None:
            return 1
        if dt1 < dt2:
            return -1
        elif dt1 > dt2:
            return 1
        return 0

    def get_or_create_token(self, token: str) -> TokenLifecycle:
        if token not in self.tokens:
            self.tokens[token] = TokenLifecycle(
                token=token,
                current_state=TokenState.CREATED,
            )
        return self.tokens[token]

    def process_token_creation(self, token: str, device_id: Optional[str],
                                user_id: Optional[str], create_time: Optional[str],
                                source_trace: str) -> None:
        lifecycle = self.get_or_create_token(token)
        lifecycle.device_id = device_id or lifecycle.device_id
        lifecycle.user_id = user_id or lifecycle.user_id

        if create_time and (not lifecycle.create_time or
                            self._time_compare(create_time, lifecycle.create_time) < 0):
            lifecycle.create_time = create_time

        lifecycle.add_state_event(StateEvent(
            event_type="TOKEN_CREATED",
            event_time=create_time,
            source=source_trace,
        ))
        lifecycle.add_source_trace(source_trace)

    def process_binding(self, token: str, device_id: Optional[str],
                        user_id: Optional[str], bind_time: Optional[str],
                        unbind_time: Optional[str], source_trace: str) -> None:
        lifecycle = self.get_or_create_token(token)
        lifecycle.device_id = device_id or lifecycle.device_id
        lifecycle.user_id = user_id or lifecycle.user_id
        lifecycle.bind_count += 1

        if device_id:
            if device_id in self.device_token_map and self.device_token_map[device_id] != token:
                old_token = self.device_token_map[device_id]
                old_lifecycle = self.get_or_create_token(old_token)
                old_lifecycle.rebound_to = token
                lifecycle.rebound_from.append(old_token)

            self.device_token_map[device_id] = token

        if user_id:
            if user_id not in self.user_device_map:
                self.user_device_map[user_id] = set()
            if device_id:
                self.user_device_map[user_id].add(device_id)

        lifecycle.current_state = TokenState.BOUND
        lifecycle.add_state_event(StateEvent(
            event_type="TOKEN_BOUND",
            event_time=bind_time,
            source=source_trace,
            details={"user_id": user_id, "device_id": device_id},
        ))
        lifecycle.add_source_trace(source_trace)

        if unbind_time:
            lifecycle.unbind_count += 1
            lifecycle.current_state = TokenState.UNBOUND
            lifecycle.add_state_event(StateEvent(
                event_type="TOKEN_UNBOUND",
                event_time=unbind_time,
                source=source_trace,
            ))

    def process_unsubscribe(self, token: str, user_id: Optional[str],
                            device_id: Optional[str], unsubscribe_time: Optional[str],
                            reason: Optional[str], source_trace: str) -> None:
        lifecycle = self.get_or_create_token(token)
        lifecycle.device_id = device_id or lifecycle.device_id
        lifecycle.user_id = user_id or lifecycle.user_id
        lifecycle.is_unsubscribed = True
        lifecycle.current_state = TokenState.UNSUBSCRIBED
        self.unsubscribed_tokens.add(token)

        lifecycle.add_state_event(StateEvent(
            event_type="USER_UNSUBSCRIBED",
            event_time=unsubscribe_time,
            source=source_trace,
            details={"reason": reason or ""},
        ))
        lifecycle.add_source_trace(source_trace)

    def process_failure(self, token: str, user_id: Optional[str],
                        device_id: Optional[str], fail_time: Optional[str],
                        error_code: Optional[str], error_message: Optional[str],
                        source_trace: str) -> None:
        lifecycle = self.get_or_create_token(token)
        lifecycle.device_id = device_id or lifecycle.device_id
        lifecycle.user_id = user_id or lifecycle.user_id
        lifecycle.failure_count += 1
        lifecycle.current_state = TokenState.FAILED

        lifecycle.add_state_event(StateEvent(
            event_type="PUSH_FAILED",
            event_time=fail_time,
            source=source_trace,
            details={"error_code": error_code or "", "error_message": error_message or ""},
        ))
        lifecycle.add_source_trace(source_trace)

    def determine_failure_reason(self, token: str) -> FailureReason:
        lifecycle = self.tokens.get(token)
        if not lifecycle:
            return FailureReason.UNKNOWN

        if lifecycle.is_unsubscribed:
            return FailureReason.USER_UNSUBSCRIBED

        if lifecycle.rebound_to:
            return FailureReason.DEVICE_REBOUND

        if lifecycle.current_state == TokenState.UNBOUND:
            return FailureReason.TOKEN_UNBOUND

        last_state = lifecycle.state_history[-1] if lifecycle.state_history else None
        if last_state:
            error_code = last_state.details.get("error_code", "").upper()
            error_msg = last_state.details.get("error_message", "").upper()

            if any(k in error_code or k in error_msg for k in ["EXPIRED", "过期"]):
                return FailureReason.TOKEN_EXPIRED
            if any(k in error_code or k in error_msg for k in ["INVALID", "无效", "NOT FOUND"]):
                return FailureReason.TOKEN_INVALID

        return FailureReason.UNKNOWN

    def finalize_all(self) -> None:
        for token in self.tokens:
            self.tokens[token].failure_reason = self.determine_failure_reason(token)

    def get_all_tokens_sorted(self) -> List[TokenLifecycle]:
        return sorted(self.tokens.values(), key=lambda t: (t.user_id or "", t.device_id or "", t.token))
