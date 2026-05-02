from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Optional, Dict, Any, Callable

from .log_parser import LogEntry, UpgradeEventType
from .models import StateTransition, UpgradeAttempt, UpgradeDirection


class UpgradeState(Enum):
    IDLE = "IDLE"
    HANDSHAKING = "HANDSHAKING"
    VERSION_CHECK = "VERSION_CHECK"
    TRANSFERRING = "TRANSFERRING"
    CRC_CHECKING = "CRC_CHECKING"
    FLASHING = "FLASHING"
    REBOOTING = "REBOOTING"
    ROLLBACK = "ROLLBACK"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"
    INTERRUPTED = "INTERRUPTED"


class UpgradeEvent(Enum):
    HANDSHAKE_START = "HANDSHAKE_START"
    HANDSHAKE_SUCCESS = "HANDSHAKE_SUCCESS"
    HANDSHAKE_TIMEOUT = "HANDSHAKE_TIMEOUT"
    VERSION_DETECTED = "VERSION_DETECTED"
    TRANSFER_START = "TRANSFER_START"
    TRANSFER_PROGRESS = "TRANSFER_PROGRESS"
    TRANSFER_COMPLETE = "TRANSFER_COMPLETE"
    CRC_CHECK_START = "CRC_CHECK_START"
    CRC_PASS = "CRC_PASS"
    CRC_FAIL = "CRC_FAIL"
    FLASH_START = "FLASH_START"
    FLASH_PROGRESS = "FLASH_PROGRESS"
    FLASH_COMPLETE = "FLASH_COMPLETE"
    REBOOT_START = "REBOOT_START"
    REBOOT_COMPLETE = "REBOOT_COMPLETE"
    ROLLBACK_START = "ROLLBACK_START"
    ROLLBACK_COMPLETE = "ROLLBACK_COMPLETE"
    TIMEOUT = "TIMEOUT"
    RETRY = "RETRY"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    INTERRUPT = "INTERRUPT"


@dataclass
class StateContext:
    current_state: UpgradeState = UpgradeState.IDLE
    previous_state: Optional[UpgradeState] = None
    start_time: Optional[datetime] = None
    last_event_time: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3
    handshake_timeout_seconds: int = 30
    transfer_timeout_seconds: int = 300
    crc_verified: bool = False
    source_version: str = ""
    target_version: str = ""
    last_progress: int = 0
    detected_crc: str = ""
    expected_crc: str = ""
    log_entries: List[LogEntry] = field(default_factory=list)
    transitions: List[StateTransition] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_transition(self, transition: StateTransition):
        self.transitions.append(transition)
    
    def get_state_duration(self, state: UpgradeState) -> Optional[float]:
        enter_time = None
        exit_time = None
        
        for i, t in enumerate(self.transitions):
            if t.to_state == state.value and enter_time is None:
                enter_time = t.timestamp
            if t.from_state == state.value and i > 0:
                exit_time = t.timestamp
                break
        
        if enter_time and exit_time:
            return (exit_time - enter_time).total_seconds()
        return None
    
    def get_time_in_current_state(self) -> Optional[float]:
        if not self.transitions or not self.last_event_time:
            return None
        last_transition = self.transitions[-1]
        if last_transition.timestamp and self.last_event_time:
            return (self.last_event_time - last_transition.timestamp).total_seconds()
        return None


