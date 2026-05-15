from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.ticket import TicketStatus, ScanStatus


class TicketAttachmentResponse(BaseModel):
    id: int
    file_name: str
    file_type: Optional[str]
    file_size: Optional[int]
    version: int
    uploaded_by: Optional[str]
    content_preview: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ScanRecordResponse(BaseModel):
    id: int
    attachment_id: Optional[int]
    scan_type: str
    status: ScanStatus
    version: Optional[int]
    scan_result: Optional[str]
    risk_level: Optional[str]
    scanner: Optional[str]
    scanned_at: datetime

    class Config:
        from_attributes = True


class StatusLogResponse(BaseModel):
    id: int
    from_status: Optional[TicketStatus]
    to_status: TicketStatus
    operator: str
    reason: Optional[str]
    duty_record: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ManualNoteResponse(BaseModel):
    id: int
    original_conclusion: Optional[str]
    revised_conclusion: Optional[str]
    operator: str
    remark: str
    created_at: datetime

    class Config:
        from_attributes = True


class TicketCreate(BaseModel):
    ticket_no: str
    title: str
    applicant: str
    application_type: str
    description: Optional[str] = None


class TicketResponse(BaseModel):
    id: int
    ticket_no: str
    title: str
    applicant: str
    application_type: str
    description: Optional[str]
    status: TicketStatus
    current_version: int
    has_version_conflict: bool
    summary: Optional[str]
    conclusion: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TicketWithDetails(TicketResponse):
    attachments: List[TicketAttachmentResponse] = []
    scan_records: List[ScanRecordResponse] = []
    status_logs: List[StatusLogResponse] = []
    manual_notes: List[ManualNoteResponse] = []


class TicketScanRequest(BaseModel):
    ticket_no: str
    operator: str


class ManualNoteCreate(BaseModel):
    ticket_no: str
    revised_conclusion: str
    operator: str
    remark: str


class RollbackCandidate(BaseModel):
    ticket_id: int
    ticket_no: str
    title: str
    current_status: TicketStatus
    reason: str
    estimated_impact: str


class CleanupCandidate(BaseModel):
    ticket_id: int
    ticket_no: str
    title: str
    status: TicketStatus
    last_updated: datetime
    retention_days: int
    risk_assessment: str


class CandidateListResponse(BaseModel):
    candidates: List[dict]
    total_count: int
    generated_at: datetime
