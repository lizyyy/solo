import enum
import hashlib
import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


class FileType(enum.Enum):
    FILE = "file"
    DIRECTORY = "directory"
    SYMLINK = "symlink"


class SourceSide(enum.Enum):
    LEFT = "left"
    RIGHT = "right"


class OperationType(enum.Enum):
    COPY_LEFT_TO_RIGHT = "copy_left_to_right"
    COPY_RIGHT_TO_LEFT = "copy_right_to_left"
    DELETE_LEFT = "delete_left"
    DELETE_RIGHT = "delete_right"
    RENAME_LEFT = "rename_left"
    RENAME_RIGHT = "rename_right"
    SKIP = "skip"


class ConflictType(enum.Enum):
    CASE_ONLY_DIFFERENCE = "case_only_difference"
    SAME_PATH_DIFFERENT_CONTENT = "same_path_different_content"
    MTIME_DRIFT = "mtime_drift"
    SYMLINK_ESCAPES_ROOT = "symlink_escapes_root"
    IGNORE_PATTERN_HIT = "ignore_pattern_hit"
    RENAME_CANDIDATE = "rename_candidate"
    ADD_ON_BOTH_SIDES = "add_on_both_sides"


class PlanStatus(enum.Enum):
    DRY_RUN = "dry_run"
    CONFLICT = "conflict"
    READY = "ready"
    EXECUTED = "executed"
    PARTIAL = "partial"


@dataclass
class FileInfo:
    relative_path: str
    absolute_path: str
    size: int
    mtime: float
    sha256: str
    file_type: FileType
    source_side: SourceSide
    is_symlink: bool = False
    symlink_target: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "relative_path": self.relative_path,
            "absolute_path": self.absolute_path,
            "size": self.size,
            "mtime": self.mtime,
            "sha256": self.sha256,
            "file_type": self.file_type.value,
            "source_side": self.source_side.value,
            "is_symlink": self.is_symlink,
            "symlink_target": self.symlink_target,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'FileInfo':
        return cls(
            relative_path=data["relative_path"],
            absolute_path=data["absolute_path"],
            size=data["size"],
            mtime=data["mtime"],
            sha256=data["sha256"],
            file_type=FileType(data["file_type"]),
            source_side=SourceSide(data["source_side"]),
            is_symlink=data.get("is_symlink", False),
            symlink_target=data.get("symlink_target"),
        )
    
    def get_normalized_path(self) -> str:
        return self.relative_path.lower()


@dataclass
class Manifest:
    version: str = "1.0"
    created_at: float = field(default_factory=time.time)
    source_side: SourceSide = SourceSide.LEFT
    root_dir: str = ""
    files: Dict[str, FileInfo] = field(default_factory=dict)
    
    def add_file(self, file_info: FileInfo) -> None:
        self.files[file_info.relative_path] = file_info
    
    def get_by_path(self, relative_path: str) -> Optional[FileInfo]:
        return self.files.get(relative_path)
    
    def get_by_normalized_path(self, normalized_path: str) -> List[FileInfo]:
        result = []
        for file_info in self.files.values():
            if file_info.get_normalized_path() == normalized_path:
                result.append(file_info)
        return result
    
    def get_by_sha256(self, sha256: str) -> List[FileInfo]:
        return [f for f in self.files.values() if f.sha256 == sha256]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "created_at": self.created_at,
            "source_side": self.source_side.value,
            "root_dir": self.root_dir,
            "files": {path: info.to_dict() for path, info in self.files.items()},
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Manifest':
        files = {}
        for path, file_data in data.get("files", {}).items():
            files[path] = FileInfo.from_dict(file_data)
        return cls(
            version=data.get("version", "1.0"),
            created_at=data.get("created_at", time.time()),
            source_side=SourceSide(data.get("source_side", SourceSide.LEFT.value)),
            root_dir=data.get("root_dir", ""),
            files=files,
        )
    
    def save(self, path: str) -> None:
        manifest_path = Path(path)
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)
    
    @classmethod
    def load(cls, path: str) -> 'Manifest':
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return cls.from_dict(data)
    
    def __len__(self) -> int:
        return len(self.files)


@dataclass
class SyncOperation:
    operation_type: OperationType
    source_path: Optional[str] = None
    target_path: Optional[str] = None
    source_side: Optional[SourceSide] = None
    target_side: Optional[SourceSide] = None
    source_sha256: Optional[str] = None
    target_sha256: Optional[str] = None
    size: int = 0
    mtime: float = 0.0
    description: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "operation_type": self.operation_type.value,
            "source_path": self.source_path,
            "target_path": self.target_path,
            "source_side": self.source_side.value if self.source_side else None,
            "target_side": self.target_side.value if self.target_side else None,
            "source_sha256": self.source_sha256,
            "target_sha256": self.target_sha256,
            "size": self.size,
            "mtime": self.mtime,
            "description": self.description,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SyncOperation':
        return cls(
            operation_type=OperationType(data["operation_type"]),
            source_path=data.get("source_path"),
            target_path=data.get("target_path"),
            source_side=SourceSide(data["source_side"]) if data.get("source_side") else None,
            target_side=SourceSide(data["target_side"]) if data.get("target_side") else None,
            source_sha256=data.get("source_sha256"),
            target_sha256=data.get("target_sha256"),
            size=data.get("size", 0),
            mtime=data.get("mtime", 0.0),
            description=data.get("description", ""),
        )


