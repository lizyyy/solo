from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Tuple, Set, Any
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import ISSUE_DETECTION_CONFIG
from models.risk_level import RiskLevel


class IssueType(Enum):
    TIME_REVERSAL = "时间倒挂"
    MISSING_KEY_NODE = "关键节点缺失"
    CONSECUTIVE_HIGH_RISK = "连续高风险事件"
    PHOTO_NOT_REFERENCED = "照片编号未引用"
    TIME_GAP = "时间间隙异常"
    DUPLICATE_EVENT = "可能重复事件"
    INVALID_TIME_OFFSET = "时间偏移异常"
    
    def __str__(self) -> str:
        return self.value


class IssueSeverity(Enum):
    CRITICAL = "严重"
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"
    
    def __str__(self) -> str:
        return self.value


class IssueStatus(Enum):
    NEW = "新发现"
    REVIEWING = "审查中"
    CONFIRMED = "已确认"
    RESOLVED = "已解决"
    IGNORED = "已忽略"
    
    def __str__(self) -> str:
        return self.value


@dataclass
class Issue:
    id: Optional[int] = None
    drill_id: Optional[int] = None
    
    issue_type: IssueType = IssueType.TIME_REVERSAL
    severity: IssueSeverity = IssueSeverity.MEDIUM
    status: IssueStatus = IssueStatus.NEW
    
    title: str = ""
    description: str = ""
    
    related_event_ids: List[int] = field(default_factory=list)
    related_area_codes: List[str] = field(default_factory=list)
    related_sources: List[str] = field(default_factory=list)
    
    detected_at: datetime = field(default_factory=datetime.now)
    resolved_at: Optional[datetime] = None
    resolved_by: str = ""
    resolution_notes: str = ""
    
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if isinstance(self.issue_type, str):
            try:
                self.issue_type = IssueType(self.issue_type)
            except ValueError:
                self.issue_type = IssueType.TIME_REVERSAL
        
        if isinstance(self.severity, str):
            try:
                self.severity = IssueSeverity(self.severity)
            except ValueError:
                self.severity = IssueSeverity.MEDIUM
        
        if isinstance(self.status, str):
            try:
                self.status = IssueStatus(self.status)
            except ValueError:
                self.status = IssueStatus.NEW
        
        if isinstance(self.detected_at, str):
            try:
                self.detected_at = datetime.fromisoformat(self.detected_at)
            except (ValueError, TypeError):
                self.detected_at = datetime.now()
        
        if isinstance(self.resolved_at, str):
            try:
                self.resolved_at = datetime.fromisoformat(self.resolved_at)
            except (ValueError, TypeError):
                self.resolved_at = None
        
        for field_name in ['related_event_ids', 'related_area_codes', 'related_sources']:
            value = getattr(self, field_name)
            if isinstance(value, str):
                try:
                    import json
                    setattr(self, field_name, json.loads(value))
                except (ValueError, TypeError):
                    setattr(self, field_name, [])
    
    def to_dict(self) -> Dict[str, Any]:
        def serialize_dt(dt: Optional[datetime]) -> Optional[str]:
            return dt.isoformat() if dt else None
        
        return {
            'id': self.id,
            'drill_id': self.drill_id,
            'issue_type': self.issue_type.value,
            'severity': self.severity.value,
            'status': self.status.value,
            'title': self.title,
            'description': self.description,
            'related_event_ids': self.related_event_ids,
            'related_area_codes': self.related_area_codes,
            'related_sources': self.related_sources,
            'detected_at': serialize_dt(self.detected_at),
            'resolved_at': serialize_dt(self.resolved_at),
            'resolved_by': self.resolved_by,
            'resolution_notes': self.resolution_notes,
            'metadata': self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Issue':
        return cls(
            id=data.get('id'),
            drill_id=data.get('drill_id'),
            issue_type=data.get('issue_type', IssueType.TIME_REVERSAL),
            severity=data.get('severity', IssueSeverity.MEDIUM),
            status=data.get('status', IssueStatus.NEW),
            title=data.get('title', ''),
            description=data.get('description', ''),
            related_event_ids=data.get('related_event_ids', []),
            related_area_codes=data.get('related_area_codes', []),
            related_sources=data.get('related_sources', []),
            detected_at=data.get('detected_at'),
            resolved_at=data.get('resolved_at'),
            resolved_by=data.get('resolved_by', ''),
            resolution_notes=data.get('resolution_notes', ''),
            metadata=data.get('metadata', {}),
        )
    
    def __str__(self) -> str:
        return f"[{self.severity}] {self.issue_type}: {self.title}"


@dataclass
class DetectionResult:
    total_issues: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    issues: List[Issue] = field(default_factory=list)
    statistics: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'total_issues': self.total_issues,
            'critical_count': self.critical_count,
            'high_count': self.high_count,
            'medium_count': self.medium_count,
            'low_count': self.low_count,
            'issues_count': len(self.issues),
            'statistics': self.statistics,
        }


