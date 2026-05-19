from datetime import datetime
from typing import Optional
from app.schemas.common import BaseSchema


class BerthBase(BaseSchema):
    berth_number: str
    terminal: Optional[str] = None
    description: Optional[str] = None
    depth_at_mllw: float
    max_draft: Optional[float] = None
    min_depth: Optional[float] = None
    length: Optional[float] = None
    max_vessel_length: Optional[float] = None
    is_available: bool = True
    unavailable_reason: Optional[str] = None
    unavailable_from: Optional[datetime] = None
    unavailable_to: Optional[datetime] = None
    allowed_vessel_types: Optional[str] = None
    allowed_cargo_types: Optional[str] = None
    priority: int = 0
    notes: Optional[str] = None


class BerthCreate(BerthBase):
    source_file: Optional[str] = None
    batch_id: Optional[str] = None


class BerthUpdate(BaseSchema):
    depth_at_mllw: Optional[float] = None
    is_available: Optional[bool] = None
    unavailable_reason: Optional[str] = None
    unavailable_from: Optional[datetime] = None
    unavailable_to: Optional[datetime] = None
    notes: Optional[str] = None


class BerthResponse(BerthBase):
    id: int
    source_file: Optional[str] = None
    batch_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
