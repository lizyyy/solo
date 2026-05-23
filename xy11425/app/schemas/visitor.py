from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any, List


class VisitorRecordBase(BaseModel):
    visitor_name: Optional[str] = Field(None, max_length=100)
    visitor_phone: Optional[str] = Field(None, max_length=20)
    id_card: Optional[str] = Field(None, max_length=20)
    license_plate: Optional[str] = Field(None, max_length=20)
    visit_date: Optional[datetime] = None
    expected_end_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    gate_in_time: Optional[datetime] = None
    gate_out_time: Optional[datetime] = None
    is_overstay: Optional[bool] = False
    price_adjustment: Optional[float] = None
    review_status: Optional[str] = None
    review_comment: Optional[str] = None
    source: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class VisitorRecordUpdate(VisitorRecordBase):
    reviewed_by: Optional[str] = None


class VisitorRecordResponse(VisitorRecordBase):
    id: int
    batch_id: int
    material_id: Optional[int] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VisitorRecordListResponse(BaseModel):
    total: int
    items: List[VisitorRecordResponse]
    page: int
    page_size: int


class AuditLogResponse(BaseModel):
    id: int
    batch_id: Optional[int] = None
    visitor_record_id: Optional[int] = None
    action: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by: str
    changed_at: datetime
    ip_address: Optional[str] = None

    class Config:
        from_attributes = True
