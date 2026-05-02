"""Git LFS 迁移预检员 - 数据模型定义"""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


class FileType(Enum):
    TEXT = auto()
    BINARY = auto()
    UNKNOWN = auto()


class LFSStatus(Enum):
    NOT_IN_LFS = auto()
    IN_LFS = auto()
    POINTER_FILE = auto()
    CONFLICTED = auto()


class IssueSeverity(Enum):
    CRITICAL = auto()
    HIGH = auto()
    MEDIUM = auto()
    LOW = auto()


class IssueType(Enum):
    LARGE_FILE = auto()
    RULE_CONFLICT = auto()
    CASE_SENSITIVITY = auto()
    PROTECTED_TAG = auto()
    ROLLBACK_RISK = auto()
    SUBMODULE_BROKEN = auto()
    HASH_MISMATCH = auto()
    MISSING_POINTER = auto()


@dataclass
class GitFile:
    path: str
    size: int
    hash: str
    blob_hash: str
    commit_hash: str
    file_type: FileType = FileType.UNKNOWN
    lfs_status: LFSStatus = LFSStatus.NOT_IN_LFS
    gitattributes_pattern: Optional[str] = None
    in_history: bool = True
    path_variants: Set[str] = field(default_factory=set)


@dataclass
class GitAttributeRule:
    pattern: str
    lfs_enabled: bool = False
    other_attributes: Dict[str, str] = field(default_factory=dict)
    line_number: int = 0
    raw_line: str = ""


@dataclass
class ProtectedBranch:
    name: str
    ref: str
    is_tag: bool = False
    commit_hash: Optional[str] = None


@dataclass
class Issue:
    issue_type: IssueType
    severity: IssueSeverity
    message: str
    affected_files: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    suggestion: Optional[str] = None


@dataclass
class LFSMigrationPlan:
    files_to_convert: List[GitFile] = field(default_factory=list)
    files_unchanged: List[GitFile] = field(default_factory=list)
    estimated_size_reduction: int = 0
    gitattributes_changes: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    dry_run_output: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SubmoduleReference:
    path: str
    url: str
    commit_hash: str
    ref: Optional[str] = None
    branch: Optional[str] = None


@dataclass
class ScanResult:
    timestamp: datetime = field(default_factory=datetime.now)
    git_dir: Path = field(default_factory=Path)
    rev_list: List[str] = field(default_factory=list)
    file_sizes: Dict[str, GitFile] = field(default_factory=dict)
    gitattributes_rules: List[GitAttributeRule] = field(default_factory=list)
    protected_branches: List[ProtectedBranch] = field(default_factory=list)
    submodules: List[SubmoduleReference] = field(default_factory=list)
    total_files: int = 0
    total_size: int = 0
    binary_files: int = 0
    large_files: int = 0


@dataclass
class CheckResult:
    scan_result: ScanResult
    issues: List[Issue] = field(default_factory=list)
    case_conflicts: List[List[str]] = field(default_factory=list)
    hash_conflicts: List[Dict[str, Any]] = field(default_factory=list)
    protected_refs_at_risk: List[str] = field(default_factory=list)
    rollback_scenarios: List[str] = field(default_factory=list)


@dataclass
class SandboxExecution:
    execution_id: str
    timestamp: datetime = field(default_factory=datetime.now)
    sandbox_dir: Path = field(default_factory=Path)
    source_repo: Path = field(default_factory=Path)
    commands_executed: List[Dict[str, Any]] = field(default_factory=list)
    git_log_snapshot: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    success: bool = False
    final_state: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AuditLogEntry:
    timestamp: datetime = field(default_factory=datetime.now)
    action: str
    details: Dict[str, Any] = field(default_factory=dict)
    success: bool = True
    error_message: Optional[str] = None


@dataclass
class ReportPackage:
    generated_at: datetime = field(default_factory=datetime.now)
    scan_result: Optional[ScanResult] = None
    check_result: Optional[CheckResult] = None
    migration_plan: Optional[LFSMigrationPlan] = None
    sandbox_execution: Optional[SandboxExecution] = None
    markdown_content: str = ""
    csv_content: Dict[str, str] = field(default_factory=dict)
    json_data: Dict[str, Any] = field(default_factory=dict)
