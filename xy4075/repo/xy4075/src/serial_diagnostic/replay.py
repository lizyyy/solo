import time
import threading
from typing import List, Dict, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

from .models import ParsedSession, ParsedFrame, FrameDirection
from .state_machine import StateMachine, ModbusStateMachine, StateTransition
from .fault_injection import (
    FaultInjectionManager, FaultInjectionConfig,
    InjectionResult
)


class ReplayStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    STOPPED = "stopped"
    ERROR = "error"


class BreakpointType(str, Enum):
    FRAME_INDEX = "frame_index"
    TIME_OFFSET = "time_offset"
    SLAVE_ADDRESS = "slave_address"
    FUNCTION_CODE = "function_code"
    STATE_TRANSITION = "state_transition"
    ERROR_FRAME = "error_frame"


@dataclass
class Breakpoint:
    breakpoint_type: BreakpointType
    value: Any
    name: Optional[str] = None
    enabled: bool = True
    hit_count: int = 0
    max_hits: Optional[int] = None
    
    def should_break(self, frame: ParsedFrame, frame_index: int,
                     current_time: float, session_start: float,
                     state_transition: Optional[StateTransition] = None) -> bool:
        if not self.enabled:
            return False
        if self.max_hits is not None and self.hit_count >= self.max_hits:
            return False
        
        if self.breakpoint_type == BreakpointType.FRAME_INDEX:
            if isinstance(self.value, list):
                return frame_index in self.value
            return frame_index == self.value
        
        elif self.breakpoint_type == BreakpointType.TIME_OFFSET:
            time_offset = current_time - session_start
            if isinstance(self.value, tuple) and len(self.value) == 2:
                return self.value[0] <= time_offset <= self.value[1]
            return abs(time_offset - self.value) < 0.001
        
        elif self.breakpoint_type == BreakpointType.SLAVE_ADDRESS:
            if frame.slave_address is None:
                return False
            if isinstance(self.value, list):
                return frame.slave_address in self.value
            return frame.slave_address == self.value
        
        elif self.breakpoint_type == BreakpointType.FUNCTION_CODE:
            if frame.function_code is None:
                return False
            if isinstance(self.value, list):
                return frame.function_code in self.value
            return frame.function_code == self.value
        
        elif self.breakpoint_type == BreakpointType.STATE_TRANSITION:
            if state_transition is None:
                return False
            if isinstance(self.value, dict):
                from_state = self.value.get('from', None)
                to_state = self.value.get('to', None)
                if from_state and state_transition.from_state != from_state:
                    return False
                if to_state and state_transition.to_state != to_state:
                    return False
                return True
            return state_transition.trigger == self.value
        
        elif self.breakpoint_type == BreakpointType.ERROR_FRAME:
            if frame.validation_result is None:
                return False
            return not frame.validation_result.is_valid
        
        return False


@dataclass
class ReplayEvent:
    event_type: str
    timestamp: float
    frame_index: Optional[int] = None
    frame: Optional[ParsedFrame] = None
    state_transition: Optional[StateTransition] = None
    breakpoint: Optional[Breakpoint] = None
    injection: Optional[InjectionResult] = None
    message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReplayStats:
    total_frames: int = 0
    processed_frames: int = 0
    dropped_frames: int = 0
    duplicated_frames: int = 0
    corrupted_frames: int = 0
    timeout_count: int = 0
    state_transitions: int = 0
    invalid_transitions: int = 0
    breakpoints_hit: int = 0
    injections_applied: int = 0
    errors_count: int = 0
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    
    @property
    def duration(self) -> float:
        if self.start_time is None or self.end_time is None:
            return 0.0
        return self.end_time - self.start_time


