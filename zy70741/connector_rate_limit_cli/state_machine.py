from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from .parser import LogRecord


class SleepState(Enum):
    NORMAL = "normal"
    RATE_LIMITED = "rate_limited"
    SLEEPING = "sleeping"
    RECOVERING = "recovering"
    FAILED = "failed"


@dataclass
class StateTransition:
    from_state: SleepState
    to_state: SleepState
    trigger_record: LogRecord
    timestamp: datetime
    reason: str


@dataclass
class SleepSession:
    session_id: str
    connector: str
    supplier: str
    start_time: datetime
    end_time: Optional[datetime] = None
    state: SleepState = SleepState.NORMAL
    transitions: List[StateTransition] = field(default_factory=list)
    rate_limit_count: int = 0
    sleep_count: int = 0
    total_sleep_duration: float = 0
    retry_count: int = 0
    recovery_count: int = 0
    error_count: int = 0
    is_recovered: bool = False
    is_idempotent: bool = True
    records: List[LogRecord] = field(default_factory=list)

    def duration_seconds(self) -> Optional[float]:
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return None


class RateLimitRuleEngine:
    def __init__(
        self,
        rate_limit_window: int = 60,
        min_sleep_interval: int = 0,
        max_consecutive_sleep: int = 10,
    ):
        self.rate_limit_window = rate_limit_window
        self.min_sleep_interval = min_sleep_interval
        self.max_consecutive_sleep = max_consecutive_sleep

    def detect_rate_limit_windows(
        self, records: List[LogRecord]
    ) -> List[Tuple[datetime, datetime, int]]:
        rate_limit_records = [r for r in records if r.is_rate_limit and r.timestamp]
        if not rate_limit_records:
            return []

        rate_limit_records.sort(key=lambda r: r.timestamp)
        windows = []
        window_start = rate_limit_records[0].timestamp
        window_count = 1

        for record in rate_limit_records[1:]:
            if (record.timestamp - window_start).total_seconds() <= self.rate_limit_window:
                window_count += 1
            else:
                windows.append((
                    window_start,
                    window_start + timedelta(seconds=self.rate_limit_window),
                    window_count
                ))
                window_start = record.timestamp
                window_count = 1

        windows.append((
            window_start,
            window_start + timedelta(seconds=self.rate_limit_window),
            window_count
        ))
        return windows

    def check_sleep_idempotency(self, session: SleepSession) -> bool:
        recovery_events = [r for r in session.records if r.is_recovery and r.timestamp]
        if len(recovery_events) <= 1:
            return True

        recovery_timestamps = sorted([r.timestamp for r in recovery_events])
        for i in range(1, len(recovery_timestamps)):
            interval = (recovery_timestamps[i] - recovery_timestamps[i-1]).total_seconds()
            if interval < self.min_sleep_interval:
                return False

        rate_limit_after_recovery = 0
        for record in session.records:
            if record.is_recovery:
                rate_limit_after_recovery = 0
            elif record.is_rate_limit:
                rate_limit_after_recovery += 1
                if rate_limit_after_recovery > 3:
                    return False

        return True

    def validate_sleep_strategy(self, session: SleepSession) -> Dict[str, any]:
        issues = []
        consecutive_sleep = 0
        last_sleep_time = None

        for record in session.records:
            if record.is_sleep:
                consecutive_sleep += 1
                if last_sleep_time and record.timestamp:
                    interval = (record.timestamp - last_sleep_time).total_seconds()
                    if interval < self.min_sleep_interval:
                        issues.append({
                            'type': 'sleep_too_frequent',
                            'record': record,
                            'interval': interval,
                        })
                last_sleep_time = record.timestamp
            elif record.is_recovery or record.is_rate_limit:
                consecutive_sleep = 0

            if consecutive_sleep > self.max_consecutive_sleep:
                issues.append({
                    'type': 'too_many_consecutive_sleep',
                    'record': record,
                    'count': consecutive_sleep,
                })

        sleep_durations = [
            r.extra.get('sleep_duration', 0)
            for r in session.records
            if r.is_sleep and 'sleep_duration' in r.extra
        ]
        if sleep_durations:
            avg_sleep = sum(sleep_durations) / len(sleep_durations)
            if avg_sleep < 1:
                issues.append({
                    'type': 'sleep_duration_too_short',
                    'avg_duration': avg_sleep,
                })

        return {
            'has_issues': len(issues) > 0,
            'issues': issues,
        }


