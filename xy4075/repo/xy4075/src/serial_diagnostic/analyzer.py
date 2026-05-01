from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict

from .models import ParsedSession, ParsedFrame, FrameDirection, ProtocolConfig
from .state_machine import StateMachine, ModbusStateMachine, StateTransition


class AnomalyType(str, Enum):
    TIMEOUT = "timeout"
    OUT_OF_ORDER = "out_of_order"
    DUPLICATE_FRAME = "duplicate_frame"
    INVALID_STATE_TRANSITION = "invalid_state_transition"
    CRC_ERROR = "crc_error"
    INVALID_SLAVE_ADDRESS = "invalid_slave_address"
    INVALID_REGISTER_ADDRESS = "invalid_register_address"
    UNEXPECTED_RESPONSE = "unexpected_response"
    MISSING_RESPONSE = "missing_response"
    INVALID_FRAME_FORMAT = "invalid_frame_format"
    LRC_ERROR = "lrc_error"


class AnomalySeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class Anomaly:
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    timestamp: float
    frame_index: Optional[int] = None
    frame: Optional[ParsedFrame] = None
    related_frame_index: Optional[int] = None
    related_frame: Optional[ParsedFrame] = None
    state_transition: Optional[StateTransition] = None
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)


@dataclass
class AnalysisResult:
    session_id: str
    total_frames: int
    valid_frames: int
    invalid_frames: int
    anomalies: List[Anomaly]
    stats: Dict[str, Any] = field(default_factory=dict)
    state_machine_history: List[StateTransition] = field(default_factory=list)
    
    @property
    def anomaly_count(self) -> int:
        return len(self.anomalies)
    
    def get_anomalies_by_type(self, anomaly_type: AnomalyType) -> List[Anomaly]:
        return [a for a in self.anomalies if a.anomaly_type == anomaly_type]
    
    def get_anomalies_by_severity(self, severity: AnomalySeverity) -> List[Anomaly]:
        return [a for a in self.anomalies if a.severity == severity]
    
    def get_critical_anomalies(self) -> List[Anomaly]:
        return self.get_anomalies_by_severity(AnomalySeverity.CRITICAL)
    
    def get_high_anomalies(self) -> List[Anomaly]:
        return self.get_anomalies_by_severity(AnomalySeverity.HIGH)


class BaseAnalyzer(ABC):
    @abstractmethod
    def analyze(self, session: ParsedSession, config: ProtocolConfig,
                state_machine: Optional[StateMachine] = None) -> List[Anomaly]:
        pass


class TimeoutAnalyzer(BaseAnalyzer):
    def __init__(self, timeout_ms: int = 1000):
        self.timeout_ms = timeout_ms
    
    def analyze(self, session: ParsedSession, config: ProtocolConfig,
                state_machine: Optional[StateMachine] = None) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        frames = session.frames
        
        pending_requests: Dict[Tuple[int, str], Tuple[int, ParsedFrame]] = {}
        
        for idx, frame in enumerate(frames):
            if frame.direction == FrameDirection.REQUEST:
                key = (frame.slave_address or 0, frame.function_code or "")
                pending_requests[key] = (idx, frame)
            
            elif frame.direction == FrameDirection.RESPONSE:
                key = (frame.slave_address or 0, frame.function_code or "")
                if key in pending_requests:
                    req_idx, req_frame = pending_requests.pop(key)
                    time_diff_ms = (frame.timestamp - req_frame.timestamp) * 1000
                    
                    if time_diff_ms > self.timeout_ms:
                        anomalies.append(Anomaly(
                            anomaly_type=AnomalyType.TIMEOUT,
                            severity=AnomalySeverity.HIGH,
                            timestamp=frame.timestamp,
                            frame_index=idx,
                            frame=frame,
                            related_frame_index=req_idx,
                            related_frame=req_frame,
                            message=f"Response timeout: {time_diff_ms:.2f}ms exceeds {self.timeout_ms}ms threshold",
                            details={
                                'request_timestamp': req_frame.timestamp,
                                'response_timestamp': frame.timestamp,
                                'actual_delay_ms': time_diff_ms,
                                'threshold_ms': self.timeout_ms
                            },
                            recommendations=[
                                "Check network latency and device responsiveness",
                                "Consider increasing timeout threshold",
                                "Verify slave device is functioning properly"
                            ]
                        ))
        
        for key, (req_idx, req_frame) in pending_requests.items():
            anomalies.append(Anomaly(
                anomaly_type=AnomalyType.MISSING_RESPONSE,
                severity=AnomalySeverity.CRITICAL,
                timestamp=req_frame.timestamp,
                frame_index=req_idx,
                frame=req_frame,
                message=f"No response received for request to slave {key[0]}, function {key[1]}",
                details={
                    'slave_address': key[0],
                    'function_code': key[1],
                    'register_address': req_frame.register_address
                },
                recommendations=[
                    "Check if slave device is powered and connected",
                    "Verify slave address and function code support",
                    "Check for communication line issues"
                ]
            ))
        
        return anomalies


