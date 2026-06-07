from datetime import date
from typing import Optional, List
from pydantic import Field
from .base import BaseModel, RecordStatus


class PointItem(BaseModel):
    point_code: str
    point_name: str
    location: str
    charging_pile_count: int
    capacity_status: str
    queue_status: str
    accessible: bool
    affected_by_construction: bool = False
    construction_notice_ids: List[str] = Field(default_factory=list)
    ramp_record_id: Optional[str] = None
    remark: Optional[str] = None


class PointList(BaseModel):
    version: int = 1
    effective_date: date
    status: RecordStatus = RecordStatus.DRAFT
    items: List[PointItem] = Field(default_factory=list)
    generated_from_notices: List[str] = Field(default_factory=list)
    generated_from_ramps: List[str] = Field(default_factory=list)
    recalculation_note: Optional[str] = None
