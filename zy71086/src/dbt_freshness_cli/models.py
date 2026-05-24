from enum import Enum
from typing import Dict, List, Optional, Any, Set
from datetime import datetime
from pydantic import BaseModel, Field


class Severity(str, Enum):
    OK = "ok"
    WARNING = "warning"
    CRITICAL = "critical"
    ERROR = "error"
    SKIPPED = "skipped"
    MISSING = "missing"


class ModelStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    ERROR = "error"


class FreshnessStatus(str, Enum):
    PASS = "pass"
    WARN = "warn"
    ERROR = "error"
    UNKNOWN = "unknown"


class ReportIssue(str, Enum):
    SOURCE_MISSING = "source_missing"
    MODEL_SKIPPED = "model_skipped"
    DEPENDENCY_BROKEN = "dependency_broken"
    MODEL_STALE = "model_stale"
    DOWNSTREAM_IMPACT = "downstream_impact"
    UPSTREAM_LATE = "upstream_late"


class DBTResourceType(str, Enum):
    MODEL = "model"
    SOURCE = "source"
    SEED = "seed"
    SNAPSHOT = "snapshot"
    TEST = "test"


class BaseDBTResource(BaseModel):
    unique_id: str
    resource_type: DBTResourceType
    name: str
    database: Optional[str] = None
    schema_: Optional[str] = Field(None, alias="schema")
    alias: Optional[str] = None


class ManifestNode(BaseDBTResource):
    description: Optional[str] = None
    columns: Dict[str, Any] = Field(default_factory=dict)
    config: Dict[str, Any] = Field(default_factory=dict)
    depends_on: Dict[str, List[str]] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)
    path: Optional[str] = None
    package_name: Optional[str] = None
    original_file_path: Optional[str] = None

    @property
    def dependencies(self) -> List[str]:
        return self.depends_on.get("nodes", []) + self.depends_on.get("sources", [])


class ManifestSource(BaseDBTResource):
    description: Optional[str] = None
    loader: Optional[str] = None
    source_name: Optional[str] = None
    source_description: Optional[str] = None
    identifier: Optional[str] = None
    loaded_at_field: Optional[str] = None
    freshness: Dict[str, Any] = Field(default_factory=dict)


class RunResult(BaseModel):
    unique_id: str
    status: ModelStatus
    timing: List[Dict[str, Any]] = Field(default_factory=list)
    execution_time: Optional[float] = None
    message: Optional[str] = None
    failures: Optional[int] = None

    @property
    def completed_at(self) -> Optional[datetime]:
        for t in self.timing:
            if t.get("name") == "execute":
                completed_at_str = t.get("completed_at")
                if completed_at_str:
                    try:
                        return datetime.fromisoformat(completed_at_str.replace("Z", "+00:00"))
                    except (ValueError, AttributeError):
                        pass
        return None


class SourceFreshnessResult(BaseModel):
    unique_id: str
    max_loaded_at: Optional[str] = None
    snapshotted_at: Optional[str] = None
    age: Optional[float] = None
    status: FreshnessStatus
    error_after: Optional[Dict[str, Any]] = None
    warn_after: Optional[Dict[str, Any]] = None

    @property
    def max_loaded_at_datetime(self) -> Optional[datetime]:
        if self.max_loaded_at:
            try:
                return datetime.fromisoformat(self.max_loaded_at.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pass
        return None

    @property
    def snapshotted_at_datetime(self) -> Optional[datetime]:
        if self.snapshotted_at:
            try:
                return datetime.fromisoformat(self.snapshotted_at.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pass
        return None


class ReportModel(BaseModel):
    unique_id: str
    name: str
    resource_type: DBTResourceType
    status: ModelStatus
    freshness_status: FreshnessStatus
    severity: Severity
    issues: List[ReportIssue] = Field(default_factory=list)
    last_success_at: Optional[datetime] = None
    last_data_at: Optional[datetime] = None
    minutes_late: Optional[float] = None
    expected_frequency_minutes: Optional[float] = None
    upstream_dependencies: List[str] = Field(default_factory=list)
    downstream_references: List[str] = Field(default_factory=list)
    message: Optional[str] = None


class ReportTable(BaseModel):
    table_name: str
    unique_id: Optional[str] = None
    status: Severity
    affected_models: List[str] = Field(default_factory=list)
    impacted: bool = False


class DependencyIssue(BaseModel):
    type: ReportIssue
    from_node: str
    to_node: str
    message: str


class FreshnessReport(BaseModel):
    generated_at: datetime
    severity: Severity
    total_nodes: int = 0
    ok_count: int = 0
    warning_count: int = 0
    critical_count: int = 0
    error_count: int = 0
    skipped_count: int = 0
    missing_count: int = 0
    late_models: List[ReportModel] = Field(default_factory=list)
    broken_dependencies: List[DependencyIssue] = Field(default_factory=list)
    report_tables: List[ReportTable] = Field(default_factory=list)
    issues_summary: Dict[ReportIssue, int] = Field(default_factory=dict)
    execution_warnings: List[str] = Field(default_factory=list)

    def calculate_summary(self) -> None:
        self.issues_summary = {}
        for model in self.late_models:
            for issue in model.issues:
                self.issues_summary[issue] = self.issues_summary.get(issue, 0) + 1


class ExitCode(int, Enum):
    SUCCESS = 0
    WARNING = 1
    CRITICAL = 2
    ERROR = 3
    INPUT_ERROR = 4
