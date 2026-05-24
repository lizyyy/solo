from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional
from enum import Enum


class WindowStatus(str, Enum):
    PENDING = "pending"
    VALIDATING = "validating"
    CONFLICT = "conflict"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"
    MODIFIED = "modified"
    EXECUTING = "executing"
    CLOSED = "closed"
    ARCHIVED = "archived"


class MaintenanceWindowBase(BaseModel):
    request_id: str = Field(..., description="申请编号")
    line_section: str = Field(..., description="线路区间")
    start_time: datetime = Field(..., description="开始时间")
    end_time: datetime = Field(..., description="结束时间")
    work_summary: Optional[str] = Field(None, description="作业内容摘要")
    applicant: Optional[str] = Field(None, description="申请人")
    applicant_department: Optional[str] = Field(None, description="申请部门")


class MaintenanceWindowCreate(MaintenanceWindowBase):
    pass


class MaintenanceWindowUpdate(BaseModel):
    line_section: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    work_summary: Optional[str] = None
    applicant: Optional[str] = None
    applicant_department: Optional[str] = None
    status: Optional[str] = None


class ConflictDetail(BaseModel):
    type: str
    conflict_with: Optional[str] = None
    conflict_window_id: Optional[int] = None
    line_section: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    description: str


class ValidationResult(BaseModel):
    window_id: int
    request_id: str
    valid: bool
    conflict_count: int
    conflicts: List[ConflictDetail]


class MaintenanceWindowResponse(BaseModel):
    id: int
    request_id: str
    status: str
    line_section: str
    start_time: str
    end_time: str
    is_cross_day: bool
    work_summary: Optional[str] = None
    applicant: Optional[str] = None
    applicant_department: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    final_conclusion: Optional[str] = None
    closed_at: Optional[str] = None
    source_system: Optional[str] = None
    version: Optional[int] = None

    class Config:
        from_attributes = True


class CloseWindowRequest(BaseModel):
    final_conclusion: Optional[str] = None


class ExportResponse(BaseModel):
    export_time: str
    total_count: int
    status_filter: Optional[str] = None
    line_section_filter: Optional[str] = None
    data: List[MaintenanceWindowResponse]
