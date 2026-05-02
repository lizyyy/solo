import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class ConflictType(Enum):
    HASH_CONFLICT = "hash_conflict"
    MISSING_ATTACHMENT = "missing_attachment"
    TIME_ORDER_ISSUE = "time_order_issue"
    COORDINATE_ISSUE = "coordinate_issue"
    DUPLICATE_POINT = "duplicate_point"
    NAME_COLLISION = "name_collision"


class ResolutionAction(Enum):
    KEEP = "keep"
    ISOLATE = "isolate"
    RENAME = "rename"
    MERGE = "merge"
    DELETE = "delete"
    PENDING = "pending"


class ResolutionStatus(Enum):
    UNRESOLVED = "unresolved"
    RESOLVED = "resolved"
    REVIEW_REQUIRED = "review_required"
    AUTO_RESOLVED = "auto_resolved"


@dataclass
class ConflictItem:
    conflict_id: str
    conflict_type: ConflictType
    severity: str
    source_packages: List[str]
    affected_items: List[Dict[str, Any]]
    message: str
    action: ResolutionAction = ResolutionAction.PENDING
    status: ResolutionStatus = ResolutionStatus.UNRESOLVED
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_id": self.conflict_id,
            "conflict_type": self.conflict_type.value,
            "severity": self.severity,
            "source_packages": self.source_packages,
            "affected_items": self.affected_items,
            "message": self.message,
            "action": self.action.value,
            "status": self.status.value,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolved_by": self.resolved_by,
            "resolution_notes": self.resolution_notes,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConflictItem":
        return cls(
            conflict_id=data["conflict_id"],
            conflict_type=ConflictType(data["conflict_type"]),
            severity=data["severity"],
            source_packages=data.get("source_packages", []),
            affected_items=data.get("affected_items", []),
            message=data["message"],
            action=ResolutionAction(data.get("action", "pending")),
            status=ResolutionStatus(data.get("status", "unresolved")),
            resolved_at=datetime.fromisoformat(data["resolved_at"])
            if data.get("resolved_at")
            else None,
            resolved_by=data.get("resolved_by"),
            resolution_notes=data.get("resolution_notes"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class MergePlan:
    plan_id: str
    created_at: datetime
    source_packages: List[str]
    total_files: int
    unique_files: int
    conflicts: List[ConflictItem] = field(default_factory=list)
    files_to_copy: List[Dict[str, Any]] = field(default_factory=list)
    files_to_isolate: List[Dict[str, Any]] = field(default_factory=list)
    files_to_rename: List[Dict[str, Any]] = field(default_factory=list)
    dry_run: bool = True
    summary: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plan_id": self.plan_id,
            "created_at": self.created_at.isoformat(),
            "source_packages": self.source_packages,
            "total_files": self.total_files,
            "unique_files": self.unique_files,
            "conflicts": [c.to_dict() for c in self.conflicts],
            "files_to_copy": self.files_to_copy,
            "files_to_isolate": self.files_to_isolate,
            "files_to_rename": self.files_to_rename,
            "dry_run": self.dry_run,
            "summary": self.summary,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MergePlan":
        return cls(
            plan_id=data["plan_id"],
            created_at=datetime.fromisoformat(data["created_at"]),
            source_packages=data.get("source_packages", []),
            total_files=data.get("total_files", 0),
            unique_files=data.get("unique_files", 0),
            conflicts=[ConflictItem.from_dict(c) for c in data.get("conflicts", [])],
            files_to_copy=data.get("files_to_copy", []),
            files_to_isolate=data.get("files_to_isolate", []),
            files_to_rename=data.get("files_to_rename", []),
            dry_run=data.get("dry_run", True),
            summary=data.get("summary", {}),
        )


class ConflictManager:
    def __init__(self):
        self._conflicts: Dict[str, ConflictItem] = {}
        self._counter = 0

    def _generate_conflict_id(self, conflict_type: ConflictType) -> str:
        self._counter += 1
        return f"{conflict_type.value}_{self._counter:06d}"

    def add_hash_conflict(
        self,
        file_name: str,
        files: List[Dict[str, Any]],
        conflict_type: str,
        message: str,
    ) -> ConflictItem:
        conflict_id = self._generate_conflict_id(ConflictType.HASH_CONFLICT)
        source_packages = list({f.get("source_package", "unknown") for f in files})

        conflict = ConflictItem(
            conflict_id=conflict_id,
            conflict_type=ConflictType.HASH_CONFLICT,
            severity="high" if conflict_type == "hash_mismatch" else "low",
            source_packages=source_packages,
            affected_items=files,
            message=message,
            metadata={
                "file_name": file_name,
                "hash_conflict_type": conflict_type,
            },
        )

        self._conflicts[conflict_id] = conflict
        return conflict

    def add_missing_attachment(
        self,
        point_id: str,
        attachment_reference: str,
        source_package: str,
        search_paths: List[str],
        message: str,
    ) -> ConflictItem:
        conflict_id = self._generate_conflict_id(ConflictType.MISSING_ATTACHMENT)

        conflict = ConflictItem(
            conflict_id=conflict_id,
            conflict_type=ConflictType.MISSING_ATTACHMENT,
            severity="medium",
            source_packages=[source_package],
            affected_items=[
                {
                    "point_id": point_id,
                    "attachment_reference": attachment_reference,
                    "search_paths": search_paths,
                }
            ],
            message=message,
            metadata={
                "point_id": point_id,
                "attachment_reference": attachment_reference,
            },
        )

        self._conflicts[conflict_id] = conflict
        return conflict

    def add_time_order_issue(
        self,
        track_name: str,
        segment_index: int,
        point_index: int,
        previous_time: Optional[datetime],
        current_time: Optional[datetime],
        time_delta_seconds: Optional[float],
        source_package: str,
        message: str,
    ) -> ConflictItem:
        conflict_id = self._generate_conflict_id(ConflictType.TIME_ORDER_ISSUE)

        conflict = ConflictItem(
            conflict_id=conflict_id,
            conflict_type=ConflictType.TIME_ORDER_ISSUE,
            severity="medium",
            source_packages=[source_package],
            affected_items=[
                {
                    "track_name": track_name,
                    "segment_index": segment_index,
                    "point_index": point_index,
                    "previous_time": previous_time.isoformat() if previous_time else None,
                    "current_time": current_time.isoformat() if current_time else None,
                    "time_delta_seconds": time_delta_seconds,
                }
            ],
            message=message,
            metadata={
                "track_name": track_name,
                "time_delta_seconds": time_delta_seconds,
            },
        )

        self._conflicts[conflict_id] = conflict
        return conflict

    def add_coordinate_issue(
        self,
        item_type: str,
        item_name: str,
        issue_type: str,
        lat: Optional[float],
        lon: Optional[float],
        source_package: str,
        message: str,
    ) -> ConflictItem:
        conflict_id = self._generate_conflict_id(ConflictType.COORDINATE_ISSUE)

        conflict = ConflictItem(
            conflict_id=conflict_id,
            conflict_type=ConflictType.COORDINATE_ISSUE,
            severity="high" if issue_type == "boundary_violation" else "medium",
            source_packages=[source_package],
            affected_items=[
                {
                    "item_type": item_type,
                    "item_name": item_name,
                    "issue_type": issue_type,
                    "lat": lat,
                    "lon": lon,
                }
            ],
            message=message,
            metadata={
                "item_type": item_type,
                "issue_type": issue_type,
            },
        )

        self._conflicts[conflict_id] = conflict
        return conflict

    def add_duplicate_point(
        self,
        group_id: str,
        points: List[Dict[str, Any]],
        distance_meters: float,
        suggested_action: str,
        message: str,
    ) -> ConflictItem:
        conflict_id = self._generate_conflict_id(ConflictType.DUPLICATE_POINT)
        source_packages = list({p.get("source_package", "unknown") for p in points})

        conflict = ConflictItem(
            conflict_id=conflict_id,
            conflict_type=ConflictType.DUPLICATE_POINT,
            severity="medium",
            source_packages=source_packages,
            affected_items=points,
            message=message,
            metadata={
                "group_id": group_id,
                "distance_meters": distance_meters,
                "suggested_action": suggested_action,
            },
        )

        self._conflicts[conflict_id] = conflict
        return conflict

    def add_name_collision(
        self,
        file_name: str,
        files: List[Dict[str, Any]],
        message: str,
    ) -> ConflictItem:
        conflict_id = self._generate_conflict_id(ConflictType.NAME_COLLISION)
        source_packages = list({f.get("source_package", "unknown") for f in files})

        conflict = ConflictItem(
            conflict_id=conflict_id,
            conflict_type=ConflictType.NAME_COLLISION,
            severity="high",
            source_packages=source_packages,
            affected_items=files,
            message=message,
            metadata={
                "file_name": file_name,
            },
        )

        self._conflicts[conflict_id] = conflict
        return conflict

    def resolve(
        self,
        conflict_id: str,
        action: ResolutionAction,
        resolved_by: str = "system",
        notes: Optional[str] = None,
    ) -> Optional[ConflictItem]:
        conflict = self._conflicts.get(conflict_id)
        if not conflict:
            return None

        conflict.action = action
        conflict.status = (
            ResolutionStatus.AUTO_RESOLVED
            if resolved_by == "system"
            else ResolutionStatus.RESOLVED
        )
        conflict.resolved_at = datetime.now()
        conflict.resolved_by = resolved_by
        conflict.resolution_notes = notes

        return conflict

    def get_conflict(self, conflict_id: str) -> Optional[ConflictItem]:
        return self._conflicts.get(conflict_id)

    def get_all_conflicts(self) -> List[ConflictItem]:
        return list(self._conflicts.values())

    def get_unresolved_conflicts(self) -> List[ConflictItem]:
        return [
            c for c in self._conflicts.values()
            if c.status == ResolutionStatus.UNRESOLVED
        ]

    def get_conflicts_by_type(self, conflict_type: ConflictType) -> List[ConflictItem]:
        return [
            c for c in self._conflicts.values()
            if c.conflict_type == conflict_type
        ]

    def get_summary(self) -> Dict[str, Any]:
        by_type: Dict[str, int] = {}
        by_status: Dict[str, int] = {}
        by_severity: Dict[str, int] = {}

        for conflict in self._conflicts.values():
            type_key = conflict.conflict_type.value
            by_type[type_key] = by_type.get(type_key, 0) + 1

            status_key = conflict.status.value
            by_status[status_key] = by_status.get(status_key, 0) + 1

            severity_key = conflict.severity
            by_severity[severity_key] = by_severity.get(severity_key, 0) + 1

        return {
            "total": len(self._conflicts),
            "by_type": by_type,
            "by_status": by_status,
            "by_severity": by_severity,
            "unresolved": len(self.get_unresolved_conflicts()),
        }

    def to_json(self, indent: int = 2) -> str:
        data = {
            "summary": self.get_summary(),
            "conflicts": [c.to_dict() for c in self._conflicts.values()],
        }
        return json.dumps(data, indent=indent, ensure_ascii=False, default=str)

    def clear(self) -> None:
        self._conflicts.clear()
        self._counter = 0
