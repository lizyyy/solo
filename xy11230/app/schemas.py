from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from app.models import FaultType, TicketStatus, DispatchStatus, ReviewResult, RuleAction


class CabinetBase(BaseModel):
    cabinet_code: str
    location: Optional[str] = None
    is_online: Optional[bool] = True


class CabinetCreate(CabinetBase):
    pass


class Cabinet(CabinetBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TicketBase(BaseModel):
    ticket_no: str
    cabinet_code: str
    fault_type: Optional[FaultType] = None
    fault_description: Optional[str] = None
    bin_number: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None
    source: Optional[str] = None


class TicketCreate(TicketBase):
    pass


class TicketUpdate(BaseModel):
    fault_type: Optional[FaultType] = None
    fault_description: Optional[str] = None
    bin_number: Optional[str] = None


class Ticket(TicketBase):
    id: int
    status: TicketStatus
    attributed_reason: Optional[str] = None
    attributed_by: Optional[str] = None
    attributed_at: Optional[datetime] = None
    reviewed_result: Optional[ReviewResult] = None
    reviewed_comment: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rule_applied: Optional[str] = None
    rule_action: Optional[RuleAction] = None
    rule_reason: Optional[str] = None
    merged_to_ticket_id: Optional[int] = None
    import_batch_no: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DispatchBase(BaseModel):
    technician_id: str
    technician_name: str
    scheduled_at: Optional[datetime] = None


class DispatchCreate(DispatchBase):
    ticket_id: int


class DispatchUpdate(BaseModel):
    status: Optional[DispatchStatus] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    repair_description: Optional[str] = None
    before_status: Optional[str] = None
    after_status: Optional[str] = None


class Dispatch(DispatchBase):
    id: int
    dispatch_no: str
    ticket_id: int
    status: DispatchStatus
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TicketLogBase(BaseModel):
    ticket_id: int
    action: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    operator: Optional[str] = None
    reason: Optional[str] = None


class TicketLogCreate(TicketLogBase):
    pass


class TicketLog(TicketLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BatchResult(BaseModel):
    success: List[dict]
    failed: List[dict]
    total: int
    success_count: int
    fail_count: int


class RuleResult(BaseModel):
    action: RuleAction
    rule_name: str
    reason: str
    target_ticket_id: Optional[int] = None


class ExportFilter(BaseModel):
    status: Optional[List[TicketStatus]] = None
    fault_type: Optional[List[FaultType]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    cabinet_code: Optional[str] = None
