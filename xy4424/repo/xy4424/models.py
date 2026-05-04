from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional
from uuid import uuid4


class ValidationIssueType(Enum):
    DEVICE_OFFLINE = "device_offline"
    TEMPLATE_MISSING_FIELD = "template_missing_field"
    DETOUR_MISSING_STOP = "detour_missing_stop"
    DUPLICATE_SCHEDULE = "duplicate_schedule"
    WARNING = "warning"


class ValidationSeverity(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class ReleaseStatus(Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    PUBLISHED = "published"


@dataclass
class Device:
    device_id: str
    station_name: str
    station_id: str
    is_online: bool
    template_id: Optional[str] = None
    location: Optional[str] = None
    last_seen: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "device_id": self.device_id,
            "station_name": self.station_name,
            "station_id": self.station_id,
            "is_online": self.is_online,
            "template_id": self.template_id,
            "location": self.location,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Device':
        last_seen = None
        if data.get('last_seen'):
            last_seen = datetime.fromisoformat(data['last_seen'])
        return cls(
            device_id=data['device_id'],
            station_name=data['station_name'],
            station_id=data['station_id'],
            is_online=data.get('is_online', True),
            template_id=data.get('template_id'),
            location=data.get('location'),
            last_seen=last_seen
        )


@dataclass
class Schedule:
    schedule_id: str
    route_name: str
    route_id: str
    station_name: str
    station_id: str
    departure_time: str
    direction: str
    device_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "schedule_id": self.schedule_id,
            "route_name": self.route_name,
            "route_id": self.route_id,
            "station_name": self.station_name,
            "station_id": self.station_id,
            "departure_time": self.departure_time,
            "direction": self.direction,
            "device_id": self.device_id
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Schedule':
        return cls(
            schedule_id=data['schedule_id'],
            route_name=data['route_name'],
            route_id=data['route_id'],
            station_name=data['station_name'],
            station_id=data['station_id'],
            departure_time=data['departure_time'],
            direction=data['direction'],
            device_id=data.get('device_id')
        )


@dataclass
class Detour:
    detour_id: str
    route_id: str
    route_name: str
    effective_from: datetime
    effective_to: datetime
    affected_stations: List[str]
    detour_stations: List[str]
    reason: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "detour_id": self.detour_id,
            "route_id": self.route_id,
            "route_name": self.route_name,
            "effective_from": self.effective_from.isoformat(),
            "effective_to": self.effective_to.isoformat(),
            "affected_stations": self.affected_stations,
            "detour_stations": self.detour_stations,
            "reason": self.reason
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Detour':
        return cls(
            detour_id=data['detour_id'],
            route_id=data['route_id'],
            route_name=data['route_name'],
            effective_from=datetime.fromisoformat(data['effective_from']),
            effective_to=datetime.fromisoformat(data['effective_to']),
            affected_stations=data['affected_stations'],
            detour_stations=data['detour_stations'],
            reason=data['reason']
        )


@dataclass
class Template:
    template_id: str
    template_name: str
    required_fields: List[str]
    description: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "template_id": self.template_id,
            "template_name": self.template_name,
            "required_fields": self.required_fields,
            "description": self.description
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Template':
        return cls(
            template_id=data['template_id'],
            template_name=data['template_name'],
            required_fields=data['required_fields'],
            description=data.get('description', '')
        )


@dataclass
class ValidationIssue:
    issue_id: str
    issue_type: ValidationIssueType
    severity: ValidationSeverity
    message: str
    affected_devices: List[str] = field(default_factory=list)
    affected_stations: List[str] = field(default_factory=list)
    affected_routes: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_id": self.issue_id,
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "message": self.message,
            "affected_devices": self.affected_devices,
            "affected_stations": self.affected_stations,
            "affected_routes": self.affected_routes,
            "details": self.details
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ValidationIssue':
        return cls(
            issue_id=data['issue_id'],
            issue_type=ValidationIssueType(data['issue_type']),
            severity=ValidationSeverity(data['severity']),
            message=data['message'],
            affected_devices=data.get('affected_devices', []),
            affected_stations=data.get('affected_stations', []),
            affected_routes=data.get('affected_routes', []),
            details=data.get('details', {})
        )


@dataclass
class ReleaseItem:
    item_id: str
    device_id: str
    station_name: str
    route_name: str
    schedule_time: str
    template_id: str
    has_detour: bool = False
    detour_info: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "item_id": self.item_id,
            "device_id": self.device_id,
            "station_name": self.station_name,
            "route_name": self.route_name,
            "schedule_time": self.schedule_time,
            "template_id": self.template_id,
            "has_detour": self.has_detour,
            "detour_info": self.detour_info
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ReleaseItem':
        return cls(
            item_id=data['item_id'],
            device_id=data['device_id'],
            station_name=data['station_name'],
            route_name=data['route_name'],
            schedule_time=data['schedule_time'],
            template_id=data['template_id'],
            has_detour=data.get('has_detour', False),
            detour_info=data.get('detour_info')
        )


@dataclass
class ReviewComment:
    comment_id: str
    reviewer: str
    comment: str
    timestamp: datetime
    issue_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "comment_id": self.comment_id,
            "reviewer": self.reviewer,
            "comment": self.comment,
            "timestamp": self.timestamp.isoformat(),
            "issue_id": self.issue_id
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ReviewComment':
        return cls(
            comment_id=data['comment_id'],
            reviewer=data['reviewer'],
            comment=data['comment'],
            timestamp=datetime.fromisoformat(data['timestamp']),
            issue_id=data.get('issue_id')
        )


@dataclass
class Release:
    release_id: str
    release_name: str
    created_at: datetime
    created_by: str
    status: ReleaseStatus
    devices: List[Device] = field(default_factory=list)
    schedules: List[Schedule] = field(default_factory=list)
    detours: List[Detour] = field(default_factory=list)
    templates: List[Template] = field(default_factory=list)
    validation_issues: List[ValidationIssue] = field(default_factory=list)
    release_items: List[ReleaseItem] = field(default_factory=list)
    review_comments: List[ReviewComment] = field(default_factory=list)
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "release_id": self.release_id,
            "release_name": self.release_name,
            "created_at": self.created_at.isoformat(),
            "created_by": self.created_by,
            "status": self.status.value,
            "devices": [d.to_dict() for d in self.devices],
            "schedules": [s.to_dict() for s in self.schedules],
            "detours": [d.to_dict() for d in self.detours],
            "templates": [t.to_dict() for t in self.templates],
            "validation_issues": [i.to_dict() for i in self.validation_issues],
            "release_items": [r.to_dict() for r in self.release_items],
            "review_comments": [c.to_dict() for c in self.review_comments],
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "approved_by": self.approved_by
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Release':
        return cls(
            release_id=data['release_id'],
            release_name=data['release_name'],
            created_at=datetime.fromisoformat(data['created_at']),
            created_by=data['created_by'],
            status=ReleaseStatus(data['status']),
            devices=[Device.from_dict(d) for d in data.get('devices', [])],
            schedules=[Schedule.from_dict(s) for s in data.get('schedules', [])],
            detours=[Detour.from_dict(d) for d in data.get('detours', [])],
            templates=[Template.from_dict(t) for t in data.get('templates', [])],
            validation_issues=[ValidationIssue.from_dict(i) for i in data.get('validation_issues', [])],
            release_items=[ReleaseItem.from_dict(r) for r in data.get('release_items', [])],
            review_comments=[ReviewComment.from_dict(c) for c in data.get('review_comments', [])],
            approved_at=datetime.fromisoformat(data['approved_at']) if data.get('approved_at') else None,
            approved_by=data.get('approved_by')
        )


def generate_id() -> str:
    return str(uuid4())
