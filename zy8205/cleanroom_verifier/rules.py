from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict
from enum import Enum

from .parser import Room, PressureReading, AirflowSetpoint, DoorEvent
from .calculator import PressureGradient, ACHResult, DoorImpact


class IssueSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class IssueCategory(Enum):
    PRESSURE_GRADIENT = "pressure_gradient"
    ACH = "ach"
    SENSOR_MISSING = "sensor_missing"
    UNIT_MIXED = "unit_mixed"
    DOOR_IMPACT = "door_impact"
    DOOR_TRANSIENT = "door_transient"


@dataclass
class Issue:
    id: str
    category: IssueCategory
    severity: IssueSeverity
    room_id: str
    adjacent_room_id: Optional[str] = None
    message: str = ""
    expected: Optional[float] = None
    actual: Optional[float] = None
    unit: str = ""
    timestamp: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class RuleEngine:
    def __init__(
        self,
        pressure_tolerance: float = 2.0,
        ach_tolerance: float = 0.1,
        sensor_gap_threshold: int = 300,
        transient_threshold: float = 5.0
    ):
        self.pressure_tolerance = pressure_tolerance
        self.ach_tolerance = ach_tolerance
        self.sensor_gap_threshold = sensor_gap_threshold
        self.transient_threshold = transient_threshold
        self.issues: List[Issue] = []
        self._issue_counter = 0

    def _next_issue_id(self) -> str:
        self._issue_counter += 1
        return f"ISS-{self._issue_counter:04d}"

    def check_pressure_gradients(
        self,
        gradients: List[PressureGradient],
        rooms: Dict[str, Room]
    ) -> List[Issue]:
        issues = []
        
        for gradient in gradients:
            if not gradient.is_valid:
                issue = Issue(
                    id=self._next_issue_id(),
                    category=IssueCategory.PRESSURE_GRADIENT,
                    severity=IssueSeverity.HIGH,
                    room_id=gradient.room_id,
                    adjacent_room_id=gradient.adjacent_room_id,
                    message=f"无法计算 {gradient.room_id} 与 {gradient.adjacent_room_id} 之间的压差梯度（缺少数据）",
                    expected=gradient.required_diff,
                    actual=None,
                    unit=gradient.unit,
                    timestamp=gradient.timestamp
                )
                issues.append(issue)
                continue
            
            if gradient.measured_diff < (gradient.required_diff - self.pressure_tolerance):
                issue = Issue(
                    id=self._next_issue_id(),
                    category=IssueCategory.PRESSURE_GRADIENT,
                    severity=IssueSeverity.CRITICAL,
                    room_id=gradient.room_id,
                    adjacent_room_id=gradient.adjacent_room_id,
                    message=f"压差梯度不足: {gradient.room_id} 相对于 {gradient.adjacent_room_id} 的压差低于要求",
                    expected=gradient.required_diff,
                    actual=gradient.measured_diff,
                    unit=gradient.unit,
                    timestamp=gradient.timestamp,
                    metadata={
                        "tolerance": self.pressure_tolerance,
                        "deficit": gradient.required_diff - gradient.measured_diff
                    }
                )
                issues.append(issue)
            
            if gradient.measured_diff < 0:
                issue = Issue(
                    id=self._next_issue_id(),
                    category=IssueCategory.PRESSURE_GRADIENT,
                    severity=IssueSeverity.CRITICAL,
                    room_id=gradient.room_id,
                    adjacent_room_id=gradient.adjacent_room_id,
                    message=f"压差反转: {gradient.room_id} 的压力低于 {gradient.adjacent_room_id}",
                    expected=gradient.required_diff,
                    actual=gradient.measured_diff,
                    unit=gradient.unit,
                    timestamp=gradient.timestamp
                )
                issues.append(issue)
        
        return issues

    def check_ach(
        self,
        ach_results: List[ACHResult],
        rooms: Dict[str, Room]
    ) -> List[Issue]:
        issues = []
        
        for result in ach_results:
            if not result.is_valid:
                issue = Issue(
                    id=self._next_issue_id(),
                    category=IssueCategory.ACH,
                    severity=IssueSeverity.HIGH,
                    room_id=result.room_id,
                    message=f"无法计算 {result.room_id} 的换气次数（缺少数据或体积无效）",
                    expected=result.required_ach,
                    actual=None,
                    timestamp=None
                )
                issues.append(issue)
                continue
            
            min_ach = result.required_ach * (1 - self.ach_tolerance)
            
            if result.ach < min_ach:
                issue = Issue(
                    id=self._next_issue_id(),
                    category=IssueCategory.ACH,
                    severity=IssueSeverity.HIGH,
                    room_id=result.room_id,
                    message=f"换气次数不足: {result.room_id} 的 ACH 低于要求",
                    expected=result.required_ach,
                    actual=result.ach,
                    unit="ACH",
                    metadata={
                        "supply_air": result.supply_air,
                        "volume": result.volume,
                        "tolerance": self.ach_tolerance
                    }
                )
                issues.append(issue)
        
        return issues

    def check_sensor_gaps(
        self,
        readings: List[PressureReading],
        rooms: Dict[str, Room],
        time_window: Optional[timedelta] = None
    ) -> List[Issue]:
        issues = []
        
        readings_by_room: Dict[str, List[PressureReading]] = defaultdict(list)
        for reading in readings:
            readings_by_room[reading.room_id].append(reading)
        
        for room_id in rooms:
            room_readings = [r for r in readings_by_room.get(room_id, []) if r.is_valid]
            
            if not room_readings:
                issue = Issue(
                    id=self._next_issue_id(),
                    category=IssueCategory.SENSOR_MISSING,
                    severity=IssueSeverity.CRITICAL,
                    room_id=room_id,
                    message=f"房间 {room_id} 没有有效的压力读数",
                    timestamp=None
                )
                issues.append(issue)
                continue
            
            room_readings.sort(key=lambda x: x.timestamp)
            
            for i in range(1, len(room_readings)):
                prev = room_readings[i - 1]
                curr = room_readings[i]
                gap = (curr.timestamp - prev.timestamp).total_seconds()
                
                if gap > self.sensor_gap_threshold:
                    issue = Issue(
                        id=self._next_issue_id(),
                        category=IssueCategory.SENSOR_MISSING,
                        severity=IssueSeverity.MEDIUM,
                        room_id=room_id,
                        message=f"房间 {room_id} 的传感器读数存在 {int(gap)} 秒的间隙",
                        timestamp=prev.timestamp,
                        metadata={
                            "gap_seconds": int(gap),
                            "threshold": self.sensor_gap_threshold,
                            "prev_reading_time": prev.timestamp,
                            "next_reading_time": curr.timestamp
                        }
                    )
                    issues.append(issue)
        
        return issues

    def check_unit_consistency(
        self,
        readings: List[PressureReading]
    ) -> List[Issue]:
        issues = []
        
        units_used = set()
        for reading in readings:
            units_used.add(reading.unit.lower())
        
        if len(units_used) > 1:
            normalized_units = [u.lower() for u in units_used]
            has_pa = any(u in ['pa', 'pascal'] for u in normalized_units)
            has_inh2o = any(u in ['inh2o', 'in h2o', 'in.wc'] for u in normalized_units)
            
            if has_pa and has_inh2o:
                issue = Issue(
                    id=self._next_issue_id(),
                    category=IssueCategory.UNIT_MIXED,
                    severity=IssueSeverity.MEDIUM,
                    room_id="SYSTEM",
                    message=f"检测到压力单位混用: 使用了 Pa 和 inH2O 两种单位（已自动归一化）",
                    metadata={
                        "units_found": list(units_used),
                        "conversion_applied": True
                    }
                )
                issues.append(issue)
        
        return issues

    def check_door_impacts(
        self,
        door_impacts: List[DoorImpact]
    ) -> List[Issue]:
        issues = []
        
        for impact in door_impacts:
            if impact.is_transient:
                continue
            
            if impact.pressure_impact >= self.transient_threshold:
                issue = Issue(
                    id=self._next_issue_id(),
                    category=IssueCategory.DOOR_IMPACT,
                    severity=IssueSeverity.HIGH,
                    room_id=impact.room_id,
                    adjacent_room_id=impact.adjacent_room_id,
                    message=f"门开启对压差产生显著影响: {impact.room_id} 与 {impact.adjacent_room_id} 之间",
                    expected=0.0,
                    actual=impact.pressure_impact,
                    unit="Pa",
                    timestamp=impact.event_timestamp,
                    metadata={
                        "duration": impact.duration,
                        "pressure_before": impact.pressure_before,
                        "pressure_after": impact.pressure_after,
                        "threshold": self.transient_threshold
                    }
                )
                issues.append(issue)
        
        return issues

    def check_door_transients(
        self,
        door_impacts: List[DoorImpact]
    ) -> List[Issue]:
        issues = []
        transient_count = defaultdict(int)
        
        for impact in door_impacts:
            if impact.is_transient:
                transient_count[(impact.room_id, impact.adjacent_room_id)] += 1
        
        for (room_id, adjacent_id), count in transient_count.items():
            if count >= 3:
                issue = Issue(
                    id=self._next_issue_id(),
                    category=IssueCategory.DOOR_TRANSIENT,
                    severity=IssueSeverity.LOW,
                    room_id=room_id,
                    adjacent_room_id=adjacent_id,
                    message=f"检测到 {count} 次门开启瞬态变化（压力波动在阈值内，可能为正常操作）",
                    metadata={
                        "transient_count": count,
                        "threshold": self.transient_threshold
                    }
                )
                issues.append(issue)
        
        return issues

    def run_all_checks(
        self,
        rooms: Dict[str, Room],
        pressure_readings: List[PressureReading],
        pressure_gradients: List[PressureGradient],
        ach_results: List[ACHResult],
        door_impacts: List[DoorImpact]
    ) -> List[Issue]:
        all_issues = []
        
        all_issues.extend(self.check_pressure_gradients(pressure_gradients, rooms))
        all_issues.extend(self.check_ach(ach_results, rooms))
        all_issues.extend(self.check_sensor_gaps(pressure_readings, rooms))
        all_issues.extend(self.check_unit_consistency(pressure_readings))
        all_issues.extend(self.check_door_impacts(door_impacts))
        all_issues.extend(self.check_door_transients(door_impacts))
        
        self.issues = all_issues
        return all_issues

    def get_issues_by_severity(self) -> Dict[IssueSeverity, List[Issue]]:
        by_severity: Dict[IssueSeverity, List[Issue]] = defaultdict(list)
        for issue in self.issues:
            by_severity[issue.severity].append(issue)
        return dict(by_severity)

    def get_issues_by_category(self) -> Dict[IssueCategory, List[Issue]]:
        by_category: Dict[IssueCategory, List[Issue]] = defaultdict(list)
        for issue in self.issues:
            by_category[issue.category].append(issue)
        return dict(by_category)
