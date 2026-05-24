from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from models import ScaffoldStatus


class AreaBase(BaseModel):
    name: str
    description: Optional[str] = None


class AreaCreate(AreaBase):
    pass


class Area(AreaBase):
    id: int
    is_deactivated: bool
    deactivated_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ScaffoldBase(BaseModel):
    scaffold_number: str
    type: Optional[str] = None
    height: Optional[float] = None
    specification: Optional[str] = None


class ScaffoldCreate(ScaffoldBase):
    area_id: int


class Scaffold(ScaffoldBase):
    id: int
    area_id: int
    is_deactivated: bool
    deactivated_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RectificationBase(BaseModel):
    description: str
    severity: str = "normal"
    item_no: Optional[str] = None


class RectificationCreate(RectificationBase):
    pass


class Rectification(RectificationBase):
    id: int
    acceptance_record_id: int
    scaffold_id: int
    is_closed: bool
    closed_at: Optional[datetime] = None
    closed_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PhotoBase(BaseModel):
    file_name: str
    photo_type: Optional[str] = None
    description: Optional[str] = None


class PhotoCreate(PhotoBase):
    file_path: str
    uploaded_by: Optional[str] = None


class Photo(PhotoBase):
    id: int
    file_path: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class AcceptanceRecordBase(BaseModel):
    batch_no: str
    inspector: Optional[str] = None
    inspection_date: Optional[datetime] = None
    created_by: Optional[str] = None


class AcceptanceRecordCreate(AcceptanceRecordBase):
    scaffold_id: int
    rectifications: List[RectificationCreate] = []


class AcceptanceRecord(AcceptanceRecordBase):
    id: int
    scaffold_id: int
    status: str
    is_accepted: bool
    rejection_reason: Optional[str] = None
    version: int
    submission_count: int
    created_at: datetime
    manual_override_by: Optional[str] = None
    manual_override_reason: Optional[str] = None
    manual_override_at: Optional[datetime] = None
    rectifications: List[Rectification] = []
    photos: List[Photo] = []

    class Config:
        from_attributes = True


class AcceptanceReportBase(BaseModel):
    report_no: str
    generated_by: Optional[str] = None


class AcceptanceReportCreate(AcceptanceReportBase):
    file_path: str


class AcceptanceReport(AcceptanceReportBase):
    id: int
    acceptance_record_id: int
    file_path: str
    generated_at: datetime

    class Config:
        from_attributes = True


class OperationLogBase(BaseModel):
    operation: str
    operator: Optional[str] = None
    reason: Optional[str] = None


class OperationLog(OperationLogBase):
    id: int
    acceptance_record_id: int
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    operation_time: datetime

    class Config:
        from_attributes = True


class AcceptanceResult(BaseModel):
    record_id: int
    status: str
    is_accepted: bool
    auto_check_passed: bool
    issues: List[str]
    rectification_count: int
    open_rectification_count: int
    photo_count: int
    requires_manual_review: bool


class ManualReviewRequest(BaseModel):
    operator: str
    reason: str
    approved: bool


class ReturnRequest(BaseModel):
    operator: str
    reason: str


class RectificationCloseRequest(BaseModel):
    operator: str
    verification_method: str


class StatisticsResponse(BaseModel):
    total_records: int
    total_accepted: int
    total_rejected: int
    total_deactivated: int
    pending_review: int
    open_rectifications: int
    photo_missing_count: int
    active_areas: int
    deactivated_areas: int