class UpgradeStateMachine:
    def __init__(self):
        self.context = StateContext()
        self._setup_transitions()
    
    def _setup_transitions(self):
        self.transitions: Dict[tuple, UpgradeState] = {
            (UpgradeState.IDLE, UpgradeEvent.HANDSHAKE_START): UpgradeState.HANDSHAKING,
            (UpgradeState.HANDSHAKING, UpgradeEvent.VERSION_DETECTED): UpgradeState.VERSION_CHECK,
            (UpgradeState.HANDSHAKING, UpgradeEvent.HANDSHAKE_SUCCESS): UpgradeState.VERSION_CHECK,
            (UpgradeState.HANDSHAKING, UpgradeEvent.HANDSHAKE_TIMEOUT): UpgradeState.TIMEOUT,
            (UpgradeState.HANDSHAKING, UpgradeEvent.TIMEOUT): UpgradeState.TIMEOUT,
            (UpgradeState.VERSION_CHECK, UpgradeEvent.TRANSFER_START): UpgradeState.TRANSFERRING,
            (UpgradeState.VERSION_CHECK, UpgradeEvent.TRANSFER_COMPLETE): UpgradeState.CRC_CHECKING,
            (UpgradeState.VERSION_CHECK, UpgradeEvent.VERSION_DETECTED): UpgradeState.VERSION_CHECK,
            (UpgradeState.VERSION_CHECK, UpgradeEvent.TIMEOUT): UpgradeState.TIMEOUT,
            (UpgradeState.TRANSFERRING, UpgradeEvent.TRANSFER_COMPLETE): UpgradeState.CRC_CHECKING,
            (UpgradeState.TRANSFERRING, UpgradeEvent.TRANSFER_PROGRESS): UpgradeState.TRANSFERRING,
            (UpgradeState.TRANSFERRING, UpgradeEvent.TIMEOUT): UpgradeState.TIMEOUT,
            (UpgradeState.CRC_CHECKING, UpgradeEvent.CRC_CHECK_START): UpgradeState.CRC_CHECKING,
            (UpgradeState.CRC_CHECKING, UpgradeEvent.CRC_PASS): UpgradeState.FLASHING,
            (UpgradeState.CRC_CHECKING, UpgradeEvent.CRC_FAIL): UpgradeState.FAILED,
            (UpgradeState.CRC_CHECKING, UpgradeEvent.TIMEOUT): UpgradeState.TIMEOUT,
            (UpgradeState.FLASHING, UpgradeEvent.FLASH_START): UpgradeState.FLASHING,
            (UpgradeState.FLASHING, UpgradeEvent.FLASH_COMPLETE): UpgradeState.REBOOTING,
            (UpgradeState.FLASHING, UpgradeEvent.FLASH_PROGRESS): UpgradeState.FLASHING,
            (UpgradeState.FLASHING, UpgradeEvent.TIMEOUT): UpgradeState.TIMEOUT,
            (UpgradeState.REBOOTING, UpgradeEvent.REBOOT_START): UpgradeState.REBOOTING,
            (UpgradeState.REBOOTING, UpgradeEvent.SUCCESS): UpgradeState.SUCCESS,
            (UpgradeState.REBOOTING, UpgradeEvent.REBOOT_COMPLETE): UpgradeState.SUCCESS,
            (UpgradeState.REBOOTING, UpgradeEvent.TIMEOUT): UpgradeState.TIMEOUT,
            (UpgradeState.TIMEOUT, UpgradeEvent.RETRY): UpgradeState.HANDSHAKING,
            (UpgradeState.TIMEOUT, UpgradeEvent.ROLLBACK_START): UpgradeState.ROLLBACK,
            (UpgradeState.FAILED, UpgradeEvent.ROLLBACK_START): UpgradeState.ROLLBACK,
            (UpgradeState.ROLLBACK, UpgradeEvent.ROLLBACK_COMPLETE): UpgradeState.SUCCESS,
            (UpgradeState.ROLLBACK, UpgradeEvent.TIMEOUT): UpgradeState.FAILED,
            (UpgradeState.SUCCESS, UpgradeEvent.SUCCESS): UpgradeState.SUCCESS,
            (UpgradeState.FAILED, UpgradeEvent.FAILURE): UpgradeState.FAILED,
        }
        
        self.interrupt_states = {
            UpgradeState.HANDSHAKING,
            UpgradeState.VERSION_CHECK,
            UpgradeState.TRANSFERRING,
            UpgradeState.CRC_CHECKING,
            UpgradeState.FLASHING,
            UpgradeState.REBOOTING,
        }
    
    def reset(self):
        self.context = StateContext()
    
    def can_transition(self, event: UpgradeEvent) -> bool:
        key = (self.context.current_state, event)
        return key in self.transitions
    
    def _create_transition(self, to_state: UpgradeState, event: UpgradeEvent, 
                           log_entry: Optional[LogEntry] = None) -> StateTransition:
        return StateTransition(
            from_state=self.context.current_state.value,
            to_state=to_state.value,
            timestamp=log_entry.timestamp if log_entry else datetime.now(),
            event=event.value,
            log_line_number=log_entry.line_number if log_entry else 0,
            details=log_entry.message if log_entry else "",
        )
    
    def transition(self, event: UpgradeEvent, log_entry: Optional[LogEntry] = None) -> bool:
        if not self.can_transition(event):
            if self.context.current_state in self.interrupt_states:
                pass
            return False
        
        target_state = self.transitions[(self.context.current_state, event)]
        
        self.context.previous_state = self.context.current_state
        
        transition = self._create_transition(target_state, event, log_entry)
        self.context.add_transition(transition)
        
        self.context.current_state = target_state
        self.context.last_event_time = log_entry.timestamp if log_entry else datetime.now()
        
        if log_entry:
            self.context.log_entries.append(log_entry)
        
        self._update_context_on_transition(event, log_entry)
        
        return True
    
    def _update_context_on_transition(self, event: UpgradeEvent, log_entry: Optional[LogEntry]):
        if log_entry is None:
            return
        
        if event == UpgradeEvent.VERSION_DETECTED:
            version = log_entry.get('version')
            if version:
                if not self.context.source_version:
                    self.context.source_version = version
                else:
                    self.context.target_version = version
        
        if event == UpgradeEvent.TRANSFER_PROGRESS:
            progress = log_entry.get('progress')
            if progress is not None:
                self.context.last_progress = progress
        
        if event == UpgradeEvent.CRC_PASS:
            self.context.crc_verified = True
            crc = log_entry.get('crc')
            if crc:
                self.context.detected_crc = crc
        
        if event == UpgradeEvent.RETRY:
            self.context.retry_count += 1
        
        if event == UpgradeEvent.FLASH_PROGRESS:
            progress = log_entry.get('progress')
            if progress is not None:
                self.context.last_progress = progress
    
    def process_log_entry(self, log_entry: LogEntry) -> Optional[UpgradeEvent]:
        event = self._map_log_to_event(log_entry)
        if event:
            self.transition(event, log_entry)
        return event
    
    def _map_log_to_event(self, log_entry: LogEntry) -> Optional[UpgradeEvent]:
        event_type = log_entry.event_type
        
        mapping: Dict[UpgradeEventType, UpgradeEvent] = {
            UpgradeEventType.HANDSHAKE: UpgradeEvent.HANDSHAKE_START,
            UpgradeEventType.VERSION_CHECK: UpgradeEvent.VERSION_DETECTED,
            UpgradeEventType.TRANSFER_START: UpgradeEvent.TRANSFER_START,
            UpgradeEventType.TRANSFER_COMPLETE: UpgradeEvent.TRANSFER_COMPLETE,
            UpgradeEventType.CRC_CHECK: UpgradeEvent.CRC_CHECK_START,
            UpgradeEventType.CRC_PASS: UpgradeEvent.CRC_PASS,
            UpgradeEventType.CRC_FAIL: UpgradeEvent.CRC_FAIL,
            UpgradeEventType.FLASH_START: UpgradeEvent.FLASH_START,
            UpgradeEventType.FLASH_COMPLETE: UpgradeEvent.FLASH_COMPLETE,
            UpgradeEventType.REBOOT: UpgradeEvent.REBOOT_START,
            UpgradeEventType.ROLLBACK_START: UpgradeEvent.ROLLBACK_START,
            UpgradeEventType.ROLLBACK_COMPLETE: UpgradeEvent.ROLLBACK_COMPLETE,
            UpgradeEventType.TIMEOUT: UpgradeEvent.TIMEOUT,
            UpgradeEventType.RETRY: UpgradeEvent.RETRY,
            UpgradeEventType.SUCCESS: UpgradeEvent.SUCCESS,
            UpgradeEventType.FAILURE: UpgradeEvent.FAILURE,
        }
        
        return mapping.get(event_type)
    
    def process_log_entries(self, log_entries: List[LogEntry]) -> List[StateTransition]:
        for entry in log_entries:
            self.process_log_entry(entry)
        
        self._finalize_state()
        
        return self.context.transitions
    
    def _finalize_state(self):
        if self.context.current_state in self.interrupt_states:
            self.context.current_state = UpgradeState.INTERRUPTED
    
    def get_upgrade_attempt(self, attempt_id: str, device_id: str) -> UpgradeAttempt:
        success = self.context.current_state in [UpgradeState.SUCCESS]
        
        direction = UpgradeDirection.UPGRADE
        if self.context.current_state == UpgradeState.ROLLBACK or \
           any(t.to_state == UpgradeState.ROLLBACK.value for t in self.context.transitions):
            direction = UpgradeDirection.ROLLBACK
        
        failure_reason = ""
        if self.context.current_state == UpgradeState.FAILED:
            if not self.context.crc_verified:
                failure_reason = "CRC校验失败"
            else:
                failure_reason = "烧录失败"
        elif self.context.current_state == UpgradeState.TIMEOUT:
            failure_reason = "操作超时"
        elif self.context.current_state == UpgradeState.INTERRUPTED:
            failure_reason = "升级被中断"
        
        end_time = None
        if self.context.transitions:
            last_transition = self.context.transitions[-1]
            end_time = last_transition.timestamp
        
        return UpgradeAttempt(
            attempt_id=attempt_id,
            device_id=device_id,
            start_time=self.context.start_time,
            end_time=end_time,
            source_version=self.context.source_version,
            target_version=self.context.target_version,
            direction=direction,
            success=success,
            failure_reason=failure_reason,
            crc_verified=self.context.crc_verified,
            retry_count=self.context.retry_count,
            log_entries=self.context.log_entries,
            state_transitions=self.context.transitions,
        )
    
    def get_state_summary(self) -> Dict[str, Any]:
        return {
            "current_state": self.context.current_state.value,
            "previous_state": self.context.previous_state.value if self.context.previous_state else None,
            "retry_count": self.context.retry_count,
            "crc_verified": self.context.crc_verified,
            "source_version": self.context.source_version,
            "target_version": self.context.target_version,
            "last_progress": self.context.last_progress,
            "transition_count": len(self.context.transitions),
            "is_success": self.context.current_state == UpgradeState.SUCCESS,
            "is_failed": self.context.current_state in [UpgradeState.FAILED, UpgradeState.TIMEOUT, UpgradeState.INTERRUPTED],
        }