class IssueDetector:
    def __init__(
        self,
        time_gap_warning_minutes: int = None,
        consecutive_high_risk_count: int = None,
        check_key_nodes: bool = None,
        key_node_codes: Optional[List[str]] = None,
    ):
        config = ISSUE_DETECTION_CONFIG
        self.time_gap_warning_minutes = time_gap_warning_minutes or config.get('time_gap_warning_minutes', 5)
        self.consecutive_high_risk_count = consecutive_high_risk_count or config.get('consecutive_high_risk_count', 2)
        self.check_key_nodes = check_key_nodes if check_key_nodes is not None else config.get('check_key_nodes', True)
        self.key_node_codes = key_node_codes or [
            'ALARM_START',
            'EVAC_START',
            'EVAC_COMPLETE',
            'ASSEMBLY_COUNT',
            'DRILL_END',
        ]
    
    def _get_event_time(self, event) -> Optional[datetime]:
        if hasattr(event, 'unified_time') and event.unified_time:
            return event.unified_time
        if hasattr(event, 'original_time') and event.original_time:
            return event.original_time
        return None
    
    def _get_event_id(self, event) -> Optional[int]:
        return getattr(event, 'id', None)
    
    def _get_event_area(self, event) -> str:
        return getattr(event, 'area_code', '') or getattr(event, 'area', '') or ''
    
    def _get_event_source(self, event) -> str:
        return getattr(event, 'source', '') or ''
    
    def _get_event_type_code(self, event) -> str:
        return getattr(event, 'event_type_code', '') or getattr(event, 'event_type', '') or ''
    
    def _get_event_risk_level(self, event) -> RiskLevel:
        rl = getattr(event, 'risk_level', RiskLevel.LOW)
        if isinstance(rl, str):
            return RiskLevel.from_string(rl) or RiskLevel.LOW
        return rl
    
    def _get_event_photo_numbers(self, event) -> List[str]:
        return getattr(event, 'photo_numbers', []) or []
    
    def detect_time_reversal(self, events: List) -> List[Issue]:
        issues: List[Issue] = []
        
        if len(events) < 2:
            return issues
        
        sorted_events = sorted(
            events,
            key=lambda e: self._get_event_time(e) or datetime.min
        )
        
        prev_time = None
        prev_event = None
        
        for event in sorted_events:
            current_time = self._get_event_time(event)
            
            if current_time and prev_time:
                if current_time < prev_time:
                    time_diff = (prev_time - current_time).total_seconds()
                    
                    issue = Issue(
                        issue_type=IssueType.TIME_REVERSAL,
                        severity=IssueSeverity.HIGH,
                        title="时间顺序异常",
                        description=f"检测到时间倒挂现象。前一事件时间 {prev_time.strftime('%H:%M:%S')}，当前事件时间 {current_time.strftime('%H:%M:%S')}，时间差 {time_diff:.0f} 秒。",
                        related_event_ids=[
                            self._get_event_id(prev_event),
                            self._get_event_id(event),
                        ],
                        related_area_codes=[
                            self._get_event_area(prev_event),
                            self._get_event_area(event),
                        ],
                        related_sources=[
                            self._get_event_source(prev_event),
                            self._get_event_source(event),
                        ],
                        metadata={
                            'previous_time': prev_time.isoformat(),
                            'current_time': current_time.isoformat(),
                            'time_difference_seconds': time_diff,
                        }
                    )
                    issues.append(issue)
            
            if current_time:
                prev_time = current_time
                prev_event = event
        
        return issues
    
    def detect_time_gaps(self, events: List) -> List[Issue]:
        issues: List[Issue] = []
        
        if len(events) < 2:
            return issues
        
        sorted_events = sorted(
            events,
            key=lambda e: self._get_event_time(e) or datetime.min
        )
        
        prev_time = None
        prev_event = None
        gap_threshold = timedelta(minutes=self.time_gap_warning_minutes)
        
        for event in sorted_events:
            current_time = self._get_event_time(event)
            
            if current_time and prev_time:
                gap = current_time - prev_time
                if gap > gap_threshold:
                    gap_minutes = gap.total_seconds() / 60
                    
                    issue = Issue(
                        issue_type=IssueType.TIME_GAP,
                        severity=IssueSeverity.LOW,
                        title="时间间隙异常",
                        description=f"检测到较长时间间隙。前一事件时间 {prev_time.strftime('%H:%M:%S')}，当前事件时间 {current_time.strftime('%H:%M:%S')}，间隙 {gap_minutes:.1f} 分钟。",
                        related_event_ids=[
                            self._get_event_id(prev_event),
                            self._get_event_id(event),
                        ],
                        related_area_codes=[
                            self._get_event_area(prev_event),
                            self._get_event_area(event),
                        ],
                        related_sources=[
                            self._get_event_source(prev_event),
                            self._get_event_source(event),
                        ],
                        metadata={
                            'previous_time': prev_time.isoformat(),
                            'current_time': current_time.isoformat(),
                            'gap_minutes': gap_minutes,
                            'threshold_minutes': self.time_gap_warning_minutes,
                        }
                    )
                    issues.append(issue)
            
            if current_time:
                prev_time = current_time
                prev_event = event
        
        return issues
    
    def detect_missing_key_nodes(self, events: List) -> List[Issue]:
        issues: List[Issue] = []
        
        if not self.check_key_nodes or not self.key_node_codes:
            return issues
        
        present_node_codes = set()
        for event in events:
            et_code = self._get_event_type_code(event)
            if et_code in self.key_node_codes:
                present_node_codes.add(et_code)
        
        missing_codes = set(self.key_node_codes) - present_node_codes
        
        for code in missing_codes:
            issue = Issue(
                issue_type=IssueType.MISSING_KEY_NODE,
                severity=IssueSeverity.CRITICAL,
                title="关键节点缺失",
                description=f"检测到关键事件类型缺失: {code}。该节点是标准时间轴中的重要节点，请确认是否遗漏记录。",
                related_area_codes=[],
                related_sources=[],
                metadata={
                    'missing_event_type_code': code,
                    'key_node_codes': self.key_node_codes,
                    'present_node_codes': list(present_node_codes),
                }
            )
            issues.append(issue)
        
        return issues
    
    def detect_consecutive_high_risk(self, events: List) -> List[Issue]:
        issues: List[Issue] = []
        
        if len(events) < 2:
            return issues
        
        sorted_events = sorted(
            events,
            key=lambda e: self._get_event_time(e) or datetime.min
        )
        
        high_risk_levels = {RiskLevel.HIGH, RiskLevel.CRITICAL}
        
        consecutive_count = 0
        consecutive_events: List = []
        
        for event in sorted_events:
            risk_level = self._get_event_risk_level(event)
            
            if risk_level in high_risk_levels:
                consecutive_count += 1
                consecutive_events.append(event)
                
                if consecutive_count >= self.consecutive_high_risk_count:
                    issue = Issue(
                        issue_type=IssueType.CONSECUTIVE_HIGH_RISK,
                        severity=IssueSeverity.HIGH,
                        title="连续高风险事件",
                        description=f"检测到连续 {consecutive_count} 个高风险/紧急事件。从 {self._get_event_time(consecutive_events[0]).strftime('%H:%M:%S') if self._get_event_time(consecutive_events[0]) else '未知时间'} 开始，涉及区域: {', '.join(set(self._get_event_area(e) for e in consecutive_events))}。",
                        related_event_ids=[self._get_event_id(e) for e in consecutive_events],
                        related_area_codes=list(set(self._get_event_area(e) for e in consecutive_events)),
                        related_sources=list(set(self._get_event_source(e) for e in consecutive_events)),
                        metadata={
                            'consecutive_count': consecutive_count,
                            'threshold': self.consecutive_high_risk_count,
                            'risk_levels': [str(self._get_event_risk_level(e)) for e in consecutive_events],
                        }
                    )
                    issues.append(issue)
            else:
                consecutive_count = 0
                consecutive_events = []
        
        return issues
    
    def detect_unreferenced_photos(self, events: List) -> List[Issue]:
        issues: List[Issue] = []
        
        if not events:
            return issues
        
        all_photo_numbers: Set[str] = set()
        photo_to_events: Dict[str, List] = {}
        
        for event in events:
            photos = self._get_event_photo_numbers(event)
            for photo in photos:
                normalized = str(photo).strip().upper()
                if normalized:
                    all_photo_numbers.add(normalized)
                    if normalized not in photo_to_events:
                        photo_to_events[normalized] = []
                    photo_to_events[normalized].append(event)
        
        referenced_photos: Set[str] = set()
        for event in events:
            desc = getattr(event, 'description', '') or ''
            notes = getattr(event, 'notes', '') or ''
            combined = (desc + ' ' + notes).upper()
            
            for photo in all_photo_numbers:
                if photo in combined:
                    referenced_photos.add(photo)
        
        unreferenced = all_photo_numbers - referenced_photos
        
        if unreferenced:
            unreferenced_list = sorted(unreferenced)
            
            related_event_ids = []
            related_areas = set()
            related_sources = set()
            
            for photo in unreferenced:
                for event in photo_to_events.get(photo, []):
                    eid = self._get_event_id(event)
                    if eid and eid not in related_event_ids:
                        related_event_ids.append(eid)
                    related_areas.add(self._get_event_area(event))
                    related_sources.add(self._get_event_source(event))
            
            issue = Issue(
                issue_type=IssueType.PHOTO_NOT_REFERENCED,
                severity=IssueSeverity.LOW,
                title="照片编号未引用",
                description=f"检测到 {len(unreferenced)} 个照片编号在事件描述或备注中未被引用: {', '.join(unreferenced_list[:10])}{'...' if len(unreferenced_list) > 10 else ''}。",
                related_event_ids=related_event_ids,
                related_area_codes=list(related_areas),
                related_sources=list(related_sources),
                metadata={
                    'unreferenced_photos': unreferenced_list,
                    'total_photos': len(all_photo_numbers),
                    'referenced_count': len(referenced_photos),
                }
            )
            issues.append(issue)
        
        return issues
    
    def detect_all(
        self,
        events: List,
        check_time_reversal: bool = True,
        check_time_gaps: bool = True,
        check_missing_key_nodes: bool = True,
        check_consecutive_high_risk: bool = True,
        check_unreferenced_photos: bool = True,
    ) -> DetectionResult:
        result = DetectionResult()
        all_issues: List[Issue] = []
        
        if check_time_reversal:
            issues = self.detect_time_reversal(events)
            all_issues.extend(issues)
        
        if check_time_gaps:
            issues = self.detect_time_gaps(events)
            all_issues.extend(issues)
        
        if check_missing_key_nodes and self.check_key_nodes:
            issues = self.detect_missing_key_nodes(events)
            all_issues.extend(issues)
        
        if check_consecutive_high_risk:
            issues = self.detect_consecutive_high_risk(events)
            all_issues.extend(issues)
        
        if check_unreferenced_photos:
            issues = self.detect_unreferenced_photos(events)
            all_issues.extend(issues)
        
        result.issues = all_issues
        result.total_issues = len(all_issues)
        
        for issue in all_issues:
            if issue.severity == IssueSeverity.CRITICAL:
                result.critical_count += 1
            elif issue.severity == IssueSeverity.HIGH:
                result.high_count += 1
            elif issue.severity == IssueSeverity.MEDIUM:
                result.medium_count += 1
            elif issue.severity == IssueSeverity.LOW:
                result.low_count += 1
        
        issue_type_counts: Dict[str, int] = {}
        for issue in all_issues:
            itype = str(issue.issue_type)
            issue_type_counts[itype] = issue_type_counts.get(itype, 0) + 1
        
        result.statistics = {
            'issue_type_counts': issue_type_counts,
            'total_events_analyzed': len(events),
        }
        
        return result