class OutOfOrderAnalyzer(BaseAnalyzer):
    def analyze(self, session: ParsedSession, config: ProtocolConfig,
                state_machine: Optional[StateMachine] = None) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        frames = session.frames
        
        for idx in range(1, len(frames)):
            curr_frame = frames[idx]
            prev_frame = frames[idx - 1]
            
            if curr_frame.timestamp < prev_frame.timestamp:
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.OUT_OF_ORDER,
                    severity=AnomalySeverity.HIGH,
                    timestamp=curr_frame.timestamp,
                    frame_index=idx,
                    frame=curr_frame,
                    related_frame_index=idx - 1,
                    related_frame=prev_frame,
                    message=f"Frame {idx} timestamp is earlier than frame {idx-1}",
                    details={
                        'frame_index': idx,
                        'frame_timestamp': curr_frame.timestamp,
                        'prev_frame_index': idx - 1,
                        'prev_frame_timestamp': prev_frame.timestamp,
                        'time_difference': prev_frame.timestamp - curr_frame.timestamp
                    },
                    recommendations=[
                        "Check logging system timestamp synchronization",
                        "Verify frame capture order is correct",
                        "Consider reordering frames based on timestamps"
                    ]
                ))
        
        return anomalies


class DuplicateFrameAnalyzer(BaseAnalyzer):
    def __init__(self, time_window_ms: float = 100.0):
        self.time_window_ms = time_window_ms
    
    def analyze(self, session: ParsedSession, config: ProtocolConfig,
                state_machine: Optional[StateMachine] = None) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        frames = session.frames
        
        seen_hashes: Dict[int, List[Tuple[int, float]]] = defaultdict(list)
        
        for idx, frame in enumerate(frames):
            frame_hash = hash((
                frame.raw_data,
                frame.direction,
                frame.slave_address,
                frame.function_code
            ))
            
            for prev_idx, prev_ts in seen_hashes[frame_hash]:
                time_diff_ms = (frame.timestamp - prev_ts) * 1000
                if time_diff_ms < self.time_window_ms:
                    anomalies.append(Anomaly(
                        anomaly_type=AnomalyType.DUPLICATE_FRAME,
                        severity=AnomalySeverity.MEDIUM,
                        timestamp=frame.timestamp,
                        frame_index=idx,
                        frame=frame,
                        related_frame_index=prev_idx,
                        message=f"Duplicate frame detected at index {idx} (same as index {prev_idx})",
                        details={
                            'duplicate_index': idx,
                            'original_index': prev_idx,
                            'time_diff_ms': time_diff_ms,
                            'raw_data_hex': frame.raw_data.hex() if frame.raw_data else None
                        },
                        recommendations=[
                            "Check for device retransmission logic",
                            "Verify this is not expected retry behavior",
                            "Consider filtering duplicates during analysis"
                        ]
                    ))
            
            seen_hashes[frame_hash].append((idx, frame.timestamp))
        
        return anomalies


