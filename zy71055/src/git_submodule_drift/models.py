from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional, List, Dict


class SubmoduleStatus(Enum):
    CLEAN = "clean"
    DRIFTED = "drifted"
    DETACHED = "detached"
    MISSING = "missing"
    DIRTY = "dirty"
    UNINITIALIZED = "uninitialized"


class RiskLevel(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"

    @classmethod
    def _missing_(cls, value):
        return cls.NONE


@dataclass
class GitCommit:
    hash: str
    short_hash: str
    message: str
    author: str
    date: str

    def __post_init__(self):
        if not self.short_hash and len(self.hash) >= 7:
            self.short_hash = self.hash[:7]


@dataclass
class SubmoduleInfo:
    path: str
    name: str
    url: str
    branch: Optional[str]
    current_commit: Optional[str] = None
    current_commit_info: Optional[GitCommit] = None
    locked_commit: Optional[str] = None
    locked_commit_info: Optional[GitCommit] = None
    status: SubmoduleStatus = SubmoduleStatus.UNINITIALIZED
    is_detached: bool = False
    has_local_changes: bool = False
    is_nested: bool = False
    parent_path: Optional[str] = None
    drift_reason: Optional[str] = None
    risk_level: RiskLevel = RiskLevel.NONE
    commits_ahead: int = 0
    commits_behind: int = 0

    def to_dict(self) -> Dict:
        return {
            "path": self.path,
            "name": self.name,
            "url": self.url,
            "branch": self.branch,
            "current_commit": self.current_commit,
            "current_commit_info": self.current_commit_info.__dict__ if self.current_commit_info else None,
            "locked_commit": self.locked_commit,
            "locked_commit_info": self.locked_commit_info.__dict__ if self.locked_commit_info else None,
            "status": self.status.value,
            "is_detached": self.is_detached,
            "has_local_changes": self.has_local_changes,
            "is_nested": self.is_nested,
            "parent_path": self.parent_path,
            "drift_reason": self.drift_reason,
            "risk_level": self.risk_level.value,
            "commits_ahead": self.commits_ahead,
            "commits_behind": self.commits_behind,
        }


@dataclass
class LockFile:
    path: Path
    format: str
    entries: Dict[str, str] = field(default_factory=dict)
    missing_paths: List[str] = field(default_factory=list)


@dataclass
class DriftReport:
    repo_root: Path
    scan_time: str
    submodules: List[SubmoduleInfo] = field(default_factory=list)
    total_submodules: int = 0
    drifted_count: int = 0
    detached_count: int = 0
    dirty_count: int = 0
    missing_in_lock: List[str] = field(default_factory=list)
    not_in_repo: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "repo_root": str(self.repo_root),
            "scan_time": self.scan_time,
            "submodules": [s.to_dict() for s in self.submodules],
            "summary": {
                "total": self.total_submodules,
                "drifted": self.drifted_count,
                "detached": self.detached_count,
                "dirty": self.dirty_count,
                "missing_in_lock": self.missing_in_lock,
                "not_in_repo": self.not_in_repo,
                "errors": self.errors,
            },
        }
