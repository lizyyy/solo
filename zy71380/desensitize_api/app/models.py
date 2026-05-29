from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class RuleCreate(BaseModel):
    version: str = Field(..., pattern=r"^\d+\.\d+\.\d+$")
    name: str
    description: str = ""
    pattern: str = r"1[3-9]\d{9}"
    replacement_template: str = "{prefix}****{suffix}"
    field_paths: list[str] = Field(default_factory=lambda: ["phone", "mobile", "tel", "contact.phone", "user.phone"])
    mask_start: int = 3
    mask_end: int = 4
    mask_char: str = "*"
    parent_version: Optional[str] = None


class RuleResponse(BaseModel):
    id: int
    version: str
    name: str
    description: str
    pattern: str
    replacement_template: str
    field_paths: list[str]
    mask_start: int
    mask_end: int
    mask_char: str
    is_active: bool
    parent_version: Optional[str]
    created_at: str


class RuleActivateResponse(BaseModel):
    version: str
    is_active: bool
    message: str


class ScanRequest(BaseModel):
    source_type: str = Field(..., pattern=r"^(log|json|screenshot)$")
    source_data: str
    rule_version: Optional[str] = None


class ScanTaskResponse(BaseModel):
    id: int
    rule_version: str
    source_type: str
    status: str
    total_fields: int
    inconsistent_count: int
    blocked_count: int
    created_at: str
    completed_at: Optional[str]


class ScanResultItem(BaseModel):
    id: int
    task_id: int
    processing_order: int
    field_path: str
    original_value: str
    desensitized_value: str
    expected_value: str
    is_consistent: bool
    block_reason: Optional[str]
    exception_id: Optional[int]
    source_location: str


class ScanResultListResponse(BaseModel):
    task: ScanTaskResponse
    results: list[ScanResultItem]


class ExceptionCreate(BaseModel):
    phone_pattern: str
    reason: str = ""
    source: str = "all"
    field_path: Optional[str] = None
    expires_at: Optional[str] = None


class ExceptionUpdate(BaseModel):
    reason: Optional[str] = None
    expires_at: Optional[str] = None
    status: Optional[str] = None


class ExceptionResponse(BaseModel):
    id: int
    phone_pattern: str
    reason: str
    source: str
    field_path: Optional[str]
    expires_at: Optional[str]
    status: str
    is_expired: bool
    created_at: str
    updated_at: str


class ReportGenerateRequest(BaseModel):
    task_id: int
    export_format: str = Field(default="json", pattern=r"^(json|csv)$")


class ReportResponse(BaseModel):
    id: int
    task_id: int
    rule_snapshot: dict
    exception_snapshot: list
    summary: dict
    details: list
    export_format: str
    created_at: str


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