class FrameValidationAnalyzer(BaseAnalyzer):
    def analyze(self, session: ParsedSession, config: ProtocolConfig,
                state_machine: Optional[StateMachine] = None) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        frames = session.frames
        
        for idx, frame in enumerate(frames):
            if frame.validation_result is None:
                continue
            
            if not frame.validation_result.is_valid:
                for error in frame.validation_result.errors:
                    anomaly_type = self._classify_error(error)
                    severity = self._get_severity(anomaly_type)
                    
                    anomalies.append(Anomaly(
                        anomaly_type=anomaly_type,
                        severity=severity,
                        timestamp=frame.timestamp,
                        frame_index=idx,
                        frame=frame,
                        message=f"Frame validation error: {error}",
                        details={
                            'error_message': error,
                            'slave_address': frame.slave_address,
                            'function_code': frame.function_code,
                            'raw_data_hex': frame.raw_data.hex() if frame.raw_data else None
                        },
                        recommendations=self._get_recommendations(anomaly_type)
                    ))
            
            for warning in frame.validation_result.warnings:
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.INVALID_FRAME_FORMAT,
                    severity=AnomalySeverity.LOW,
                    timestamp=frame.timestamp,
                    frame_index=idx,
                    frame=frame,
                    message=f"Frame validation warning: {warning}",
                    details={'warning_message': warning},
                    recommendations=[]
                ))
        
        return anomalies
    
    def _classify_error(self, error: str) -> AnomalyType:
        error_lower = error.lower()
        if 'crc' in error_lower:
            return AnomalyType.CRC_ERROR
        if 'lrc' in error_lower:
            return AnomalyType.LRC_ERROR
        if 'slave' in error_lower or 'address' in error_lower:
            if 'register' in error_lower:
                return AnomalyType.INVALID_REGISTER_ADDRESS
            return AnomalyType.INVALID_SLAVE_ADDRESS
        if 'format' in error_lower:
            return AnomalyType.INVALID_FRAME_FORMAT
        return AnomalyType.INVALID_FRAME_FORMAT
    
    def _get_severity(self, anomaly_type: AnomalyType) -> AnomalySeverity:
        severity_map = {
            AnomalyType.CRC_ERROR: AnomalySeverity.HIGH,
            AnomalyType.LRC_ERROR: AnomalySeverity.HIGH,
            AnomalyType.INVALID_SLAVE_ADDRESS: AnomalySeverity.HIGH,
            AnomalyType.INVALID_REGISTER_ADDRESS: AnomalySeverity.MEDIUM,
            AnomalyType.INVALID_FRAME_FORMAT: AnomalySeverity.MEDIUM,
        }
        return severity_map.get(anomaly_type, AnomalySeverity.MEDIUM)
    
    def _get_recommendations(self, anomaly_type: AnomalyType) -> List[str]:
        rec_map = {
            AnomalyType.CRC_ERROR: [
                "Check for noise on the communication line",
                "Verify baud rate and parity settings",
                "Check cable connections and termination"
            ],
            AnomalyType.LRC_ERROR: [
                "Check Modbus ASCII frame format",
                "Verify no data corruption during transmission"
            ],
            AnomalyType.INVALID_SLAVE_ADDRESS: [
                "Verify slave device address configuration",
                "Check for address conflicts on the bus"
            ],
            AnomalyType.INVALID_REGISTER_ADDRESS: [
                "Check register map documentation",
                "Verify register address is within valid range",
                "Confirm slave supports this register"
            ],
            AnomalyType.INVALID_FRAME_FORMAT: [
                "Check protocol specification for frame format",
                "Verify log parsing configuration",
                "Check for truncated or corrupted frames"
            ],
        }
        return rec_map.get(anomaly_type, [])


