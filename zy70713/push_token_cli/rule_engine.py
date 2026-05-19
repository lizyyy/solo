from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .parser import InputParser, InputType, ParseError, ParseResult, ParsedRecord
from .state_machine import FailureReason, TokenState, TokenStateMachine


@dataclass
class AnalysisResult:
    total_tokens: int = 0
    bound_tokens: int = 0
    unbound_tokens: int = 0
    unsubscribed_tokens: int = 0
    failed_tokens: int = 0
    rebound_devices: int = 0
    token_expired: int = 0
    token_invalid: int = 0
    token_unbound: int = 0
    user_unsubscribed: int = 0
    device_rebound: int = 0
    parse_errors: List[ParseError] = field(default_factory=list)
    token_details: List[Dict] = field(default_factory=list)


class RuleEngine:
    def __init__(self):
        self.parser = InputParser()
        self.state_machine = TokenStateMachine()
        self.all_results: Dict[InputType, ParseResult] = {}

    def _make_source_trace(self, record: ParsedRecord) -> str:
        if record.sheet_name:
            return f"{record.source_file}:{record.sheet_name}:{record.row_number}"
        return f"{record.source_file}:{record.row_number}"

    def load_tokens(self, file_path: str) -> ParseResult:
        result = self.parser.parse_file(file_path, InputType.TOKEN)
        self.all_results[InputType.TOKEN] = result

        for record in result.records:
            data = record.data
            self.state_machine.process_token_creation(
                token=data.get("token", ""),
                device_id=data.get("device_id"),
                user_id=data.get("user_id"),
                create_time=data.get("create_time"),
                source_trace=self._make_source_trace(record),
            )

        return result

    def load_bindings(self, file_path: str) -> ParseResult:
        result = self.parser.parse_file(file_path, InputType.BINDING)
        self.all_results[InputType.BINDING] = result

        for record in result.records:
            data = record.data
            self.state_machine.process_binding(
                token=data.get("token", ""),
                device_id=data.get("device_id"),
                user_id=data.get("user_id"),
                bind_time=data.get("bind_time"),
                unbind_time=data.get("unbind_time"),
                source_trace=self._make_source_trace(record),
            )

        return result

    def load_unsubscribes(self, file_path: str) -> ParseResult:
        result = self.parser.parse_file(file_path, InputType.UNSUBSCRIBE)
        self.all_results[InputType.UNSUBSCRIBE] = result

        for record in result.records:
            data = record.data
            self.state_machine.process_unsubscribe(
                token=data.get("token", ""),
                user_id=data.get("user_id"),
                device_id=data.get("device_id"),
                unsubscribe_time=data.get("unsubscribe_time"),
                reason=data.get("reason"),
                source_trace=self._make_source_trace(record),
            )

        return result

    def load_failures(self, file_path: str) -> ParseResult:
        result = self.parser.parse_file(file_path, InputType.FAILURE)
        self.all_results[InputType.FAILURE] = result

        for record in result.records:
            data = record.data
            self.state_machine.process_failure(
                token=data.get("token", ""),
                user_id=data.get("user_id"),
                device_id=data.get("device_id"),
                fail_time=data.get("fail_time"),
                error_code=data.get("error_code"),
                error_message=data.get("error_message"),
                source_trace=self._make_source_trace(record),
            )

        return result

    def analyze(self) -> AnalysisResult:
        self.state_machine.finalize_all()

        result = AnalysisResult()

        for input_type, parse_result in self.all_results.items():
            result.parse_errors.extend(parse_result.errors)

        tokens = self.state_machine.get_all_tokens_sorted()
        result.total_tokens = len(tokens)

        for lifecycle in tokens:
            if lifecycle.is_unsubscribed:
                result.unsubscribed_tokens += 1
            elif lifecycle.current_state == TokenState.UNBOUND:
                result.unbound_tokens += 1
            elif lifecycle.current_state == TokenState.BOUND:
                result.bound_tokens += 1

            if lifecycle.has_push_failure:
                result.failed_tokens += 1

            if lifecycle.rebound_to or lifecycle.rebound_from:
                result.rebound_devices += 1

            if lifecycle.failure_reason == FailureReason.TOKEN_EXPIRED:
                result.token_expired += 1
            elif lifecycle.failure_reason == FailureReason.TOKEN_INVALID:
                result.token_invalid += 1
            elif lifecycle.failure_reason == FailureReason.TOKEN_UNBOUND:
                result.token_unbound += 1
            elif lifecycle.failure_reason == FailureReason.USER_UNSUBSCRIBED:
                result.user_unsubscribed += 1
            elif lifecycle.failure_reason == FailureReason.DEVICE_REBOUND:
                result.device_rebound += 1

            state_history = []
            for event in lifecycle.state_history:
                state_history.append({
                    "event": event.event_type,
                    "time": event.event_time or "",
                    "source": event.source,
                    "details": event.details,
                })

            result.token_details.append({
                "token": lifecycle.token,
                "user_id": lifecycle.user_id or "",
                "device_id": lifecycle.device_id or "",
                "current_state": lifecycle.current_state.value,
                "failure_reason": lifecycle.failure_reason.value if lifecycle.failure_reason else "",
                "create_time": lifecycle.create_time or "",
                "bind_count": lifecycle.bind_count,
                "unbind_count": lifecycle.unbind_count,
                "failure_count": lifecycle.failure_count,
                "is_unsubscribed": lifecycle.is_unsubscribed,
                "rebound_to": lifecycle.rebound_to or "",
                "rebound_from": lifecycle.rebound_from,
                "state_history": state_history,
                "source_traces": lifecycle.source_traces,
            })

        result.parse_errors.sort(key=lambda e: (e.source_file, e.row_number, e.sheet_name or ""))

        return result
