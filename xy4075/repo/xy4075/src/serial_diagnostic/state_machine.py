from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class StateStatus(str, Enum):
    IDLE = "idle"
    ACTIVE = "active"
    TRANSITIONING = "transitioning"
    ERROR = "error"


class TransitionType(str, Enum):
    REQUEST = "request"
    RESPONSE = "response"
    TIMEOUT = "timeout"
    MANUAL = "manual"


@dataclass
class State:
    name: str
    description: Optional[str] = None
    is_initial: bool = False
    is_terminal: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __hash__(self):
        return hash(self.name)
    
    def __eq__(self, other):
        if isinstance(other, State):
            return self.name == other.name
        return False


@dataclass
class TransitionRule:
    from_state: str
    to_state: str
    trigger: str
    condition: Optional[Callable[[Any], bool]] = None
    description: Optional[str] = None
    timeout_ms: Optional[int] = None
    priority: int = 0
    
    def matches(self, trigger: str, context: Any = None) -> bool:
        if self.trigger != trigger:
            return False
        if self.condition is not None:
            try:
                return self.condition(context)
            except Exception:
                return False
        return True


@dataclass
class StateTransition:
    from_state: str
    to_state: str
    trigger: str
    timestamp: float
    transition_type: TransitionType
    is_valid: bool = True
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class StateMachineError(Exception):
    pass


class StateMachine:
    def __init__(self, name: str = "default"):
        self.name = name
        self._states: Dict[str, State] = {}
        self._transitions: List[TransitionRule] = []
        self._current_state: Optional[State] = None
        self._initial_state: Optional[State] = None
        self._status: StateStatus = StateStatus.IDLE
        self._history: List[StateTransition] = []
        self._on_state_change: List[Callable[[State, State], None]] = []
        self._on_error: List[Callable[[Exception], None]] = []
    
    def add_state(self, state: State) -> None:
        if state.name in self._states:
            raise StateMachineError(f"State '{state.name}' already exists")
        
        self._states[state.name] = state
        
        if state.is_initial:
            if self._initial_state is not None:
                raise StateMachineError("Initial state is already defined")
            self._initial_state = state
            self._current_state = state
    
    def add_states(self, states: List[State]) -> None:
        for state in states:
            self.add_state(state)
    
    def add_transition(self, transition: TransitionRule) -> None:
        if transition.from_state not in self._states:
            raise StateMachineError(f"From state '{transition.from_state}' does not exist")
        if transition.to_state not in self._states:
            raise StateMachineError(f"To state '{transition.to_state}' does not exist")
        
        self._transitions.append(transition)
        self._transitions.sort(key=lambda t: t.priority, reverse=True)
    
    def add_transitions(self, transitions: List[TransitionRule]) -> None:
        for transition in transitions:
            self.add_transition(transition)
    
    def get_current_state(self) -> Optional[State]:
        return self._current_state
    
    def get_state(self, name: str) -> Optional[State]:
        return self._states.get(name)
    
    def get_valid_transitions(self, trigger: str, context: Any = None) -> List[TransitionRule]:
        if self._current_state is None:
            return []
        
        valid = []
        for rule in self._transitions:
            if rule.from_state == self._current_state.name and rule.matches(trigger, context):
                valid.append(rule)
        
        return valid
    
    def trigger(self, trigger_name: str, context: Any = None, 
                timestamp: Optional[float] = None) -> bool:
        if self._status == StateStatus.ERROR:
            return False
        
        if self._current_state is None:
            self._record_transition(
                from_state="(none)",
                to_state="(none)",
                trigger=trigger_name,
                transition_type=TransitionType.MANUAL,
                is_valid=False,
                error_message="No current state defined",
                timestamp=timestamp
            )
            return False
        
        valid_transitions = self.get_valid_transitions(trigger_name, context)
        
        if not valid_transitions:
            self._record_transition(
                from_state=self._current_state.name,
                to_state=self._current_state.name,
                trigger=trigger_name,
                transition_type=TransitionType.MANUAL,
                is_valid=False,
                error_message=f"No valid transition from '{self._current_state.name}' for trigger '{trigger_name}'",
                timestamp=timestamp
            )
            return False
        
        selected = valid_transitions[0]
        old_state = self._current_state
        new_state = self._states[selected.to_state]
        
        self._status = StateStatus.TRANSITIONING
        self._record_transition(
            from_state=old_state.name,
            to_state=new_state.name,
            trigger=trigger_name,
            transition_type=TransitionType.MANUAL,
            is_valid=True,
            timestamp=timestamp,
            metadata={'rule_description': selected.description}
        )
        
        self._current_state = new_state
        self._status = StateStatus.ACTIVE
        
        self._notify_state_change(old_state, new_state)
        
        return True
    
    def reset(self) -> None:
        self._current_state = self._initial_state
        self._status = StateStatus.IDLE if self._initial_state else StateStatus.ERROR
        if self._initial_state:
            self._status = StateStatus.ACTIVE
    
    def get_history(self) -> List[StateTransition]:
        return list(self._history)
    
    def get_invalid_transitions(self) -> List[StateTransition]:
        return [t for t in self._history if not t.is_valid]
    
    def on_state_change(self, callback: Callable[[State, State], None]) -> None:
        self._on_state_change.append(callback)
    
    def on_error(self, callback: Callable[[Exception], None]) -> None:
        self._on_error.append(callback)
    
    def _record_transition(self, from_state: str, to_state: str, trigger: str,
                           transition_type: TransitionType, is_valid: bool,
                           error_message: Optional[str] = None,
                           timestamp: Optional[float] = None,
                           metadata: Optional[Dict[str, Any]] = None) -> None:
        ts = timestamp if timestamp is not None else datetime.now().timestamp()
        transition = StateTransition(
            from_state=from_state,
            to_state=to_state,
            trigger=trigger,
            timestamp=ts,
            transition_type=transition_type,
            is_valid=is_valid,
            error_message=error_message,
            metadata=metadata or {}
        )
        self._history.append(transition)
    
    def _notify_state_change(self, old_state: State, new_state: State) -> None:
        for callback in self._on_state_change:
            try:
                callback(old_state, new_state)
            except Exception as e:
                for error_callback in self._on_error:
                    try:
                        error_callback(e)
                    except Exception:
                        pass
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'name': self.name,
            'states': [
                {
                    'name': s.name,
                    'description': s.description,
                    'is_initial': s.is_initial,
                    'is_terminal': s.is_terminal,
                    'metadata': s.metadata
                }
                for s in self._states.values()
            ],
            'transitions': [
                {
                    'from': t.from_state,
                    'to': t.to_state,
                    'trigger': t.trigger,
                    'description': t.description,
                    'timeout_ms': t.timeout_ms,
                    'priority': t.priority
                }
                for t in self._transitions
            ],
            'current_state': self._current_state.name if self._current_state else None,
            'status': self._status.value,
            'history': [
                {
                    'from': t.from_state,
                    'to': t.to_state,
                    'trigger': t.trigger,
                    'timestamp': t.timestamp,
                    'type': t.transition_type.value,
                    'is_valid': t.is_valid,
                    'error': t.error_message,
                    'metadata': t.metadata
                }
                for t in self._history
            ]
        }


