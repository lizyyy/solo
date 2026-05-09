from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from .models import InspectionStatus, RectificationStatus, PhotoType


class StoreBase(BaseModel):
    name: str
    code: str
    region: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None


class StoreCreate(StoreBase):
    pass


class StoreResponse(StoreBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class InspectionItemBase(BaseModel):
    name: str
    code: str
    category: Optional[str] = None
    description: Optional[str] = None
    base_score: float = 10.0


class InspectionItemCreate(InspectionItemBase):
    pass


class InspectionItemResponse(InspectionItemBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class InspectionBase(BaseModel):
    store_id: int
    inspector: Optional[str] = None
    remark: Optional[str] = None


class InspectionCreate(InspectionBase):
    pass


class InspectionResponse(BaseModel):
    id: int
    store_id: int
    store_name: Optional[str] = None
    inspector: Optional[str] = None
    inspection_date: datetime
    status: InspectionStatus
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InspectionRecordBase(BaseModel):
    item_id: int
    is_pass: bool = True
    deduction_reason: Optional[str] = None
    remark: Optional[str] = None


class InspectionRecordCreate(InspectionRecordBase):
    pass


class InspectionRecordResponse(BaseModel):
    id: int
    inspection_id: int
    item_id: int
    item_name: Optional[str] = None
    item_category: Optional[str] = None
    is_pass: bool
    score: float
    deduction: float
    deduction_reason: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RectificationBase(BaseModel):
    assignee: str
    deadline: datetime


class RectificationCreate(BaseModel):
    record_id: int
    assignee: str
    deadline: datetime


class RectificationSubmit(BaseModel):
    rectification_description: str


class RectificationRecheck(BaseModel):
    rechecker: str
    recheck_result: str
    recheck_remark: Optional[str] = None


class RectificationResponse(BaseModel):
    id: int
    record_id: int
    assignee: str
    status: RectificationStatus
    deadline: datetime
    rectification_description: Optional[str] = None
    rectification_at: Optional[datetime] = None
    rechecker: Optional[str] = None
    recheck_result: Optional[str] = None
    recheck_remark: Optional[str] = None
    recheck_at: Optional[datetime] = None
    final_score: Optional[float] = None
    final_deduction: float = 0.0
    retry_count: int
    parent_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PhotoEvidenceBase(BaseModel):
    photo_type: PhotoType
    file_path: str
    file_name: Optional[str] = None
    description: Optional[str] = None
    uploaded_by: Optional[str] = None


class PhotoEvidenceCreate(PhotoEvidenceBase):
    record_id: Optional[int] = None
    rectification_id: Optional[int] = None


class PhotoEvidenceResponse(BaseModel):
    id: int
    record_id: Optional[int] = None
    rectification_id: Optional[int] = None
    photo_type: PhotoType
    file_path: str
    file_name: Optional[str] = None
    description: Optional[str] = None
    uploaded_by: Optional[str] = None
    upload_time: datetime

    class Config:
        from_attributes = True


class DeductionRuleBase(BaseModel):
    name: str
    item_category: Optional[str] = None
    level: int
    base_deduction: float = 0.0
    overdue_multiplier: float = 1.0
    retry_penalty: float = 0.0
    description: Optional[str] = None


class DeductionRuleCreate(DeductionRuleBase):
    pass


class DeductionRuleResponse(DeductionRuleBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class EventResponse(BaseModel):
    id: int
    rectification_id: int
    event_type: str
    from_status: Optional[RectificationStatus] = None
    to_status: RectificationStatus
    actor: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RegionReport(BaseModel):
    region: str
    total_stores: int
    total_inspections: int
    total_issues: int
    total_rectifications: int
    passed_rectifications: int
    overdue_rectifications: int
    total_deduction: float
    avg_score: float
