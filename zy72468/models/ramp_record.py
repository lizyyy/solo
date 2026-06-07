from datetime import date
from typing import Optional
from pydantic import Field
from .base import BaseModel, RecordStatus


class RampRecordSupplement(BaseModel):
    ramp_location: str
    ramp_type: str
    has_ramp: bool
    ramp_condition: Optional[str] = None
    accessible: bool
    survey_date: date
    surveyor: str
    construction_notice_id: Optional[str] = None
    remark: Optional[str] = None


class RampRecord(RampRecordSupplement):
    status: RecordStatus = RecordStatus.SUPPLEMENTED
    conflict_ids: list[str] = Field(default_factory=list)
    matched_notice: bool = False
