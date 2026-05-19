from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field
from app.models.checklist import MissingLevel


class CheckReportItemResponse(BaseModel):
    id: int
    missing_level: MissingLevel
    category: str
    item_name: str
    description: Optional[str] = None
    owner: Optional[str] = None
    fixed: bool
    fixed_at: Optional[datetime] = None
    fixed_by: Optional[str] = None
    fix_note: Optional[str] = None

    class Config:
        from_attributes = True


class CheckReportResponse(BaseModel):
    id: int
    checklist_id: int
    report_no: str
    status: str
    generated_at: datetime
    generated_by: Optional[str] = None
    total_issues: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    summary: Optional[str] = None
    items: List[CheckReportItemResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class ManualFixRequest(BaseModel):
    item_id: int
    fixed: bool
    fixed_by: str
    fix_note: Optional[str] = None


class OwnerSummary(BaseModel):
    owner: str
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    total: int = 0
