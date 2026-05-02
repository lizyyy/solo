import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class SourcePackage:
    name: str
    path: str
    device_id: Optional[str] = None
    last_modified: Optional[datetime] = None
    included: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "path": self.path,
            "device_id": self.device_id,
            "last_modified": self.last_modified.isoformat() if self.last_modified else None,
            "included": self.included,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SourcePackage":
        return cls(
            name=data["name"],
            path=data["path"],
            device_id=data.get("device_id"),
            last_modified=datetime.fromisoformat(data["last_modified"]) if data.get("last_modified") else None,
            included=data.get("included", True),
        )


@dataclass
class TaskConfig:
    task_name: str
    task_id: str
    created_at: datetime
    target_coordinate_system: str = "WGS84"
    duplicate_distance_threshold_meters: float = 1.0
    enable_time_order_check: bool = True
    enable_coordinate_boundary_check: bool = True
    coordinate_boundary: Optional[Dict[str, float]] = None
    output_directory: str = "./merged_output"
    quarantine_directory: str = "./quarantine"
    manifest_path: str = "./manifest.json"
    audit_log_path: str = "./audit.log"
    sources: List[SourcePackage] = field(default_factory=list)
    merge_rules: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if self.coordinate_boundary is None:
            self.coordinate_boundary = {
                "min_lat": -90.0,
                "max_lat": 90.0,
                "min_lon": -180.0,
                "max_lon": 180.0,
            }
        if not self.merge_rules:
            self.merge_rules = {
                "conflict_resolution": "prompt",
                "prefer_latest_modified": True,
                "auto_resolve_identical": True,
            }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_name": self.task_name,
            "task_id": self.task_id,
            "created_at": self.created_at.isoformat(),
            "target_coordinate_system": self.target_coordinate_system,
            "duplicate_distance_threshold_meters": self.duplicate_distance_threshold_meters,
            "enable_time_order_check": self.enable_time_order_check,
            "enable_coordinate_boundary_check": self.enable_coordinate_boundary_check,
            "coordinate_boundary": self.coordinate_boundary,
            "output_directory": self.output_directory,
            "quarantine_directory": self.quarantine_directory,
            "manifest_path": self.manifest_path,
            "audit_log_path": self.audit_log_path,
            "sources": [src.to_dict() for src in self.sources],
            "merge_rules": self.merge_rules,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TaskConfig":
        return cls(
            task_name=data["task_name"],
            task_id=data["task_id"],
            created_at=datetime.fromisoformat(data["created_at"]),
            target_coordinate_system=data.get("target_coordinate_system", "WGS84"),
            duplicate_distance_threshold_meters=data.get("duplicate_distance_threshold_meters", 1.0),
            enable_time_order_check=data.get("enable_time_order_check", True),
            enable_coordinate_boundary_check=data.get("enable_coordinate_boundary_check", True),
            coordinate_boundary=data.get("coordinate_boundary"),
            output_directory=data.get("output_directory", "./merged_output"),
            quarantine_directory=data.get("quarantine_directory", "./quarantine"),
            manifest_path=data.get("manifest_path", "./manifest.json"),
            audit_log_path=data.get("audit_log_path", "./audit.log"),
            sources=[SourcePackage.from_dict(src) for src in data.get("sources", [])],
            merge_rules=data.get("merge_rules", {}),
        )


def generate_task_id() -> str:
    import uuid
    return f"task_{uuid.uuid4().hex[:12]}"


def save_task_config(config: TaskConfig, path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(config.to_dict(), f, indent=2, ensure_ascii=False)


def load_task_config(path: str) -> TaskConfig:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return TaskConfig.from_dict(data)


def create_default_task_config(task_name: str) -> TaskConfig:
    return TaskConfig(
        task_name=task_name,
        task_id=generate_task_id(),
        created_at=datetime.now(),
    )
