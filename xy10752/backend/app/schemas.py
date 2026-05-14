from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class TicketBase(BaseModel):
    ticket_no: str
    title: str
    description: Optional[str] = None
    priority: str = "normal"
    assignee: Optional[str] = None
    creator: str
    sla_rule_id: Optional[int] = None


class TicketCreate(TicketBase):
    pass


class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assignee: Optional[str] = None


class TicketResponse(TicketBase):
    id: int
    status: str
    current_sla_status: str
    total_used_hours: float
    remaining_hours: float
    sla_deadline: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SLARuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    priority: str
    response_hours: float
    resolution_hours: float
    work_start_hour: int = 9
    work_end_hour: int = 18
    work_days: str = "1,2,3,4,5"


class SLARuleCreate(SLARuleBase):
    pass


class SLARuleResponse(SLARuleBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PauseReasonBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None


class PauseReasonCreate(PauseReasonBase):
    pass


class PauseReasonResponse(PauseReasonBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PauseRecordBase(BaseModel):
    ticket_id: int
    pause_reason_id: Optional[int] = None
    pause_reason_code: Optional[str] = None
    pause_reason_name: Optional[str] = None
    paused_by: str
    remarks: Optional[str] = None


class PauseRecordCreate(PauseRecordBase):
    pass


class PauseRecordResponse(PauseRecordBase):
    id: int
    paused_at: datetime
    resumed_at: Optional[datetime] = None
    pause_duration_hours: float
    is_active: bool

    class Config:
        from_attributes = True


class HolidayBase(BaseModel):
    date: str
    name: str
    type: str = "holiday"


class HolidayCreate(HolidayBase):
    pass


class HolidayResponse(HolidayBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class EscalationRecordBase(BaseModel):
    ticket_id: int
    escalation_type: str
    escalation_level: int = 1
    escalated_by: Optional[str] = None
    escalated_to: Optional[str] = None
    reason: Optional[str] = None


class EscalationRecordCreate(EscalationRecordBase):
    pass


class EscalationRecordResponse(EscalationRecordBase):
    id: int
    escalated_at: datetime
    status: str
    handled_at: Optional[datetime] = None
    handled_by: Optional[str] = None
    remarks: Optional[str] = None

    class Config:
        from_attributes = True


class ApprovalRecordBase(BaseModel):
    ticket_id: int
    approval_type: str
    applicant: str
    reason: Optional[str] = None


class ApprovalRecordCreate(ApprovalRecordBase):
    pass


class ApprovalRecordResponse(ApprovalRecordBase):
    id: int
    approver: Optional[str] = None
    status: str
    requested_at: datetime
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    approval_remarks: Optional[str] = None

    class Config:
        from_attributes = True


class SLATimelineBase(BaseModel):
    ticket_id: int
    event_type: str
    event_title: str
    event_detail: Optional[str] = None
    operator: Optional[str] = None
    sla_impact_hours: float = 0.0


class SLATimelineCreate(SLATimelineBase):
    pass


class SLATimelineResponse(SLATimelineBase):
    id: int
    happened_at: datetime
    remaining_before: Optional[float] = None
    remaining_after: Optional[float] = None

    class Config:
        from_attributes = True


class SLACompensationBase(BaseModel):
    ticket_id: int
    compensation_type: str
    compensation_hours: float
    reason: Optional[str] = None
    operator: str


class SLACompensationCreate(SLACompensationBase):
    pass


class SLACompensationResponse(SLACompensationBase):
    id: int
    created_at: datetime
    approved_by: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class TicketDetailResponse(BaseModel):
    ticket: TicketResponse
    sla_rule: Optional[SLARuleResponse] = None
    timeline: List[SLATimelineResponse] = []
    pause_records: List[PauseRecordResponse] = []
    escalation_records: List[EscalationRecordResponse] = []
    approval_records: List[ApprovalRecordResponse] = []
    compensation_records: List[SLACompensationResponse] = []

    class Config:
        from_attributes = True


class SLACalculationRequest(BaseModel):
    ticket_id: int
    recalculate: bool = False


class SLACalculationResponse(BaseModel):
    ticket_id: int
    remaining_hours: float
    used_hours: float
    sla_deadline: Optional[datetime] = None
    sla_status: str
    calculation_time: datetime


class PauseRequest(BaseModel):
    ticket_id: int
    pause_reason_code: str
    paused_by: str
    remarks: Optional[str] = None


class ResumeRequest(BaseModel):
    ticket_id: int
    resumed_by: str


class CompensationRequest(BaseModel):
    ticket_id: int
    compensation_type: str
    compensation_hours: float
    reason: str
    operator: str


class ApprovalRequest(BaseModel):
    ticket_id: int
    approval_type: str
    applicant: str
    reason: Optional[str] = None


class ApprovalActionRequest(BaseModel):
    approval_id: int
    action: str
    approver: str
    remarks: Optional[str] = None


class ReportRequest(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    ticket_ids: Optional[List[int]] = None
    status: Optional[str] = None


class ExportColumn(BaseModel):
    field: str
    display_name: str
    description: Optional[str] = None