class ReplayScheduler:
    def __init__(self, session: ParsedSession, 
                 state_machine: Optional[StateMachine] = None,
                 fault_manager: Optional[FaultInjectionManager] = None):
        self.session = session
        self.state_machine = state_machine or ModbusStateMachine()
        self.fault_manager = fault_manager or FaultInjectionManager()
        
        self._status: ReplayStatus = ReplayStatus.IDLE
        self._stats: ReplayStats = ReplayStats(total_frames=session.frame_count)
        self._events: List[ReplayEvent] = []
        self._breakpoints: List[Breakpoint] = []
        
        self._speed_multiplier: float = 1.0
        self._current_frame_index: int = 0
        self._current_time: float = 0.0
        self._pause_event = threading.Event()
        self._pause_event.set()
        self._stop_event = threading.Event()
        
        self._on_frame: List[Callable[[ParsedFrame, int], None]] = []
        self._on_state_change: List[Callable[[StateTransition], None]] = []
        self._on_breakpoint: List[Callable[[Breakpoint, ReplayEvent], None]] = []
        self._on_injection: List[Callable[[InjectionResult], None]] = []
        self._on_error: List[Callable[[Exception], None]] = []
        self._on_complete: List[Callable[[ReplayStats], None]] = []
    
    @property
    def status(self) -> ReplayStatus:
        return self._status
    
    @property
    def stats(self) -> ReplayStats:
        return self._stats
    
    @property
    def events(self) -> List[ReplayEvent]:
        return list(self._events)
    
    @property
    def current_frame_index(self) -> int:
        return self._current_frame_index
    
    @property
    def speed_multiplier(self) -> float:
        return self._speed_multiplier
    
    @speed_multiplier.setter
    def speed_multiplier(self, value: float) -> None:
        if value <= 0:
            raise ValueError("Speed multiplier must be positive")
        self._speed_multiplier = value
    
    def add_breakpoint(self, breakpoint: Breakpoint) -> None:
        self._breakpoints.append(breakpoint)
    
    def add_breakpoints(self, breakpoints: List[Breakpoint]) -> None:
        for bp in breakpoints:
            self.add_breakpoint(bp)
    
    def clear_breakpoints(self) -> None:
        self._breakpoints.clear()
    
    def add_fault_config(self, config: FaultInjectionConfig) -> None:
        self.fault_manager.add_config(config)
    
    def add_fault_configs(self, configs: List[FaultInjectionConfig]) -> None:
        self.fault_manager.add_configs(configs)
    
    def on_frame(self, callback: Callable[[ParsedFrame, int], None]) -> None:
        self._on_frame.append(callback)
    
    def on_state_change(self, callback: Callable[[StateTransition], None]) -> None:
        self._on_state_change.append(callback)
    
    def on_breakpoint(self, callback: Callable[[Breakpoint, ReplayEvent], None]) -> None:
        self._on_breakpoint.append(callback)
    
    def on_injection(self, callback: Callable[[InjectionResult], None]) -> None:
        self._on_injection.append(callback)
    
    def on_error(self, callback: Callable[[Exception], None]) -> None:
        self._on_error.append(callback)
    
    def on_complete(self, callback: Callable[[ReplayStats], None]) -> None:
        self._on_complete.append(callback)
    
    def start(self, from_frame: int = 0) -> None:
        if self._status == ReplayStatus.RUNNING:
            return
        
        self._status = ReplayStatus.RUNNING
        self._stats.start_time = time.time()
        self._stop_event.clear()
        self._pause_event.set()
        
        try:
            self._run(from_frame)
        except Exception as e:
            self._status = ReplayStatus.ERROR
            self._notify_error(e)
            raise
    
    def _run(self, from_frame: int) -> None:
        frames = self.session.frames
        total_frames = len(frames)
        
        if total_frames == 0:
            self._status = ReplayStatus.COMPLETED
            self._stats.end_time = time.time()
            self._notify_complete()
            return
        
        session_start = frames[0].timestamp if frames else 0.0
        
        self._current_frame_index = from_frame
        
        while self._current_frame_index < total_frames:
            if self._stop_event.is_set():
                self._status = ReplayStatus.STOPPED
                break
            
            self._pause_event.wait()
            
            if self._stop_event.is_set():
                self._status = ReplayStatus.STOPPED
                break
            
            frame = frames[self._current_frame_index]
            self._current_time = frame.timestamp
            
            if self._current_frame_index > 0:
                prev_frame = frames[self._current_frame_index - 1]
                time_diff = frame.timestamp - prev_frame.timestamp
                if time_diff > 0:
                    adjusted_delay = time_diff / self._speed_multiplier
                    self._accurate_sleep(adjusted_delay)
            
            processed_frames = self.fault_manager.process_frame(
                frame, self._current_frame_index,
                self._current_time, session_start
            )
            
            for injection in self.fault_manager.get_history():
                if injection.frame_index == self._current_frame_index:
                    self._stats.injections_applied += 1
                    self._notify_injection(injection)
                    self._record_event(ReplayEvent(
                        event_type="injection",
                        timestamp=time.time(),
                        frame_index=self._current_frame_index,
                        frame=frame,
                        injection=injection,
                        message=f"Applied {injection.fault_type.value}"
                    ))
            
            for proc_frame in processed_frames:
                self._process_single_frame(proc_frame, self._current_frame_index, session_start)
            
            self._stats.processed_frames += 1
            self._current_frame_index += 1
        
        if self._status == ReplayStatus.RUNNING:
            self._status = ReplayStatus.COMPLETED
        
        self._stats.end_time = time.time()
        self._notify_complete()
    
    def _process_single_frame(self, frame: ParsedFrame, frame_index: int, 
                               session_start: float) -> None:
        self._notify_frame(frame, frame_index)
        self._record_event(ReplayEvent(
            event_type="frame",
            timestamp=time.time(),
            frame_index=frame_index,
            frame=frame,
            message=f"Frame {frame_index}: {frame.direction.value}"
        ))
        
        transition_trigger = self._get_trigger_for_frame(frame)
        
        if transition_trigger:
            old_state = self.state_machine.get_current_state()
            success = self.state_machine.trigger(
                transition_trigger, 
                context=frame,
                timestamp=frame.timestamp
            )
            
            history = self.state_machine.get_history()
            if history:
                last_transition = history[-1]
                self._stats.state_transitions += 1
                if not last_transition.is_valid:
                    self._stats.invalid_transitions += 1
                self._notify_state_change(last_transition)
                
                self._check_breakpoints(frame, frame_index, session_start, last_transition)
        
        self._check_breakpoints(frame, frame_index, session_start)
    
    def _get_trigger_for_frame(self, frame: ParsedFrame) -> Optional[str]:
        if frame.validation_result and not frame.validation_result.is_valid:
            for error in frame.validation_result.errors:
                if 'CRC' in error or 'crc' in error:
                    return "crc_error"
                if 'exception' in error.lower():
                    return "slave_exception"
        
        if frame.direction == FrameDirection.REQUEST:
            return "send_request"
        elif frame.direction == FrameDirection.RESPONSE:
            if frame.function_code and int(frame.function_code, 16) > 0x80:
                return "slave_exception"
            return "valid_response"
        
        return None
    
    def _check_breakpoints(self, frame: ParsedFrame, frame_index: int,
                           session_start: float, 
                           state_transition: Optional[StateTransition] = None) -> None:
        for bp in self._breakpoints:
            if bp.should_break(frame, frame_index, self._current_time, 
                               session_start, state_transition):
                bp.hit_count += 1
                self._stats.breakpoints_hit += 1
                
                event = ReplayEvent(
                    event_type="breakpoint",
                    timestamp=time.time(),
                    frame_index=frame_index,
                    frame=frame,
                    state_transition=state_transition,
                    breakpoint=bp,
                    message=f"Breakpoint hit: {bp.name or bp.breakpoint_type.value}"
                )
                self._record_event(event)
                self._notify_breakpoint(bp, event)
                
                self.pause()
    
    def _accurate_sleep(self, seconds: float) -> None:
        if seconds <= 0:
            return
        
        end_time = time.perf_counter() + seconds
        remaining = seconds
        
        while remaining > 0:
            if remaining > 0.01:
                time.sleep(remaining * 0.9)
            else:
                while time.perf_counter() < end_time:
                    pass
                break
            remaining = end_time - time.perf_counter()
    
    def pause(self) -> None:
        if self._status == ReplayStatus.RUNNING:
            self._status = ReplayStatus.PAUSED
            self._pause_event.clear()
    
    def resume(self) -> None:
        if self._status == ReplayStatus.PAUSED:
            self._status = ReplayStatus.RUNNING
            self._pause_event.set()
    
    def stop(self) -> None:
        self._stop_event.set()
        self._pause_event.set()
        self._status = ReplayStatus.STOPPED
    
    def step(self) -> bool:
        if self._current_frame_index >= len(self.session.frames):
            return False
        
        frames = self.session.frames
        session_start = frames[0].timestamp if frames else 0.0
        
        frame = frames[self._current_frame_index]
        self._current_time = frame.timestamp
        
        processed_frames = self.fault_manager.process_frame(
            frame, self._current_frame_index,
            self._current_time, session_start
        )
        
        for proc_frame in processed_frames:
            self._process_single_frame(proc_frame, self._current_frame_index, session_start)
        
        self._stats.processed_frames += 1
        self._current_frame_index += 1
        
        return self._current_frame_index < len(frames)
    
    def jump_to(self, frame_index: int) -> None:
        if frame_index < 0 or frame_index >= len(self.session.frames):
            raise ValueError(f"Frame index out of range: {frame_index}")
        
        self._current_frame_index = frame_index
        
        if self.session.frames:
            self._current_time = self.session.frames[frame_index].timestamp
    
    def reset(self) -> None:
        self._status = ReplayStatus.IDLE
        self._current_frame_index = 0
        self._current_time = 0.0
        self._stats = ReplayStats(total_frames=self.session.frame_count)
        self._events.clear()
        self.fault_manager._injection_history.clear()
        self.state_machine.reset()
        
        for bp in self._breakpoints:
            bp.hit_count = 0
    
    def _record_event(self, event: ReplayEvent) -> None:
        self._events.append(event)
    
    def _notify_frame(self, frame: ParsedFrame, index: int) -> None:
        for callback in self._on_frame:
            try:
                callback(frame, index)
            except Exception as e:
                self._notify_error(e)
    
    def _notify_state_change(self, transition: StateTransition) -> None:
        for callback in self._on_state_change:
            try:
                callback(transition)
            except Exception as e:
                self._notify_error(e)
    
    def _notify_breakpoint(self, bp: Breakpoint, event: ReplayEvent) -> None:
        for callback in self._on_breakpoint:
            try:
                callback(bp, event)
            except Exception as e:
                self._notify_error(e)
    
    def _notify_injection(self, injection: InjectionResult) -> None:
        for callback in self._on_injection:
            try:
                callback(injection)
            except Exception as e:
                self._notify_error(e)
    
    def _notify_error(self, error: Exception) -> None:
        self._stats.errors_count += 1
        for callback in self._on_error:
            try:
                callback(error)
            except Exception:
                pass
    
    def _notify_complete(self) -> None:
        for callback in self._on_complete:
            try:
                callback(self._stats)
            except Exception as e:
                self._notify_error(e)
