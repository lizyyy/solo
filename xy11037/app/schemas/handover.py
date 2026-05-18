from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.models.models import ShiftStatus


class MaternalCondition(BaseModel):
    room_number: str
    mother_name: str
    temperature: str
    lochia: str
    uterine_contraction: str
    wound_condition: str
    breastfeeding: str
    special_care: str
    notes: str


class BabyCondition(BaseModel):
    room_number: str
    baby_name: str
    gender: str
    temperature: str
    feeding: str
    defecation: str
    skin_condition: str
    jaundice: str
    status: str
    notes: str


class HandoverCreate(BaseModel):
    shift_date: str
    shift_type: str = "夜班"
    on_duty_nurse: str
    off_duty_nurse: str
    baby_count: int
    maternal_conditions: List[MaternalCondition] = []
    baby_conditions: List[BabyCondition] = []
    special_notes: str = ""
    equipment_status: str = ""
    emergency_supplies: str = ""
    next_shift_tasks: str = ""


class HandoverUpdate(BaseModel):
    shift_date: Optional[str] = None
    on_duty_nurse: Optional[str] = None
    off_duty_nurse: Optional[str] = None
    baby_count: Optional[int] = None
    maternal_conditions: Optional[List[MaternalCondition]] = None
    baby_conditions: Optional[List[BabyCondition]] = None
    special_notes: Optional[str] = None
    equipment_status: Optional[str] = None
    emergency_supplies: Optional[str] = None
    next_shift_tasks: Optional[str] = None
    remarks: Optional[str] = None


class HandoverSign(BaseModel):
    signer: str
    signature: str


class HandoverWithdraw(BaseModel):
    withdrawn_by: str
    reason: str


class HandoverManualProcess(BaseModel):
    flagged_by: str
    reason: str


class HandoverManualComplete(BaseModel):
    processed_by: str
    notes: str
    new_status: ShiftStatus


class ErrorResponse(BaseModel):
    error: str
    detail: str
    timestamp: str
