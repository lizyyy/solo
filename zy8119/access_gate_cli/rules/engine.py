from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, time
from enum import Enum

from access_gate_cli.parser.csv_parser import Personnel, AccessRequest
from access_gate_cli.parser.yaml_parser import Zone, Device, ZoneRules
from access_gate_cli.parser.jsonl_parser import DeviceClock


class ViolationSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ViolationType(str, Enum):
    TIME_WINDOW_VIOLATION = "time_window_violation"
    MUTEX_ZONE_VIOLATION = "mutex_zone_violation"
    CLOCK_DRIFT_VIOLATION = "clock_drift_violation"
    ROLE_NOT_ALLOWED = "role_not_allowed"
    INVALID_TIME_RANGE = "invalid_time_range"
    REVOKE_REISSUE_WARNING = "revoke_reissue_warning"
    MISSING_PERSONNEL = "missing_personnel"
    MISSING_ZONE = "missing_zone"
    MISSING_DEVICE = "missing_device"
    INVALID_REQUEST_TYPE = "invalid_request_type"


@dataclass
class Violation:
    violation_type: ViolationType
    severity: ViolationSeverity
    message: str
    personnel_id: Optional[str] = None
    request_id: Optional[str] = None
    device_id: Optional[str] = None
    zone_id: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationResult:
    is_valid: bool
    violations: List[Violation] = field(default_factory=list)
    warnings: List[Violation] = field(default_factory=list)
    
    def add_violation(self, violation: Violation):
        if violation.severity in [ViolationSeverity.CRITICAL, ViolationSeverity.HIGH]:
            self.is_valid = False
            self.violations.append(violation)
        else:
            self.warnings.append(violation)


