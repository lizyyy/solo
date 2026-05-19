from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.core.constants import TaskStatus, DiffType


class LogDirectoryBase(BaseModel):
    name: str
    path: str
    file_pattern: Optional[str] = "*.log"
    description: Optional[str] = None
    is_active: Optional[bool] = True


class LogDirectoryCreate(LogDirectoryBase):
    pass


class LogDirectoryUpdate(BaseModel):
    name: Optional[str] = None
    path: Optional[str] = None
    file_pattern: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class LogDirectory(LogDirectoryBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MaskingRuleBase(BaseModel):
    name: str
    pattern: str
    replacement: Optional[str] = "***"
    priority: Optional[int] = 0
    rule_type: Optional[str] = "regex"
    description: Optional[str] = None
    is_active: Optional[bool] = True


class MaskingRuleCreate(MaskingRuleBase):
    pass


class MaskingRuleUpdate(BaseModel):
    name: Optional[str] = None
    pattern: Optional[str] = None
    replacement: Optional[str] = None
    priority: Optional[int] = None
    rule_type: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class MaskingRule(MaskingRuleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RetainedFieldBase(BaseModel):
    field_name: str
    field_pattern: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = True


class RetainedFieldCreate(RetainedFieldBase):
    pass


class RetainedFieldUpdate(BaseModel):
    field_name: Optional[str] = None
    field_pattern: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class RetainedField(RetainedFieldBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RiskWordBase(BaseModel):
    word: str
    severity: Optional[str] = "medium"
    category: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = True


class RiskWordCreate(RiskWordBase):
    pass


class RiskWordUpdate(BaseModel):
    word: Optional[str] = None
    severity: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class RiskWord(RiskWordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RegressionTaskBase(BaseModel):
    name: str
    log_directory_id: int
    created_by: Optional[str] = None


class RegressionTaskCreate(RegressionTaskBase):
    pass


class RegressionTaskUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[TaskStatus] = None


class RegressionTask(RegressionTaskBase):
    id: int
    status: TaskStatus
    total_files: int
    total_lines: int
    processed_lines: int
    failed_lines: int
    diff_count: int
    risk_score: float
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RegressionResultBase(BaseModel):
    task_id: int
    file_path: str
    line_number: int
    original_content: str
    masked_content: str
    applied_rules: Optional[str] = None
    is_matched: bool = True


class RegressionResultCreate(RegressionResultBase):
    pass


class RegressionResult(RegressionResultBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DiffReportBase(BaseModel):
    task_id: int
    result_id: int
    diff_type: DiffType
    field_name: Optional[str] = None
    original_value: Optional[str] = None
    masked_value: Optional[str] = None
    expected_value: Optional[str] = None
    severity: Optional[str] = "medium"
    description: Optional[str] = None


class DiffReportCreate(DiffReportBase):
    pass


class DiffReportUpdate(BaseModel):
    is_reviewed: Optional[bool] = False
    reviewed_by: Optional[str] = None


class DiffReport(DiffReportBase):
    id: int
    is_reviewed: bool
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FailedRecordBase(BaseModel):
    task_id: int
    file_path: str
    line_number: int
    original_content: str
    error_type: str
    error_message: Optional[str] = None


class FailedRecordCreate(FailedRecordBase):
    pass


class FailedRecordUpdate(BaseModel):
    is_resolved: Optional[bool] = False
    resolved_by: Optional[str] = None


class FailedRecord(FailedRecordBase):
    id: int
    is_resolved: bool
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExportRequest(BaseModel):
    task_ids: List[int]
    format: str = Field(default="json", pattern="^(json|markdown)$")


class DiffReviewRequest(BaseModel):
    diff_ids: List[int]
    reviewed_by: str
