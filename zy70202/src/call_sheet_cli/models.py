from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from enum import Enum


class ConflictType(Enum):
    ACTOR_TIME_CONFLICT = "演员时间冲突"
    VEHICLE_TIME_CONFLICT = "车辆时间冲突"
    SCENE_LOCATION_CONFLICT = "场景地点冲突"
    VERSION_CHANGE = "版本变更"


class IssueType(Enum):
    MISSING_REQUIRED_FIELD = "缺少必填字段"
    INVALID_TIME_FORMAT = "时间格式无效"
    INVALID_DATE_FORMAT = "日期格式无效"
    DUPLICATE_ENTRY = "重复条目"
    REFERENCE_NOT_FOUND = "引用不存在"
    VALUE_OUT_OF_RANGE = "数值超出范围"


class IssueSeverity(Enum):
    ERROR = "错误"
    WARNING = "警告"


@dataclass
class Actor:
    name: str
    role: str = ""
    call_time: Optional[datetime] = None
    wrap_time: Optional[datetime] = None
    scenes: List[str] = field(default_factory=list)
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "role": self.role,
            "call_time": self.call_time.isoformat() if self.call_time else None,
            "wrap_time": self.wrap_time.isoformat() if self.wrap_time else None,
            "scenes": self.scenes,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Actor":
        return cls(
            name=data["name"],
            role=data.get("role", ""),
            call_time=datetime.fromisoformat(data["call_time"]) if data.get("call_time") else None,
            wrap_time=datetime.fromisoformat(data["wrap_time"]) if data.get("wrap_time") else None,
            scenes=data.get("scenes", []),
            notes=data.get("notes", ""),
        )


@dataclass
class Vehicle:
    id: str
    type: str
    driver: str = ""
    usage: str = ""
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "driver": self.driver,
            "usage": self.usage,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Vehicle":
        return cls(
            id=data["id"],
            type=data["type"],
            driver=data.get("driver", ""),
            usage=data.get("usage", ""),
            start_time=datetime.fromisoformat(data["start_time"]) if data.get("start_time") else None,
            end_time=datetime.fromisoformat(data["end_time"]) if data.get("end_time") else None,
            notes=data.get("notes", ""),
        )


@dataclass
class Scene:
    number: str
    location: str
    description: str = ""
    shoot_date: Optional[date] = None
    call_time: Optional[datetime] = None
    wrap_time: Optional[datetime] = None
    actors: List[str] = field(default_factory=list)
    vehicles: List[str] = field(default_factory=list)
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "number": self.number,
            "location": self.location,
            "description": self.description,
            "shoot_date": self.shoot_date.isoformat() if self.shoot_date else None,
            "call_time": self.call_time.isoformat() if self.call_time else None,
            "wrap_time": self.wrap_time.isoformat() if self.wrap_time else None,
            "actors": self.actors,
            "vehicles": self.vehicles,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Scene":
        return cls(
            number=data["number"],
            location=data["location"],
            description=data.get("description", ""),
            shoot_date=date.fromisoformat(data["shoot_date"]) if data.get("shoot_date") else None,
            call_time=datetime.fromisoformat(data["call_time"]) if data.get("call_time") else None,
            wrap_time=datetime.fromisoformat(data["wrap_time"]) if data.get("wrap_time") else None,
            actors=data.get("actors", []),
            vehicles=data.get("vehicles", []),
            notes=data.get("notes", ""),
        )


@dataclass
class Issue:
    issue_type: IssueType
    severity: IssueSeverity
    message: str
    source: str
    field: Optional[str] = None
    value: Optional[str] = None
    line_number: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "message": self.message,
            "source": self.source,
            "field": self.field,
            "value": self.value,
            "line_number": self.line_number,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Issue":
        return cls(
            issue_type=IssueType(data["issue_type"]),
            severity=IssueSeverity(data["severity"]),
            message=data["message"],
            source=data["source"],
            field=data.get("field"),
            value=data.get("value"),
            line_number=data.get("line_number"),
        )


@dataclass
class Conflict:
    conflict_type: ConflictType
    description: str
    affected_items: List[str]
    version_from: Optional[str] = None
    version_to: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_type": self.conflict_type.value,
            "description": self.description,
            "affected_items": self.affected_items,
            "version_from": self.version_from,
            "version_to": self.version_to,
            "details": self.details,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Conflict":
        return cls(
            conflict_type=ConflictType(data["conflict_type"]),
            description=data["description"],
            affected_items=data["affected_items"],
            version_from=data.get("version_from"),
            version_to=data.get("version_to"),
            details=data.get("details", {}),
        )


