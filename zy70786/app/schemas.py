from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator

from app.models import BuildStatus, ViolationType


class ChunkModuleBase(BaseModel):
    module_path: str
    module_size: float
    package_name: Optional[str] = None
    is_third_party: bool = False


class ChunkModuleCreate(ChunkModuleBase):
    pass


class ChunkModuleResponse(ChunkModuleBase):
    id: int
    chunk_id: int

    class Config:
        from_attributes = True


class ChunkBase(BaseModel):
    chunk_name: str
    file_size: float
    gzip_size: Optional[float] = None
    budget_size: Optional[float] = None
    is_initial: bool = False
    is_async: bool = False
    modules: List[ChunkModuleCreate] = Field(default_factory=list)


class ChunkCreate(ChunkBase):
    pass


class ChunkResponse(ChunkBase):
    id: int
    artifact_id: int
    modules: List[ChunkModuleResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class BuildArtifactBase(BaseModel):
    build_id: str
    project_name: str
    branch: Optional[str] = None
    commit_hash: Optional[str] = None
    built_at: Optional[datetime] = None
    chunks: List[ChunkCreate] = Field(default_factory=list)


class BuildArtifactCreate(BuildArtifactBase):
    @field_validator('build_id', 'project_name')
    def not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()


class BuildArtifactResponse(BuildArtifactBase):
    id: int
    status: BuildStatus
    total_size: float
    chunk_count: int
    created_at: datetime
    updated_at: datetime
    chunks: List[ChunkResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class BuildArtifactUpdate(BaseModel):
    status: Optional[BuildStatus] = None
    notes: Optional[str] = None


class BudgetRuleBase(BaseModel):
    project_name: str
    chunk_pattern: str
    budget_size_kb: float
    is_active: bool = True
    priority: int = 0


class BudgetRuleCreate(BudgetRuleBase):
    pass


class BudgetRuleResponse(BudgetRuleBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ViolationBase(BaseModel):
    violation_type: ViolationType
    actual_size: float
    budget_size: Optional[float] = None
    excess_size: Optional[float] = None
    growth_rate: Optional[float] = None
    reason: Optional[str] = None
    needs_review: bool = False


class ViolationCreate(ViolationBase):
    chunk_name: str


class ViolationResponse(ViolationBase):
    id: int
    chunk_id: int
    report_id: int
    reviewed: bool
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None

    class Config:
        from_attributes = True


class BudgetReportBase(BaseModel):
    pass


class BudgetReportCreate(BudgetReportBase):
    artifact_id: int


class BudgetReportResponse(BaseModel):
    id: int
    artifact_id: int
    report_hash: str
    total_violations: int
    critical_violations: int
    warning_violations: int
    total_excess_kb: float
    generated_at: datetime
    is_processed: bool
    processed_at: Optional[datetime] = None
    notes: Optional[str] = None
    violations: List[ViolationResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class BudgetAnalysisRequest(BaseModel):
    build_id: str
    project_name: str


class BudgetReportFilter(BaseModel):
    project_name: Optional[str] = None
    branch: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    has_violations: Optional[bool] = None
    is_processed: Optional[bool] = None
    needs_review: Optional[bool] = None


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class SuccessResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
