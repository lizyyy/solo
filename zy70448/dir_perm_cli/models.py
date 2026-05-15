from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED = "skipped"


class CheckStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"
    SKIPPED = "skipped"


class ApprovalNode(BaseModel):
    node_id: str
    node_name: str
    approver: Optional[str] = None
    status: ApprovalStatus = ApprovalStatus.PENDING
    comment: Optional[str] = None
    approved_at: Optional[datetime] = None
    attachment_before: Optional[str] = None
    attachment_after: Optional[str] = None


class DevicePermissionItem(BaseModel):
    device_id: str
    device_name: str
    store_name: str
    permission_type: str
    permission_target: str
    applicant: str
    application_reason: str


class MeetingAttachment(BaseModel):
    file_name: str
    content_before: Optional[str] = None
    content_after: Optional[str] = None
    modification_note: Optional[str] = None


class SubmissionMaterial(BaseModel):
    submission_id: str = Field(default_factory=lambda: f"SUB{datetime.now().strftime('%Y%m%d%H%M%S')}")
    batch_id: str
    title: str
    department: str
    submitter: str
    submitted_at: datetime = Field(default_factory=datetime.now)
    permission_items: List[DevicePermissionItem]
    approval_nodes: List[ApprovalNode]
    meeting_attachments: List[MeetingAttachment] = Field(default_factory=list)
    material_hash: str
    raw_data: Dict[str, Any]


class CheckResult(BaseModel):
    check_id: str
    check_name: str
    status: CheckStatus
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)
    affected_items: List[str] = Field(default_factory=list)


class DriftConclusion(BaseModel):
    conclusion_id: str
    submission_id: str
    batch_id: str
    overall_status: CheckStatus
    check_results: List[CheckResult]
    generated_at: datetime = Field(default_factory=datetime.now)
    reviewer: Optional[str] = None
    review_comment: Optional[str] = None
