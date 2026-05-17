from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.models import RepairStatus, UrgencyLevel


class BuildingBase(BaseModel):
    building_name: str
    unit_number: str
    room_number: str
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None


class BuildingCreate(BuildingBase):
    pass


class Building(BuildingBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class HandlerBase(BaseModel):
    name: str
    phone: Optional[str] = None
    department: Optional[str] = None
    is_outsourcer: bool = False
    company_name: Optional[str] = None
    skills: Optional[str] = None


class HandlerCreate(HandlerBase):
    pass


class Handler(HandlerBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        orm_mode = True


class ReminderRecordBase(BaseModel):
    reminder_method: Optional[str] = None
    reminder_content: Optional[str] = None
    reminder_by: Optional[str] = None


class ReminderRecordCreate(ReminderRecordBase):
    repair_order_id: int


class ReminderRecord(ReminderRecordBase):
    id: int
    repair_order_id: int
    reminder_time: datetime
    is_duplicate: bool
    created_at: datetime

    class Config:
        orm_mode = True


class OutsourcingRecordBase(BaseModel):
    outsourcer_id: int
    expected_completion: Optional[datetime] = None
    cost_estimate: Optional[int] = None
    actual_cost: Optional[int] = None
    status: Optional[str] = "pending"
    notes: Optional[str] = None


class OutsourcingRecordCreate(OutsourcingRecordBase):
    repair_order_id: int


class OutsourcingRecord(OutsourcingRecordBase):
    id: int
    repair_order_id: int
    outsourcing_time: datetime
    created_at: datetime

    class Config:
        orm_mode = True


class CompletionProofBase(BaseModel):
    proof_type: Optional[str] = None
    proof_url: Optional[str] = None
    description: Optional[str] = None
    uploaded_by: Optional[str] = None


class CompletionProofCreate(CompletionProofBase):
    repair_order_id: int


class CompletionProof(CompletionProofBase):
    id: int
    repair_order_id: int
    uploaded_at: datetime
    is_verified: bool
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class AuditLogBase(BaseModel):
    action: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    operator: Optional[str] = None
    original_input: Optional[str] = None
    conclusion: Optional[str] = None
    reason: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    repair_order_id: int


class AuditLog(AuditLogBase):
    id: int
    repair_order_id: int
    created_at: datetime

    class Config:
        orm_mode = True


class RepairOrderBase(BaseModel):
    building_id: int
    reporter_name: Optional[str] = None
    reporter_phone: Optional[str] = None
    repair_type: Optional[str] = None
    description: Optional[str] = None
    urgency: Optional[UrgencyLevel] = UrgencyLevel.MEDIUM


class RepairOrderCreate(RepairOrderBase):
    pass


class RepairOrderUpdate(BaseModel):
    reporter_name: Optional[str] = None
    reporter_phone: Optional[str] = None
    repair_type: Optional[str] = None
    description: Optional[str] = None
    urgency: Optional[UrgencyLevel] = None
    handler_id: Optional[int] = None
    expected_completion_time: Optional[datetime] = None


class RepairOrder(RepairOrderBase):
    id: int
    order_no: str
    status: RepairStatus
    handler_id: Optional[int] = None
    reported_at: datetime
    expected_completion_time: Optional[datetime] = None
    actual_completion_time: Optional[datetime] = None
    is_overdue: bool
    is_duplicate: bool
    merged_into_order_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    reminders: List[ReminderRecord] = []
    outsourcing_records: List[OutsourcingRecord] = []
    completion_proofs: List[CompletionProof] = []
    audit_logs: List[AuditLog] = []
    building: Optional[Building] = None
    handler: Optional[Handler] = None

    class Config:
        orm_mode = True


class StatusUpdate(BaseModel):
    new_status: RepairStatus
    operator: str
    reason: Optional[str] = None
    original_input: Optional[str] = None
    conclusion: Optional[str] = None


class ReminderCreate(BaseModel):
    reminder_method: Optional[str] = None
    reminder_content: Optional[str] = None
    reminder_by: Optional[str] = None


class OutsourcingCreate(BaseModel):
    outsourcer_id: int
    expected_completion: Optional[datetime] = None
    cost_estimate: Optional[int] = None
    notes: Optional[str] = None


class CompletionProofUpload(BaseModel):
    proof_type: Optional[str] = None
    proof_url: Optional[str] = None
    description: Optional[str] = None
    uploaded_by: Optional[str] = None


class OrderMerge(BaseModel):
    target_order_id: int
    operator: str
    reason: Optional[str] = None


class ManualCorrection(BaseModel):
    field_name: str
    old_value: Optional[str] = None
    new_value: str
    operator: str
    reason: str