class SleepStateMachine:
    def __init__(self, rule_engine: RateLimitRuleEngine):
        self.rule_engine = rule_engine
        self.state = SleepState.NORMAL

    def transition(self, record: LogRecord) -> Optional[StateTransition]:
        from_state = self.state
        to_state = self.state
        reason = ""

        if record.is_rate_limit:
            if self.state in [SleepState.NORMAL, SleepState.RECOVERING]:
                to_state = SleepState.RATE_LIMITED
                reason = "rate_limit_detected"
            elif self.state == SleepState.SLEEPING:
                reason = "rate_limit_while_sleeping"

        elif record.is_sleep:
            if self.state in [SleepState.RATE_LIMITED, SleepState.NORMAL]:
                to_state = SleepState.SLEEPING
                reason = "enter_sleep"

        elif record.is_recovery:
            if self.state == SleepState.SLEEPING:
                to_state = SleepState.RECOVERING
                reason = "recovery_event"
            elif self.state == SleepState.RECOVERING:
                reason = "duplicate_recovery"

        elif record.is_error:
            if self.state in [SleepState.RATE_LIMITED, SleepState.SLEEPING]:
                to_state = SleepState.FAILED
                reason = "error_during_recovery"

        if from_state != to_state or reason:
            self.state = to_state
            return StateTransition(
                from_state=from_state,
                to_state=to_state,
                trigger_record=record,
                timestamp=record.timestamp or datetime.now(),
                reason=reason,
            )
        return None


class SessionManager:
    def __init__(self, rule_engine: RateLimitRuleEngine):
        self.rule_engine = rule_engine
        self.sessions: Dict[Tuple[str, str], List[SleepSession]] = defaultdict(list)
        self.active_session: Dict[Tuple[str, str], SleepSession] = {}

    def _get_key(self, record: LogRecord) -> Tuple[str, str]:
        return (record.connector or 'unknown', record.supplier or 'unknown')

    def process_record(self, record: LogRecord) -> Optional[SleepSession]:
        if record.is_bad_line:
            return None

        key = self._get_key(record)
        active = self.active_session.get(key)

        state_machine = SleepStateMachine(self.rule_engine)
        if active:
            state_machine.state = active.state

        transition = state_machine.transition(record)

        if transition or (record.is_rate_limit or record.is_sleep or record.is_recovery):
            if not active:
                active = SleepSession(
                    session_id=f"{record.connector or 'unknown'}_{record.supplier or 'unknown'}_{len(self.sessions[key])}",
                    connector=record.connector or 'unknown',
                    supplier=record.supplier or 'unknown',
                    start_time=record.timestamp or datetime.now(),
                )
                self.sessions[key].append(active)
                self.active_session[key] = active

            active.records.append(record)
            if transition:
                active.transitions.append(transition)
                active.state = transition.to_state

            if record.is_rate_limit:
                active.rate_limit_count += 1
            if record.is_sleep:
                active.sleep_count += 1
                active.total_sleep_duration += record.extra.get('sleep_duration', 0)
            if record.is_retry:
                active.retry_count += 1
            if record.is_recovery:
                active.recovery_count += 1
            if record.is_error:
                active.error_count += 1

            if record.is_recovery and active.state == SleepState.RECOVERING:
                active.is_recovered = True
                active.is_idempotent = self.rule_engine.check_sleep_idempotency(active)
                active.end_time = record.timestamp or datetime.now()
                del self.active_session[key]

        return active

    def finalize_sessions(self) -> List[SleepSession]:
        all_sessions = []
        for sessions in self.sessions.values():
            for session in sessions:
                if not session.end_time and session.records:
                    session.end_time = session.records[-1].timestamp or datetime.now()
                all_sessions.append(session)

        all_sessions.sort(key=lambda s: (s.connector, s.supplier, s.start_time))
        return all_sessions

    def process_records(self, records: List[LogRecord]) -> List[SleepSession]:
        sorted_records = sorted(
            [r for r in records if r.timestamp],
            key=lambda r: r.timestamp
        )
        unsorted_records = [r for r in records if not r.timestamp]

        for record in sorted_records + unsorted_records:
            self.process_record(record)

        return self.finalize_sessions()