@dataclass
class ConflictItem:
    conflict_type: ConflictType
    left_file: Optional[FileInfo] = None
    right_file: Optional[FileInfo] = None
    details: Dict[str, Any] = field(default_factory=dict)
    suggestion: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_type": self.conflict_type.value,
            "left_file": self.left_file.to_dict() if self.left_file else None,
            "right_file": self.right_file.to_dict() if self.right_file else None,
            "details": self.details,
            "suggestion": self.suggestion,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ConflictItem':
        return cls(
            conflict_type=ConflictType(data["conflict_type"]),
            left_file=FileInfo.from_dict(data["left_file"]) if data.get("left_file") else None,
            right_file=FileInfo.from_dict(data["right_file"]) if data.get("right_file") else None,
            details=data.get("details", {}),
            suggestion=data.get("suggestion", ""),
        )


@dataclass
class SyncPlan:
    version: str = "1.0"
    created_at: float = field(default_factory=time.time)
    status: PlanStatus = PlanStatus.DRY_RUN
    operations: List[SyncOperation] = field(default_factory=list)
    conflicts: List[ConflictItem] = field(default_factory=list)
    statistics: Dict[str, int] = field(default_factory=dict)
    left_manifest_path: str = ""
    right_manifest_path: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "created_at": self.created_at,
            "status": self.status.value,
            "operations": [op.to_dict() for op in self.operations],
            "conflicts": [conf.to_dict() for conf in self.conflicts],
            "statistics": self.statistics,
            "left_manifest_path": self.left_manifest_path,
            "right_manifest_path": self.right_manifest_path,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SyncPlan':
        return cls(
            version=data.get("version", "1.0"),
            created_at=data.get("created_at", time.time()),
            status=PlanStatus(data.get("status", PlanStatus.DRY_RUN.value)),
            operations=[SyncOperation.from_dict(op) for op in data.get("operations", [])],
            conflicts=[ConflictItem.from_dict(conf) for conf in data.get("conflicts", [])],
            statistics=data.get("statistics", {}),
            left_manifest_path=data.get("left_manifest_path", ""),
            right_manifest_path=data.get("right_manifest_path", ""),
        )
    
    def save(self, path: str) -> None:
        plan_path = Path(path)
        plan_path.parent.mkdir(parents=True, exist_ok=True)
        with open(plan_path, 'w', encoding='utf-8') as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)
    
    @classmethod
    def load(cls, path: str) -> 'SyncPlan':
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return cls.from_dict(data)
    
    def has_conflicts(self) -> bool:
        return len(self.conflicts) > 0
    
    def get_conflict_count(self) -> int:
        return len(self.conflicts)
    
    def get_operation_count(self) -> int:
        return len(self.operations)


@dataclass
class JournalEntry:
    id: str
    timestamp: float = field(default_factory=time.time)
    operation_type: OperationType = OperationType.COPY_LEFT_TO_RIGHT
    source_path: str = ""
    target_path: str = ""
    source_sha256: str = ""
    target_sha256: str = ""
    backup_path: Optional[str] = None
    status: str = "pending"
    error_message: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "operation_type": self.operation_type.value,
            "source_path": self.source_path,
            "target_path": self.target_path,
            "source_sha256": self.source_sha256,
            "target_sha256": self.target_sha256,
            "backup_path": self.backup_path,
            "status": self.status,
            "error_message": self.error_message,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'JournalEntry':
        return cls(
            id=data["id"],
            timestamp=data.get("timestamp", time.time()),
            operation_type=OperationType(data["operation_type"]),
            source_path=data.get("source_path", ""),
            target_path=data.get("target_path", ""),
            source_sha256=data.get("source_sha256", ""),
            target_sha256=data.get("target_sha256", ""),
            backup_path=data.get("backup_path"),
            status=data.get("status", "pending"),
            error_message=data.get("error_message"),
        )


@dataclass
class Journal:
    version: str = "1.0"
    created_at: float = field(default_factory=time.time)
    plan_path: str = ""
    entries: List[JournalEntry] = field(default_factory=list)
    is_applied: bool = False
    applied_at: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "created_at": self.created_at,
            "plan_path": self.plan_path,
            "entries": [entry.to_dict() for entry in self.entries],
            "is_applied": self.is_applied,
            "applied_at": self.applied_at,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Journal':
        return cls(
            version=data.get("version", "1.0"),
            created_at=data.get("created_at", time.time()),
            plan_path=data.get("plan_path", ""),
            entries=[JournalEntry.from_dict(e) for e in data.get("entries", [])],
            is_applied=data.get("is_applied", False),
            applied_at=data.get("applied_at"),
        )
    
    def save(self, path: str) -> None:
        journal_path = Path(path)
        journal_path.parent.mkdir(parents=True, exist_ok=True)
        with open(journal_path, 'w', encoding='utf-8') as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)
    
    @classmethod
    def load(cls, path: str) -> 'Journal':
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return cls.from_dict(data)


def generate_timestamp_id() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def compute_sha256(file_path: str, chunk_size: int = 8192) -> str:
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            sha256_hash.update(chunk)
    return sha256_hash.hexdigest()