@dataclass
class CallSheetVersion:
    version: str
    shoot_date: date
    imported_at: datetime
    source_file: str
    scenes: List[Scene] = field(default_factory=list)
    actors: List[Actor] = field(default_factory=list)
    vehicles: List[Vehicle] = field(default_factory=list)
    notes: str = ""
    issues: List[Issue] = field(default_factory=list)
    conflicts: List[Conflict] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "shoot_date": self.shoot_date.isoformat(),
            "imported_at": self.imported_at.isoformat(),
            "source_file": self.source_file,
            "scenes": [s.to_dict() for s in self.scenes],
            "actors": [a.to_dict() for a in self.actors],
            "vehicles": [v.to_dict() for v in self.vehicles],
            "notes": self.notes,
            "issues": [i.to_dict() for i in self.issues],
            "conflicts": [c.to_dict() for c in self.conflicts],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CallSheetVersion":
        return cls(
            version=data["version"],
            shoot_date=date.fromisoformat(data["shoot_date"]),
            imported_at=datetime.fromisoformat(data["imported_at"]),
            source_file=data["source_file"],
            scenes=[Scene.from_dict(s) for s in data.get("scenes", [])],
            actors=[Actor.from_dict(a) for a in data.get("actors", [])],
            vehicles=[Vehicle.from_dict(v) for v in data.get("vehicles", [])],
            notes=data.get("notes", ""),
            issues=[Issue.from_dict(i) for i in data.get("issues", [])],
            conflicts=[Conflict.from_dict(c) for c in data.get("conflicts", [])],
        )


@dataclass
class VersionDiff:
    version_from: str
    version_to: str
    shoot_date: date
    scenes_added: List[Scene] = field(default_factory=list)
    scenes_removed: List[Scene] = field(default_factory=list)
    scenes_modified: List[Dict[str, Any]] = field(default_factory=list)
    actors_added: List[Actor] = field(default_factory=list)
    actors_removed: List[Actor] = field(default_factory=list)
    actors_modified: List[Dict[str, Any]] = field(default_factory=list)
    vehicles_added: List[Vehicle] = field(default_factory=list)
    vehicles_removed: List[Vehicle] = field(default_factory=list)
    vehicles_modified: List[Dict[str, Any]] = field(default_factory=list)

    def has_changes(self) -> bool:
        return any([
            self.scenes_added, self.scenes_removed, self.scenes_modified,
            self.actors_added, self.actors_removed, self.actors_modified,
            self.vehicles_added, self.vehicles_removed, self.vehicles_modified,
        ])

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version_from": self.version_from,
            "version_to": self.version_to,
            "shoot_date": self.shoot_date.isoformat(),
            "scenes_added": [s.to_dict() for s in self.scenes_added],
            "scenes_removed": [s.to_dict() for s in self.scenes_removed],
            "scenes_modified": self.scenes_modified,
            "actors_added": [a.to_dict() for a in self.actors_added],
            "actors_removed": [a.to_dict() for a in self.actors_removed],
            "actors_modified": self.actors_modified,
            "vehicles_added": [v.to_dict() for v in self.vehicles_added],
            "vehicles_removed": [v.to_dict() for v in self.vehicles_removed],
            "vehicles_modified": self.vehicles_modified,
        }


@dataclass
class ProjectState:
    project_name: str
    shoot_dates: Dict[str, List[str]] = field(default_factory=dict)
    versions: Dict[str, CallSheetVersion] = field(default_factory=dict)
    all_issues: List[Issue] = field(default_factory=list)
    all_conflicts: List[Conflict] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "project_name": self.project_name,
            "shoot_dates": self.shoot_dates,
            "versions": {k: v.to_dict() for k, v in self.versions.items()},
            "all_issues": [i.to_dict() for i in self.all_issues],
            "all_conflicts": [c.to_dict() for c in self.all_conflicts],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProjectState":
        return cls(
            project_name=data["project_name"],
            shoot_dates=data.get("shoot_dates", {}),
            versions={k: CallSheetVersion.from_dict(v) for k, v in data.get("versions", {}).items()},
            all_issues=[Issue.from_dict(i) for i in data.get("all_issues", [])],
            all_conflicts=[Conflict.from_dict(c) for c in data.get("all_conflicts", [])],
        )
