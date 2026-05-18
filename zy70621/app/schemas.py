from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class BuildingRoomBase(BaseModel):
    building: str
    room_number: str
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None


class BuildingRoomCreate(BuildingRoomBase):
    pass


class BuildingRoom(BuildingRoomBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class HandlerBase(BaseModel):
    name: str
    phone: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    is_outsource: bool = False


class HandlerCreate(HandlerBase):
    pass


class Handler(HandlerBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class ReminderBase(BaseModel):
    reminder_type: str = "normal"
    content: str
    reminded_by: str


class ReminderCreate(ReminderBase):
    pass


class Reminder(ReminderBase):
    id: int
    repair_order_id: int
    reminded_at: datetime
    is_duplicate: bool

    class Config:
        from_attributes = True


class OutsourceOrderBase(BaseModel):
    outsource_company_id: int
    estimated_cost: Optional[float] = None
    notes: Optional[str] = None


class OutsourceOrderCreate(OutsourceOrderBase):
    pass


class OutsourceOrder(OutsourceOrderBase):
    id: int
    repair_order_id: int
    outsource_order_no: str
    status: str
    dispatched_at: datetime
    accepted_at: Optional[datetime] = None
    actual_cost: Optional[float] = None

    class Config:
        from_attributes = True


class CompletionProofBase(BaseModel):
    proof_type: str
    proof_url: Optional[str] = None
    description: str


class CompletionProofCreate(CompletionProofBase):
    pass


class CompletionProof(CompletionProofBase):
    id: int
    repair_order_id: int
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    is_verified: bool
    verification_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class StatusLogBase(BaseModel):
    to_status: str
    operated_by: str
    operation_type: str
    notes: Optional[str] = None
    original_request: Optional[str] = None
    conclusion: Optional[str] = None


class StatusLogCreate(StatusLogBase):
    from_status: Optional[str] = None


class StatusLog(StatusLogBase):
    id: int
    repair_order_id: int
    from_status: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RepairOrderBase(BaseModel):
    repair_type: str
    description: str
    contact_name: str
    contact_phone: str
    priority: str = "normal"
    sla_hours: int = 24


class RepairOrderCreate(RepairOrderBase):
    building: str
    room_number: str


class RepairOrderUpdate(BaseModel):
    repair_type: Optional[str] = None
    description: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    priority: Optional[str] = None
    sla_hours: Optional[int] = None


class RepairOrder(RepairOrderBase):
    id: int
    order_no: str
    building_room_id: int
    status: str
    handler_id: Optional[int] = None
    reported_at: datetime
    expected_completion_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    is_overdue: bool
    is_merged: bool
    merged_into_order_id: Optional[int] = None
    reminder_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    building_room: BuildingRoom
    handler: Optional[Handler] = None
    reminders: List[Reminder] = []
    outsource_order: Optional[OutsourceOrder] = None
    completion_proof: Optional[CompletionProof] = None
    status_logs: List[StatusLog] = []

    class Config:
        from_attributes = True


class RepairOrderQuery(BaseModel):
    status: Optional[str] = None
    building: Optional[str] = None
    room_number: Optional[str] = None
    repair_type: Optional[str] = None
    is_overdue: Optional[bool] = None
    is_merged: Optional[bool] = None
    handler_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    page: int = 1
    page_size: int = 20


class StatusAdvanceRequest(BaseModel):
    operated_by: str
    notes: Optional[str] = None
    handler_id: Optional[int] = None
    original_request: Optional[str] = None
    conclusion: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    operated_by: str
    new_status: str
    notes: str
    original_request: Optional[str] = None
    conclusion: Optional[str] = None


class CloseOrderRequest(BaseModel):
    operated_by: str
    reason: str
    original_request: Optional[str] = None
    conclusion: Optional[str] = None


class MergeReminderRequest(BaseModel):
    operated_by: str
    merge_into_order_id: int
    notes: Optional[str] = None


class VerifyCompletionRequest(BaseModel):
    verified_by: str
    is_verified: bool
    verification_notes: Optional[str] = None


class ExportRequest(BaseModel):
    status: Optional[str] = None
    is_overdue: Optional[bool] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    export_type: str = "excel"