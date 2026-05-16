from enum import Enum
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ChangeStatus(str, Enum):
    CREATED = "created"
    PENDING_REVIEW = "pending_review"
    AUTO_APPROVED = "auto_approved"
    MANUAL_REVIEW_REQUIRED = "manual_review_required"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTED = "executed"
    FAILED = "failed"
    ROLLBACK_REQUIRED = "rollback_required"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SQLType(str, Enum):
    SELECT = "select"
    INSERT = "insert"
    UPDATE = "update"
    DELETE = "delete"
    ALTER = "alter"
    CREATE = "create"
    DROP = "drop"
    TRUNCATE = "truncate"
    UNKNOWN = "unknown"


class TargetTable(BaseModel):
    table_name: str
    schema_name: Optional[str] = None
    estimated_rows: int = 0
    has_index: bool = True


class SQLSnippet(BaseModel):
    id: str
    sql_content: str
    sql_type: SQLType = SQLType.UNKNOWN
    target_tables: List[TargetTable] = Field(default_factory=list)
    estimated_impacted_rows: int = 0
    lock_risk_score: int = 0
    lock_risk_reason: str = ""
    has_rollback: bool = False
    rollback_script: Optional[str] = None
    parse_errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class RiskScore(BaseModel):
    total_score: int = 0
    impact_score: int = 0
    lock_score: int = 0
    rollback_score: int = 0
    risk_level: RiskLevel = RiskLevel.LOW
    risk_factors: List[str] = Field(default_factory=list)


class ReviewConclusion(BaseModel):
    reviewer: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    approved: bool = False
    comments: str = ""
    decision_basis: List[str] = Field(default_factory=list)


class ProcessingTrace(BaseModel):
    original_input: str
    processing_steps: List[Dict[str, Any]] = Field(default_factory=list)
    final_conclusion: str = ""
    errors: List[str] = Field(default_factory=list)


class ChangeOrder(BaseModel):
    id: str
    title: str
    description: str
    creator: str
    created_at: datetime
    updated_at: datetime
    status: ChangeStatus
    sql_snippets: List[SQLSnippet]
    risk_score: RiskScore
    review_conclusion: Optional[ReviewConclusion] = None
    processing_trace: Optional[ProcessingTrace] = None
    is_dry_run: bool = False
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CreateChangeOrderRequest(BaseModel):
    title: str
    description: str = ""
    creator: str
    sql_contents: List[str]
    rollback_scripts: Optional[List[str]] = None
    is_dry_run: bool = False
    tags: List[str] = Field(default_factory=list)


class UpdateStatusRequest(BaseModel):
    status: ChangeStatus
    operator: str
    comments: str = ""
    manual_override: bool = False


class ManualCorrectionRequest(BaseModel):
    snippet_id: str
    corrected_sql: str
    corrected_rollback: Optional[str] = None
    corrector: str
    reason: str


class ErrorResponse(BaseModel):
    error_code: str
    error_message: str
    details: Dict[str, Any] = Field(default_factory=dict)
    suggestion: str = ""