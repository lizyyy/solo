from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field
from pathlib import Path


class SourceType(str, Enum):
    API_LIST = "api_list"
    SCOPE_TABLE = "scope_table"
    SDK_EXAMPLE = "sdk_example"
    DOC_FRAGMENT = "doc_fragment"
    CALL_LOG = "call_log"
    COVERAGE_REPORT = "coverage_report"


class ExitCode(int, Enum):
    SUCCESS = 0
    INPUT_ERROR = 1
    PARSE_ERROR = 2
    COVERAGE_GAP = 3
    CONFIG_ERROR = 4
    INTERNAL_ERROR = 5


class Severity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class SourceLocation:
    file_path: str
    line_number: Optional[int] = None
    column: Optional[int] = None
    raw_content: Optional[str] = None

    def __str__(self) -> str:
        loc = self.file_path
        if self.line_number:
            loc += f":{self.line_number}"
            if self.column:
                loc += f":{self.column}"
        return loc


@dataclass
class ParseIssue:
    message: str
    severity: Severity
    location: SourceLocation
    parser: str


@dataclass
class Scope:
    name: str
    description: Optional[str] = None
    aliases: List[str] = field(default_factory=list)
    includes: List[str] = field(default_factory=list)
    location: Optional[SourceLocation] = None
    is_deprecated: bool = False

    def all_names(self) -> Set[str]:
        names = {self.name}
        names.update(self.aliases)
        return names


@dataclass
class APIEndpoint:
    method: str
    path: str
    required_scopes: List[str] = field(default_factory=list)
    optional_scopes: List[str] = field(default_factory=list)
    description: Optional[str] = None
    operation_id: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    location: Optional[SourceLocation] = None
    is_deprecated: bool = False

    def key(self) -> str:
        return f"{self.method.upper()} {self.path}"


@dataclass
class SDKExample:
    name: str
    language: str
    api_method: str
    api_path: str
    used_scopes: List[str] = field(default_factory=list)
    code: Optional[str] = None
    description: Optional[str] = None
    location: Optional[SourceLocation] = None
    is_verified: bool = False
    notes: List[str] = field(default_factory=list)


@dataclass
class DocFragment:
    title: str
    content: str
    mentioned_scopes: List[str] = field(default_factory=list)
    mentioned_apis: List[str] = field(default_factory=list)
    location: Optional[SourceLocation] = None
    section: Optional[str] = None


@dataclass
class CallLogEntry:
    timestamp: str
    method: str
    path: str
    used_scopes: List[str] = field(default_factory=list)
    success: bool = True
    status_code: Optional[int] = None
    client_id: Optional[str] = None
    location: Optional[SourceLocation] = None


@dataclass
class ScopeMapping:
    canonical_name: str
    aliases: Set[str] = field(default_factory=set)
    included_scopes: Set[str] = field(default_factory=set)


@dataclass
class DeprecatedScopeUsage:
    scope_name: str
    source: str
    source_type: str
    location: Optional[SourceLocation] = None
    recommendation: Optional[str] = None


@dataclass
class CoverageGap:
    gap_type: str
    severity: Severity
    api_key: str
    expected_scopes: List[str] = field(default_factory=list)
    actual_scopes: List[str] = field(default_factory=list)
    missing_scopes: List[str] = field(default_factory=list)
    extra_scopes: List[str] = field(default_factory=list)
    source: Optional[str] = None
    source_location: Optional[SourceLocation] = None
    explanation: Optional[str] = None


@dataclass
class AnalysisResult:
    resolved_scopes: Dict[str, Scope] = field(default_factory=dict)
    apis: List[APIEndpoint] = field(default_factory=list)
    sdk_examples: List[SDKExample] = field(default_factory=list)
    doc_fragments: List[DocFragment] = field(default_factory=list)
    call_logs: List[CallLogEntry] = field(default_factory=list)
    parse_issues: List[ParseIssue] = field(default_factory=list)
    scope_coverage_gaps: List[CoverageGap] = field(default_factory=list)
    sdk_coverage_gaps: List[CoverageGap] = field(default_factory=list)
    doc_coverage_gaps: List[CoverageGap] = field(default_factory=list)
    deprecated_scope_usages: List[DeprecatedScopeUsage] = field(default_factory=list)
    scope_mappings: Dict[str, ScopeMapping] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def has_errors(self) -> bool:
        return any(
            i.severity in (Severity.ERROR, Severity.CRITICAL)
            for i in self.parse_issues
        )

    def has_gaps(self) -> bool:
        return bool(
            self.scope_coverage_gaps or self.sdk_coverage_gaps or self.doc_coverage_gaps
        )


@dataclass
class ReportConfig:
    output_dir: Path
    include_summary: bool = True
    include_json: bool = True
    include_markdown: bool = True
    verbose: bool = False


@dataclass
class InputConfig:
    api_list_files: List[Path] = field(default_factory=list)
    scope_table_files: List[Path] = field(default_factory=list)
    sdk_example_files: List[Path] = field(default_factory=list)
    doc_fragment_files: List[Path] = field(default_factory=list)
    call_log_files: List[Path] = field(default_factory=list)
    coverage_report_files: List[Path] = field(default_factory=list)
    scope_alias_file: Optional[Path] = None