class StateMachineAnalyzer(BaseAnalyzer):
    def analyze(self, session: ParsedSession, config: ProtocolConfig,
                state_machine: Optional[StateMachine] = None) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        
        if state_machine is None:
            state_machine = ModbusStateMachine()
        
        frames = session.frames
        
        for idx, frame in enumerate(frames):
            trigger = self._get_trigger(frame)
            if trigger:
                old_state = state_machine.get_current_state()
                success = state_machine.trigger(trigger, context=frame, timestamp=frame.timestamp)
                
                history = state_machine.get_history()
                if history:
                    last_transition = history[-1]
                    
                    if not last_transition.is_valid:
                        anomalies.append(Anomaly(
                            anomaly_type=AnomalyType.INVALID_STATE_TRANSITION,
                            severity=AnomalySeverity.HIGH,
                            timestamp=frame.timestamp,
                            frame_index=idx,
                            frame=frame,
                            state_transition=last_transition,
                            message=f"Invalid state transition: {last_transition.error_message}",
                            details={
                                'from_state': last_transition.from_state,
                                'to_state': last_transition.to_state,
                                'trigger': last_transition.trigger,
                                'error': last_transition.error_message
                            },
                            recommendations=[
                                "Check expected state machine behavior",
                                "Verify request-response sequence is correct",
                                "Review protocol specification for valid transitions"
                            ]
                        ))
        
        return anomalies
    
    def _get_trigger(self, frame: ParsedFrame) -> Optional[str]:
        if frame.direction == FrameDirection.REQUEST:
            return "send_request"
        elif frame.direction == FrameDirection.RESPONSE:
            if frame.validation_result and not frame.validation_result.is_valid:
                for error in frame.validation_result.errors:
                    if 'CRC' in error or 'crc' in error:
                        return "crc_error"
            if frame.function_code and int(frame.function_code, 16) > 0x80:
                return "slave_exception"
            return "valid_response"
        return None


class ProtocolAnalyzer:
    def __init__(self, config: ProtocolConfig,
                 timeout_ms: int = 1000,
                 duplicate_window_ms: float = 100.0):
        self.config = config
        self.analyzers: List[BaseAnalyzer] = [
            TimeoutAnalyzer(timeout_ms=timeout_ms),
            OutOfOrderAnalyzer(),
            DuplicateFrameAnalyzer(time_window_ms=duplicate_window_ms),
            FrameValidationAnalyzer(),
            StateMachineAnalyzer(),
        ]
    
    def add_analyzer(self, analyzer: BaseAnalyzer) -> None:
        self.analyzers.append(analyzer)
    
    def analyze(self, session: ParsedSession,
                state_machine: Optional[StateMachine] = None) -> AnalysisResult:
        all_anomalies: List[Anomaly] = []
        used_state_machine = state_machine or ModbusStateMachine()
        used_state_machine.reset()
        
        for analyzer in self.analyzers:
            if isinstance(analyzer, StateMachineAnalyzer):
                sm_for_analysis = ModbusStateMachine()
                anomalies = analyzer.analyze(session, self.config, sm_for_analysis)
            else:
                anomalies = analyzer.analyze(session, self.config, used_state_machine)
            all_anomalies.extend(anomalies)
        
        all_anomalies.sort(key=lambda a: a.timestamp)
        
        valid_count = sum(
            1 for f in session.frames 
            if f.validation_result and f.validation_result.is_valid
        )
        invalid_count = sum(
            1 for f in session.frames
            if f.validation_result and not f.validation_result.is_valid
        )
        
        return AnalysisResult(
            session_id=session.session_id,
            total_frames=session.frame_count,
            valid_frames=valid_count,
            invalid_frames=invalid_count,
            anomalies=all_anomalies,
            stats={
                'by_type': self._count_by_type(all_anomalies),
                'by_severity': self._count_by_severity(all_anomalies),
                'session_duration': session.duration,
                'frames_per_second': session.frame_count / session.duration if session.duration > 0 else 0,
            },
            state_machine_history=used_state_machine.get_history()
        )
    
    def _count_by_type(self, anomalies: List[Anomaly]) -> Dict[str, int]:
        counts: Dict[str, int] = defaultdict(int)
        for a in anomalies:
            counts[a.anomaly_type.value] += 1
        return dict(counts)
    
    def _count_by_severity(self, anomalies: List[Anomaly]) -> Dict[str, int]:
        counts: Dict[str, int] = defaultdict(int)
        for a in anomalies:
            counts[a.severity.value] += 1
        return dict(counts)