class ModbusStateMachine(StateMachine):
    def __init__(self):
        super().__init__("modbus_comm")
        self._setup_states()
        self._setup_transitions()
    
    def _setup_states(self) -> None:
        states = [
            State(name="IDLE", description="Idle state, waiting for request", is_initial=True),
            State(name="REQUEST_SENT", description="Request sent, waiting for response"),
            State(name="RESPONSE_RECEIVED", description="Response received successfully"),
            State(name="TIMEOUT", description="Timeout waiting for response"),
            State(name="CRC_ERROR", description="CRC check failed"),
            State(name="SLAVE_ERROR", description="Slave returned exception response"),
            State(name="ERROR", description="General error state", is_terminal=True),
        ]
        self.add_states(states)
    
    def _setup_transitions(self) -> None:
        transitions = [
            TransitionRule(
                from_state="IDLE",
                to_state="REQUEST_SENT",
                trigger="send_request",
                description="Send a Modbus request"
            ),
            TransitionRule(
                from_state="REQUEST_SENT",
                to_state="RESPONSE_RECEIVED",
                trigger="valid_response",
                description="Received valid response"
            ),
            TransitionRule(
                from_state="REQUEST_SENT",
                to_state="TIMEOUT",
                trigger="timeout",
                description="Response timeout"
            ),
            TransitionRule(
                from_state="REQUEST_SENT",
                to_state="CRC_ERROR",
                trigger="crc_error",
                description="CRC check failed"
            ),
            TransitionRule(
                from_state="REQUEST_SENT",
                to_state="SLAVE_ERROR",
                trigger="slave_exception",
                description="Slave returned exception"
            ),
            TransitionRule(
                from_state="RESPONSE_RECEIVED",
                to_state="IDLE",
                trigger="reset",
                description="Reset to idle for next transaction"
            ),
            TransitionRule(
                from_state="TIMEOUT",
                to_state="IDLE",
                trigger="reset",
                description="Reset after timeout"
            ),
            TransitionRule(
                from_state="CRC_ERROR",
                to_state="IDLE",
                trigger="reset",
                description="Reset after CRC error"
            ),
            TransitionRule(
                from_state="SLAVE_ERROR",
                to_state="IDLE",
                trigger="reset",
                description="Reset after slave error"
            ),
        ]
        self.add_transitions(transitions)
