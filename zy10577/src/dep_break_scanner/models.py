from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Dict, Optional, Any


class ImpactLevel(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ReferenceType(Enum):
    IMPORT = "import"
    DIRECT_CALL = "direct_call"
    INHERITANCE = "inheritance"
    DECORATOR = "decorator"
    TYPE_HINT = "type_hint"


@dataclass
class CodeReference:
    file_path: str
    line_number: int
    column: int
    reference_type: ReferenceType
    symbol: str
    code_snippet: str
    context_lines: List[str] = field(default_factory=list)


@dataclass
class TestFile:
    file_path: str
    test_count: int
    related_references: List[CodeReference] = field(default_factory=list)


@dataclass
class BreakingChange:
    category: str
    description: str
    version_introduced: str
    affected_symbols: List[str]
    migration_guide: str = ""


@dataclass
class VersionDiff:
    old_version: str
    new_version: str
    deprecations: List[BreakingChange] = field(default_factory=list)
    removals: List[BreakingChange] = field(default_factory=list)
    signature_changes: List[BreakingChange] = field(default_factory=list)
    behavior_changes: List[BreakingChange] = field(default_factory=list)


@dataclass
class ImpactGroup:
    impact_level: ImpactLevel
    category: str
    description: str
    references: List[CodeReference] = field(default_factory=list)
    affected_files: List[str] = field(default_factory=list)
    test_files: List[TestFile] = field(default_factory=list)


@dataclass
class TestSuggestion:
    priority: str
    description: str
    test_files: List[str]
    action_items: List[str]


@dataclass
class ErrorSample:
    file_path: str
    line_number: int
    error_type: str
    error_message: str
    raw_content: str
    context: str = ""


@dataclass
class ScanResult:
    dependency_name: str
    old_version: str
    new_version: str
    scan_timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    total_files_scanned: int = 0
    total_references: int = 0
    references: List[CodeReference] = field(default_factory=list)
    test_files: List[TestFile] = field(default_factory=list)
    version_diff: Optional[VersionDiff] = None
    impact_groups: List[ImpactGroup] = field(default_factory=list)
    test_suggestions: List[TestSuggestion] = field(default_factory=list)
    error_samples: List[ErrorSample] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
