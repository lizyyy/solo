from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, field_validator


class BuildStatus(str, Enum):
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    ABORTED = "ABORTED"
    UNSTABLE = "UNSTABLE"
    UNKNOWN = "UNKNOWN"


class ParameterType(str, Enum):
    STRING = "STRING"
    TEXT = "TEXT"
    BOOLEAN = "BOOLEAN"
    CHOICE = "CHOICE"
    PASSWORD = "PASSWORD"
    FILE = "FILE"
    RUN = "RUN"
    UNKNOWN = "UNKNOWN"


class Parameter(BaseModel):
    name: str
    value: Any
    type: ParameterType = ParameterType.UNKNOWN
    description: Optional[str] = None

    @field_validator('type', mode='before')
    @classmethod
    def validate_type(cls, v: Any) -> ParameterType:
        if isinstance(v, ParameterType):
            return v
        if isinstance(v, str):
            try:
                return ParameterType(v.upper())
            except ValueError:
                return ParameterType.UNKNOWN
        return ParameterType.UNKNOWN


class Artifact(BaseModel):
    name: str
    path: str
    size: Optional[int] = None
    sha256: Optional[str] = None
    exists: bool = True
    missing_reason: Optional[str] = None


class GitInfo(BaseModel):
    commit: str
    branch: Optional[str] = None
    url: Optional[str] = None
    message: Optional[str] = None
    author: Optional[str] = None


class BuildRecord(BaseModel):
    job_name: str
    build_number: int
    status: BuildStatus = BuildStatus.UNKNOWN
    timestamp: datetime
    duration_ms: Optional[int] = None
    triggered_by: Optional[str] = None
    parameters: List[Parameter] = Field(default_factory=list)
    artifacts: List[Artifact] = Field(default_factory=list)
    git_info: Optional[GitInfo] = None
    description: Optional[str] = None
    url: Optional[str] = None
    is_rerun: bool = False
    rerun_of: Optional[int] = None

    @field_validator('timestamp', mode='before')
    @classmethod
    def validate_timestamp(cls, v: Any) -> datetime:
        if isinstance(v, datetime):
            return v
        if isinstance(v, (int, float)):
            return datetime.fromtimestamp(v / 1000 if v > 1e12 else v)
        if isinstance(v, str):
            from dateutil import parser
            return parser.parse(v)
        raise ValueError(f"Cannot parse timestamp: {v}")

    def get_parameters_dict(self) -> Dict[str, Any]:
        return {p.name: p.value for p in self.parameters}


class ParameterChange(BaseModel):
    name: str
    old_value: Any
    new_value: Any
    old_type: Optional[ParameterType] = None
    new_type: Optional[ParameterType] = None
    change_type: str

    @property
    def is_type_change(self) -> bool:
        return self.old_type != self.new_type


class SnapshotDiff(BaseModel):
    build_number_old: int
    build_number_new: int
    parameter_changes: List[ParameterChange] = Field(default_factory=list)
    artifacts_added: List[str] = Field(default_factory=list)
    artifacts_removed: List[str] = Field(default_factory=list)
    artifacts_modified: List[str] = Field(default_factory=list)
    status_changed: bool = False
    old_status: Optional[BuildStatus] = None
    new_status: Optional[BuildStatus] = None


class ValidationError(BaseModel):
    field: str
    message: str
    severity: str = "error"


class SnapshotValidationResult(BaseModel):
    valid: bool
    errors: List[ValidationError] = Field(default_factory=list)
    warnings: List[ValidationError] = Field(default_factory=list)


class SnapshotMetadata(BaseModel):
    snapshot_id: str
    created_at: datetime
    tool_version: str
    input_source: str
    output_format: str = "json"


class SnapshotReport(BaseModel):
    metadata: SnapshotMetadata
    build: BuildRecord
    validation: SnapshotValidationResult
    diff: Optional[SnapshotDiff] = None
    notes: List[str] = Field(default_factory=list)
