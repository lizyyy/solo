from typing import Optional, Dict, Any
from pydantic import Field
from .base import BaseModel, ConflictStatus


class ConflictEvidence(BaseModel):
    field_name: str
    notice_value: Any
    ramp_value: Any
    description: str


class ConflictRecord(BaseModel):
    construction_notice_id: str
    ramp_record_id: str
    evidences: list[ConflictEvidence] = Field(default_factory=list)
    status: ConflictStatus = ConflictStatus.PENDING
    planner_decision: Optional[str] = None
    planner_note: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[str] = None
