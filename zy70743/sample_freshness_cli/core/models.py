from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class SampleStatus(str, Enum):
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    BROKEN = "broken"
    FIXED = "fixed"


class RunStatus(str, Enum):
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    PENDING = "pending"


class FailureCategory(str, Enum):
    VERSION_MISMATCH = "version_mismatch"
    API_CHANGED = "api_changed"
    INVALID_DATA = "invalid_data"
    TIMEOUT = "timeout"
    AUTH_ERROR = "auth_error"
    UNKNOWN = "unknown"


class FixStatus(str, Enum):
    NOT_FIXED = "not_fixed"
    FIXING = "fixing"
    FIXED = "fixed"
    WONT_FIX = "wont_fix"


class LanguageType(str, Enum):
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    JAVA = "java"
    GO = "go"
    CURL = "curl"


class Sample(BaseModel):
    sample_id: str
    name: str
    description: str
    language: LanguageType
    api_endpoint: str
    api_version: str
    expected_api_version: str
    code_content: str
    input_data: Dict[str, Any]
    expected_output: Dict[str, Any]
    status: SampleStatus = SampleStatus.ACTIVE
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RunResult(BaseModel):
    run_id: str
    sample_id: str
    status: RunStatus
    actual_output: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    failure_category: Optional[FailureCategory] = None
    duration_ms: int = 0
    ran_at: datetime = Field(default_factory=datetime.now)
    version_matched: bool = False
    checks: Dict[str, bool] = Field(default_factory=dict)


class FixRecord(BaseModel):
    fix_id: str
    sample_id: str
    run_id: str
    status: FixStatus
    description: str
    fixer: Optional[str] = None
    fixed_at: Optional[datetime] = None
    fix_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)


class FreshnessReport(BaseModel):
    report_id: str
    generated_at: datetime = Field(default_factory=datetime.now)
    total_samples: int = 0
    passed_samples: int = 0
    failed_samples: int = 0
    version_mismatch_count: int = 0
    fix_rate: float = 0.0
    average_duration_ms: int = 0
    sample_results: List[RunResult] = Field(default_factory=list)
    fix_records: List[FixRecord] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
