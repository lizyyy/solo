"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional


class IssueLevel(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class IssueType(Enum):
    MISSING_FILE = "missing_file"
    CASE_MISMATCH = "case_mismatch"
    PATH_TRAVERSAL = "path_traversal"
    DUPLICATE_FILE = "duplicate_file"
    UNUSED_LARGE_FILE = "unused_large_file"
    HEADING_LEVEL_JUMP = "heading_level_jump"
    INVALID_ANCHOR = "invalid_anchor"


@dataclass
class Config:
    """项目配置"""
    root_dir: str
    dist_dir: str
    cache_dir: str
    ignore_patterns: List[str] = field(default_factory=lambda: [
        "**/__pycache__/**",
        "**/.git/**",
        "**/.DS_Store",
        "**/node_modules/**",
        "**/*.pyc",
    ])
    large_file_threshold: int = 5 * 1024 * 1024  # 5MB
    report_dir: str = "reports"


@dataclass
class FileReference:
    """文件引用信息"""
    source_file: str
    target_path: str
    raw_path: str
    line_number: int
    reference_type: str  # "link", "image", "anchor"


@dataclass
class CheckIssue:
    """检查问题"""
    level: IssueLevel
    issue_type: IssueType
    message: str
    source_file: Optional[str] = None
    line_number: Optional[int] = None
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "level": self.level.value,
            "type": self.issue_type.value,
            "message": self.message,
            "source_file": self.source_file,
            "line_number": self.line_number,
            "details": self.details,
        }


@dataclass
class ScanResult:
    """扫描结果"""
    scan_time: datetime = field(default_factory=datetime.now)
    total_files: int = 0
    markdown_files: int = 0
    references: List[FileReference] = field(default_factory=list)
    issues: List[CheckIssue] = field(default_factory=list)
    actual_files: List[str] = field(default_factory=list)  # 实际存在的所有文件
    referenced_files: List[str] = field(default_factory=list)  # 被引用的文件

    def add_issue(self, issue: CheckIssue):
        self.issues.append(issue)

    def get_errors(self) -> List[CheckIssue]:
        return [i for i in self.issues if i.level == IssueLevel.ERROR]

    def get_warnings(self) -> List[CheckIssue]:
        return [i for i in self.issues if i.level == IssueLevel.WARNING]

    def has_errors(self) -> bool:
        return any(i.level == IssueLevel.ERROR for i in self.issues)


@dataclass
class ManifestEntry:
    """Manifest中的文件条目"""
    path: str
    sha256: str
    size: int
    referenced_by: List[str] = field(default_factory=list)


@dataclass
class Manifest:
    """打包清单"""
    version: str = "1.0"
    generated_at: datetime = field(default_factory=datetime.now)
    total_files: int = 0
    entries: List[ManifestEntry] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "generated_at": self.generated_at.isoformat(),
            "total_files": self.total_files,
            "entries": [
                {
                    "path": e.path,
                    "sha256": e.sha256,
                    "size": e.size,
                    "referenced_by": e.referenced_by,
                }
                for e in self.entries
            ]
        }
