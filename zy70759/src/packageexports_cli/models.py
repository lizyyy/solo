from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Union


class IssueSeverity(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class IssueType(str, Enum):
    FILE_NOT_FOUND = "file_not_found"
    INVALID_EXPORT_PATTERN = "invalid_export_pattern"
    MISSING_EXPORT_ENTRY = "missing_export_entry"
    CONFLICTING_PATTERN = "conflicting_pattern"
    UNRESOLVABLE_PATH = "unresolvable_path"
    MISSING_CONDITION = "missing_condition"
    EMPTY_EXPORTS = "empty_exports"
    INVALID_JSON = "invalid_json"


@dataclass
class ExportEntry:
    export_path: str
    target_path: str
    conditions: List[str] = field(default_factory=list)
    is_directory: bool = False
    is_wildcard: bool = False


@dataclass
class Issue:
    severity: IssueSeverity
    issue_type: IssueType
    message: str
    export_path: Optional[str] = None
    target_path: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ImportExample:
    import_statement: str
    resolved_path: Optional[str] = None
    is_valid: bool = True
    issues: List[Issue] = field(default_factory=list)


@dataclass
class ValidationResult:
    package_name: str
    package_version: str
    exports_entries: List[ExportEntry] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)
    import_examples: List[ImportExample] = field(default_factory=list)
    file_checks: Dict[str, bool] = field(default_factory=dict)
    
    @property
    def has_errors(self) -> bool:
        return any(issue.severity == IssueSeverity.ERROR for issue in self.issues)
    
    @property
    def error_count(self) -> int:
        return sum(1 for issue in self.issues if issue.severity == IssueSeverity.ERROR)
    
    @property
    def warning_count(self) -> int:
        return sum(1 for issue in self.issues if issue.severity == IssueSeverity.WARNING)
