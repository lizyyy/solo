from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional
from enum import Enum


class IssueType(Enum):
    WARDROBE_CONTINUITY = "wardrobe_continuity"
    PROP_CONTINUITY = "prop_continuity"
    MAKEUP_HAIR_CONTINUITY = "makeup_hair_continuity"
    MISSING_SHOT = "missing_shot"
    MISSING_WARDROBE = "missing_wardrobe"
    MISSING_PROP = "missing_prop"
    RESHOOT_CONFLICT = "reshoot_conflict"
    ACTOR_AVAILABILITY = "actor_availability"
    ACTOR_MULTIPLE_BOOKING = "actor_multiple_booking"
    INCONSISTENT_ANNOTATION = "inconsistent_annotation"
    CALL_SHEET_MISMATCH = "call_sheet_mismatch"
    OTHER = "other"


class IssueSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class IssueStatus(Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


@dataclass
class Issue:
    issue_id: str
    issue_type: IssueType
    title: str = ""
    description: str = ""
    severity: IssueSeverity = IssueSeverity.MEDIUM
    status: IssueStatus = IssueStatus.OPEN
    scene_number: str = ""
    shot_number: str = ""
    shot_id: str = ""
    actor_id: str = ""
    wardrobe_ids: List[str] = field(default_factory=list)
    prop_ids: List[str] = field(default_factory=list)
    reshoot_id: str = ""
    call_sheet_id: str = ""
    related_issues: List[str] = field(default_factory=list)
    suggested_fix: str = ""
    notes: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolved_by: str = ""
    resolution_notes: str = ""
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.updated_at is None:
            self.updated_at = self.created_at
    
    def resolve(self, by: str, notes: str = ""):
        self.status = IssueStatus.RESOLVED
        self.resolved_by = by
        self.resolution_notes = notes
        self.resolved_at = datetime.now()
        self.updated_at = self.resolved_at
    
    def dismiss(self, by: str, reason: str = ""):
        self.status = IssueStatus.DISMISSED
        self.resolved_by = by
        self.resolution_notes = f"忽略原因: {reason}"
        self.resolved_at = datetime.now()
        self.updated_at = self.resolved_at
    
    def add_note(self, author: str, content: str):
        self.notes.append({
            "author": author,
            "content": content,
            "timestamp": datetime.now().isoformat()
        })
        self.updated_at = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_id": self.issue_id,
            "issue_type": self.issue_type.value,
            "title": self.title,
            "description": self.description,
            "severity": self.severity.value,
            "status": self.status.value,
            "scene_number": self.scene_number,
            "shot_number": self.shot_number,
            "shot_id": self.shot_id,
            "actor_id": self.actor_id,
            "wardrobe_ids": self.wardrobe_ids,
            "prop_ids": self.prop_ids,
            "reshoot_id": self.reshoot_id,
            "call_sheet_id": self.call_sheet_id,
            "related_issues": self.related_issues,
            "suggested_fix": self.suggested_fix,
            "notes": self.notes,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolved_by": self.resolved_by,
            "resolution_notes": self.resolution_notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Issue':
        return cls(
            issue_id=data["issue_id"],
            issue_type=IssueType(data.get("issue_type", "other")),
            title=data.get("title", ""),
            description=data.get("description", ""),
            severity=IssueSeverity(data.get("severity", "medium")),
            status=IssueStatus(data.get("status", "open")),
            scene_number=data.get("scene_number", ""),
            shot_number=data.get("shot_number", ""),
            shot_id=data.get("shot_id", ""),
            actor_id=data.get("actor_id", ""),
            wardrobe_ids=data.get("wardrobe_ids", []),
            prop_ids=data.get("prop_ids", []),
            reshoot_id=data.get("reshoot_id", ""),
            call_sheet_id=data.get("call_sheet_id", ""),
            related_issues=data.get("related_issues", []),
            suggested_fix=data.get("suggested_fix", ""),
            notes=data.get("notes", []),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None,
            resolved_at=datetime.fromisoformat(data["resolved_at"]) if data.get("resolved_at") else None,
            resolved_by=data.get("resolved_by", ""),
            resolution_notes=data.get("resolution_notes", "")
        )


@dataclass
class CheckResult:
    result_id: str
    issues: List[Issue] = field(default_factory=list)
    check_start_time: Optional[datetime] = None
    check_end_time: Optional[datetime] = None
    notes: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
    
    @property
    def total_issues(self) -> int:
        return len(self.issues)
    
    @property
    def open_issues(self) -> List[Issue]:
        return [i for i in self.issues if i.status == IssueStatus.OPEN]
    
    @property
    def critical_issues(self) -> List[Issue]:
        return [i for i in self.issues if i.severity == IssueSeverity.CRITICAL]
    
    @property
    def high_issues(self) -> List[Issue]:
        return [i for i in self.issues if i.severity == IssueSeverity.HIGH]
    
    @property
    def summary(self) -> Dict[str, Any]:
        by_type: Dict[str, int] = {}
        by_severity: Dict[str, int] = {}
        by_status: Dict[str, int] = {}
        by_scene: Dict[str, int] = {}
        
        for issue in self.issues:
            issue_type = issue.issue_type.value
            severity = issue.severity.value
            status = issue.status.value
            scene = issue.scene_number or "unknown"
            
            by_type[issue_type] = by_type.get(issue_type, 0) + 1
            by_severity[severity] = by_severity.get(severity, 0) + 1
            by_status[status] = by_status.get(status, 0) + 1
            by_scene[scene] = by_scene.get(scene, 0) + 1
        
        return {
            "total_issues": self.total_issues,
            "by_type": by_type,
            "by_severity": by_severity,
            "by_status": by_status,
            "by_scene": by_scene,
            "critical_issues": [
                {"issue_id": i.issue_id, "title": i.title, "scene_number": i.scene_number}
                for i in self.critical_issues
            ],
            "high_issues": [
                {"issue_id": i.issue_id, "title": i.title, "scene_number": i.scene_number}
                for i in self.high_issues
            ]
        }
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "result_id": self.result_id,
            "issues": [i.to_dict() for i in self.issues],
            "check_start_time": self.check_start_time.isoformat() if self.check_start_time else None,
            "check_end_time": self.check_end_time.isoformat() if self.check_end_time else None,
            "notes": self.notes,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "summary": self.summary
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CheckResult':
        issues = [Issue.from_dict(i) for i in data.get("issues", [])]
        return cls(
            result_id=data["result_id"],
            issues=issues,
            check_start_time=datetime.fromisoformat(data["check_start_time"]) if data.get("check_start_time") else None,
            check_end_time=datetime.fromisoformat(data["check_end_time"]) if data.get("check_end_time") else None,
            notes=data.get("notes", ""),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None
        )