class RulesEngine:
    def __init__(
        self,
        zone_rules: ZoneRules,
        personnel: Dict[str, Personnel],
        device_clocks: Dict[str, DeviceClock]
    ):
        self.zone_rules = zone_rules
        self.personnel = personnel
        self.device_clocks = device_clocks
        self.grant_history: Dict[str, Dict[str, List[AccessRequest]]] = {}
        self.revoke_history: Dict[str, Dict[str, List[AccessRequest]]] = {}
    
    def validate_all_requests(
        self,
        requests: List[AccessRequest]
    ) -> ValidationResult:
        result = ValidationResult(is_valid=True)
        
        grant_requests = []
        revoke_requests = []
        
        for req in requests:
            if req.request_type == 'grant':
                grant_requests.append(req)
            elif req.request_type == 'revoke':
                revoke_requests.append(req)
            else:
                result.add_violation(Violation(
                    violation_type=ViolationType.INVALID_REQUEST_TYPE,
                    severity=ViolationSeverity.HIGH,
                    message=f"Invalid request type: {req.request_type}",
                    request_id=req.request_id,
                    personnel_id=req.personnel_id,
                    zone_id=req.zone_id
                ))
        
        for req in revoke_requests:
            self._process_revoke_request(req, result)
        
        for req in grant_requests:
            self._process_grant_request(req, result)
        
        self._check_clock_drift(result)
        
        return result
    
    def _process_grant_request(
        self,
        request: AccessRequest,
        result: ValidationResult
    ):
        if request.personnel_id not in self.personnel:
            result.add_violation(Violation(
                violation_type=ViolationType.MISSING_PERSONNEL,
                severity=ViolationSeverity.HIGH,
                message=f"Personnel ID {request.personnel_id} not found",
                request_id=request.request_id,
                personnel_id=request.personnel_id,
                zone_id=request.zone_id
            ))
            return
        
        if request.zone_id not in self.zone_rules.zones:
            result.add_violation(Violation(
                violation_type=ViolationType.MISSING_ZONE,
                severity=ViolationSeverity.HIGH,
                message=f"Zone ID {request.zone_id} not found",
                request_id=request.request_id,
                personnel_id=request.personnel_id,
                zone_id=request.zone_id
            ))
            return
        
        personnel = self.personnel[request.personnel_id]
        zone = self.zone_rules.zones[request.zone_id]
        
        self._validate_time_range(request, result)
        
        self._validate_role_permission(request, personnel, zone, result)
        
        self._validate_time_windows(request, zone, result)
        
        self._check_revoke_reissue(request, result)
        
        self._check_mutex_zones(request, personnel, zone, result)
        
        if result.is_valid:
            if request.personnel_id not in self.grant_history:
                self.grant_history[request.personnel_id] = {}
            if request.zone_id not in self.grant_history[request.personnel_id]:
                self.grant_history[request.personnel_id][request.zone_id] = []
            self.grant_history[request.personnel_id][request.zone_id].append(request)
    
    def _process_revoke_request(
        self,
        request: AccessRequest,
        result: ValidationResult
    ):
        if request.personnel_id not in self.personnel:
            result.add_violation(Violation(
                violation_type=ViolationType.MISSING_PERSONNEL,
                severity=ViolationSeverity.HIGH,
                message=f"Personnel ID {request.personnel_id} not found",
                request_id=request.request_id,
                personnel_id=request.personnel_id,
                zone_id=request.zone_id
            ))
            return
        
        if request.personnel_id not in self.revoke_history:
            self.revoke_history[request.personnel_id] = {}
        if request.zone_id not in self.revoke_history[request.personnel_id]:
            self.revoke_history[request.personnel_id][request.zone_id] = []
        self.revoke_history[request.personnel_id][request.zone_id].append(request)
    
    def _validate_time_range(
        self,
        request: AccessRequest,
        result: ValidationResult
    ):
        if request.start_time >= request.end_time:
            result.add_violation(Violation(
                violation_type=ViolationType.INVALID_TIME_RANGE,
                severity=ViolationSeverity.HIGH,
                message=f"Start time {request.start_time} must be before end time {request.end_time}",
                request_id=request.request_id,
                personnel_id=request.personnel_id,
                zone_id=request.zone_id
            ))
    
    def _validate_role_permission(
        self,
        request: AccessRequest,
        personnel: Personnel,
        zone: Zone,
        result: ValidationResult
    ):
        if personnel.role not in zone.allowed_roles:
            result.add_violation(Violation(
                violation_type=ViolationType.ROLE_NOT_ALLOWED,
                severity=ViolationSeverity.HIGH,
                message=f"Role '{personnel.role}' not allowed in zone '{zone.zone_name}'",
                request_id=request.request_id,
                personnel_id=request.personnel_id,
                zone_id=request.zone_id,
                details={
                    "allowed_roles": zone.allowed_roles,
                    "personnel_role": personnel.role
                }
            ))
    
    def _validate_time_windows(
        self,
        request: AccessRequest,
        zone: Zone,
        result: ValidationResult
    ):
        if not zone.time_windows:
            return
        
        request_start = request.start_time.time()
        request_end = request.end_time.time()
        request_start_day = request.start_time.weekday()
        request_end_day = request.end_time.weekday()
        
        windows_covered = []
        for window in zone.time_windows:
            window_days = window.get('days', [])
            window_start = self._parse_time_str(window.get('start_time', '00:00'))
            window_end = self._parse_time_str(window.get('end_time', '23:59'))
            
            if not window_days:
                window_days = list(range(7))
            
            if self._time_ranges_overlap(
                request_start, request_end,
                window_start, window_end
            ):
                for day in [request_start_day, request_end_day]:
                    if day in window_days:
                        windows_covered.append(window)
                        break
        
        if not windows_covered:
            result.add_violation(Violation(
                violation_type=ViolationType.TIME_WINDOW_VIOLATION,
                severity=ViolationSeverity.HIGH,
                message=f"Request time window not allowed in zone '{zone.zone_name}'",
                request_id=request.request_id,
                personnel_id=request.personnel_id,
                zone_id=request.zone_id,
                details={
                    "allowed_windows": zone.time_windows,
                    "request_window": {
                        "start": request.start_time.isoformat(),
                        "end": request.end_time.isoformat()
                    }
                }
            ))
    
    def _check_revoke_reissue(
        self,
        request: AccessRequest,
        result: ValidationResult
    ):
        personnel_id = request.personnel_id
        zone_id = request.zone_id
        
        if personnel_id in self.revoke_history:
            if zone_id in self.revoke_history[personnel_id]:
                revoke_count = len(self.revoke_history[personnel_id][zone_id])
                if revoke_count > 0:
                    result.add_violation(Violation(
                        violation_type=ViolationType.REVOKE_REISSUE_WARNING,
                        severity=ViolationSeverity.MEDIUM,
                        message=f"Personnel {personnel_id} was previously revoked from zone {zone_id} ({revoke_count} times). Re-issuing access.",
                        request_id=request.request_id,
                        personnel_id=personnel_id,
                        zone_id=zone_id,
                        details={
                            "revoke_count": revoke_count
                        }
                    ))
    
    def _check_mutex_zones(
        self,
        request: AccessRequest,
        personnel: Personnel,
        zone: Zone,
        result: ValidationResult
    ):
        if not zone.mutex_zones:
            return
        
        personnel_id = request.personnel_id
        
        if personnel_id not in self.grant_history:
            return
        
        for mutex_zone_id in zone.mutex_zones:
            if mutex_zone_id in self.grant_history.get(personnel_id, {}):
                grant_requests = self.grant_history[personnel_id][mutex_zone_id]
                for grant in grant_requests:
                    if self._time_ranges_overlap_datetime(
                        request.start_time, request.end_time,
                        grant.start_time, grant.end_time
                    ):
                        mutex_zone = self.zone_rules.zones.get(mutex_zone_id)
                        result.add_violation(Violation(
                            violation_type=ViolationType.MUTEX_ZONE_VIOLATION,
                            severity=ViolationSeverity.HIGH,
                            message=f"Zone '{zone.zone_name}' and '{mutex_zone.zone_name if mutex_zone else mutex_zone_id}' are mutually exclusive. Cannot have overlapping access.",
                            request_id=request.request_id,
                            personnel_id=personnel_id,
                            zone_id=request.zone_id,
                            details={
                                "mutex_zone": mutex_zone_id,
                                "overlapping_grant": {
                                    "request_id": grant.request_id,
                                    "start": grant.start_time.isoformat(),
                                    "end": grant.end_time.isoformat()
                                }
                            }
                        ))
    
    def _check_clock_drift(self, result: ValidationResult):
        for device_id, device in self.zone_rules.devices.items():
            if device_id not in self.device_clocks:
                result.add_violation(Violation(
                    violation_type=ViolationType.MISSING_DEVICE,
                    severity=ViolationSeverity.MEDIUM,
                    message=f"No clock data for device {device_id} ({device.device_name})",
                    device_id=device_id
                ))
                continue
            
            clock = self.device_clocks[device_id]
            threshold = device.clock_drift_threshold_seconds
            
            if abs(clock.drift_seconds) > threshold:
                result.add_violation(Violation(
                    violation_type=ViolationType.CLOCK_DRIFT_VIOLATION,
                    severity=ViolationSeverity.HIGH if abs(clock.drift_seconds) > threshold * 2 else ViolationSeverity.MEDIUM,
                    message=f"Device {device.device_name} clock drift exceeds threshold: {clock.drift_seconds:.2f}s (threshold: {threshold}s)",
                    device_id=device_id,
                    details={
                        "drift_seconds": clock.drift_seconds,
                        "threshold_seconds": threshold,
                        "device_time": clock.device_time.isoformat(),
                        "server_time": clock.server_time.isoformat()
                    }
                ))
    
    def _parse_time_str(self, time_str: str) -> time:
        parts = time_str.split(':')
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        second = int(parts[2]) if len(parts) > 2 else 0
        return time(hour, minute, second)
    
    def _time_ranges_overlap(
        self,
        start1: time, end1: time,
        start2: time, end2: time
    ) -> bool:
        start1_seconds = start1.hour * 3600 + start1.minute * 60 + start1.second
        end1_seconds = end1.hour * 3600 + end1.minute * 60 + end1.second
        start2_seconds = start2.hour * 3600 + start2.minute * 60 + start2.second
        end2_seconds = end2.hour * 3600 + end2.minute * 60 + end2.second
        
        return start1_seconds < end2_seconds and start2_seconds < end1_seconds
    
    def _time_ranges_overlap_datetime(
        self,
        start1: datetime, end1: datetime,
        start2: datetime, end2: datetime
    ) -> bool:
        return start1 < end2 and start2 < end1
