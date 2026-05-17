from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, field_validator
from app.models import RepairOrderStatus, UrgencyLevel


class HandlerBase(BaseModel):
    name: str
    phone: str
    department: str
    is_outsourcer: bool = False


class HandlerCreate(HandlerBase):
    pass


class Handler(HandlerBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class ReminderBase(BaseModel):
    reminder_method: str
    reminder_content: str
    operator: str


class ReminderCreate(ReminderBase):
    repair_order_id: int


class Reminder(ReminderBase):
    id: int
    repair_order_id: int
    reminder_time: datetime
    is_merged: bool
    merged_into_id: Optional[int] = None
    created_at: datetime

    class Config:
        orm_mode = True


class OutsourcingBase(BaseModel):
    outsourcer_name: str
    outsourcer_contact: str
    promised_completion_time: Optional[datetime] = None
    cost: Optional[float] = None
    remarks: Optional[str] = None


class OutsourcingCreate(OutsourcingBase):
    repair_order_id: int


class OutsourcingUpdate(BaseModel):
    outsourcer_name: Optional[str] = None
    outsourcer_contact: Optional[str] = None
    promised_completion_time: Optional[datetime] = None
    actual_completion_time: Optional[datetime] = None
    cost: Optional[float] = None
    status: Optional[str] = None
    remarks: Optional[str] = None


class Outsourcing(OutsourcingBase):
    id: int
    repair_order_id: int
    dispatch_time: datetime
    actual_completion_time: Optional[datetime] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class CompletionProofBase(BaseModel):
    proof_type: str
    proof_content: str
    image_urls: Optional[str] = None
    submitter: str


class CompletionProofCreate(CompletionProofBase):
    repair_order_id: int


class CompletionProofVerify(BaseModel):
    verifier: str
    is_verified: bool
    verify_remarks: Optional[str] = None


class CompletionProof(CompletionProofBase):
    id: int
    repair_order_id: int
    submit_time: datetime
    verifier: Optional[str] = None
    verify_time: Optional[datetime] = None
    is_verified: bool
    verify_remarks: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True


class ExceptionRecordBase(BaseModel):
    operation_type: str
    original_input: str
    operator: str
    conclusion: str


class ExceptionRecordCreate(ExceptionRecordBase):
    repair_order_id: int


class ExceptionRecord(ExceptionRecordBase):
    id: int
    repair_order_id: int
    created_at: datetime

    class Config:
        orm_mode = True


class RepairOrderBase(BaseModel):
    building: str
    room_number: str
    contact_name: str
    contact_phone: str
    issue_type: str
    description: str
    urgency: UrgencyLevel = UrgencyLevel.MEDIUM
    timeout_hours: int = 24


class RepairOrderCreate(RepairOrderBase):
    pass


class RepairOrderUpdate(BaseModel):
    building: Optional[str] = None
    room_number: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    issue_type: Optional[str] = None
    description: Optional[str] = None
    urgency: Optional[UrgencyLevel] = None
    status: Optional[RepairOrderStatus] = None
    handler_id: Optional[int] = None
    timeout_hours: Optional[int] = None


class RepairOrder(RepairOrderBase):
    id: int
    order_no: str
    status: RepairOrderStatus
    handler_id: Optional[int] = None
    is_timeout: bool
    is_duplicated: bool
    original_order_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    handler: Optional[Handler] = None
    reminders: List[Reminder] = []
    outsourcing: Optional[Outsourcing] = None
    completion_proof: Optional[CompletionProof] = None
    exception_records: List[ExceptionRecord] = []

    class Config:
        orm_mode = True


class RepairOrderDetail(RepairOrder):
    duplicates: List["RepairOrder"] = Field(default_factory=list)

    @field_validator("duplicates", mode="before")
    @classmethod
    def empty_list_if_none(cls, v: Any) -> Any:
        return v or []


class StatusTransition(BaseModel):
    target_status: RepairOrderStatus
    operator: str
    remarks: Optional[str] = None


class ManualCorrection(BaseModel):
    field_name: str
    old_value: str
    new_value: str
    operator: str
    reason: str


class ExportQuery(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[List[RepairOrderStatus]] = None
    building: Optional[str] = None
    is_timeout: Optional[bool] = None
    is_outsourced: Optional[bool] = None
