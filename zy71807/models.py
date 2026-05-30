from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict


class ReviewStatus(str, Enum):
    PENDING_APPROVAL_SCREENSHOT = "pending_approval_screenshot"
    PENDING_SUPPLEMENT_EMAIL = "pending_supplement_email"
    PENDING_MANUAL_CONFIRM = "pending_manual_confirm"
    PENDING_RISK_REVIEW = "pending_risk_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    NEEDS_CORRECTION = "needs_correction"


class SourceType(str, Enum):
    BATCH_IMPORT = "batch_import"
    MANUAL_UPLOAD = "manual_upload"
    DAILY_REPORT = "daily_report"
    CORRECTION = "correction"


class EvidenceType(str, Enum):
    APPROVAL_SCREENSHOT = "approval_screenshot"
    SUPPLEMENT_EMAIL = "supplement_email"
    MANUAL_CONFIRMATION = "manual_confirmation"
    REVIEW_CHECKLIST = "review_checklist"
    OTHER = "other"


class ActionType(str, Enum):
    IMPORT = "import"
    UPDATE_STATUS = "update_status"
    ADD_EVIDENCE = "add_evidence"
    WITHDRAW = "withdraw"
    CORRECT = "correct"
    APPROVE = "approve"
    REJECT = "reject"
    EXPORT = "export"


STATUS_FLOW = {
    ReviewStatus.PENDING_APPROVAL_SCREENSHOT: [
        ReviewStatus.PENDING_SUPPLEMENT_EMAIL,
        ReviewStatus.WITHDRAWN,
        ReviewStatus.NEEDS_CORRECTION,
    ],
    ReviewStatus.PENDING_SUPPLEMENT_EMAIL: [
        ReviewStatus.PENDING_MANUAL_CONFIRM,
        ReviewStatus.WITHDRAWN,
        ReviewStatus.NEEDS_CORRECTION,
    ],
    ReviewStatus.PENDING_MANUAL_CONFIRM: [
        ReviewStatus.PENDING_RISK_REVIEW,
        ReviewStatus.WITHDRAWN,
        ReviewStatus.NEEDS_CORRECTION,
    ],
    ReviewStatus.PENDING_RISK_REVIEW: [
        ReviewStatus.APPROVED,
        ReviewStatus.REJECTED,
        ReviewStatus.WITHDRAWN,
        ReviewStatus.NEEDS_CORRECTION,
    ],
    ReviewStatus.NEEDS_CORRECTION: [
        ReviewStatus.PENDING_APPROVAL_SCREENSHOT,
        ReviewStatus.WITHDRAWN,
    ],
    ReviewStatus.WITHDRAWN: [
        ReviewStatus.PENDING_APPROVAL_SCREENSHOT,
    ],
    ReviewStatus.APPROVED: [],
    ReviewStatus.REJECTED: [],
}


PENDING_REASONS = {
    ReviewStatus.PENDING_APPROVAL_SCREENSHOT: "等待审批截图上传",
    ReviewStatus.PENDING_SUPPLEMENT_EMAIL: "缺少补充邮件，等待上传",
    ReviewStatus.PENDING_MANUAL_CONFIRM: "材料齐全，等待人工确认",
    ReviewStatus.PENDING_RISK_REVIEW: "已人工确认，等待风控经理复核",
    ReviewStatus.NEEDS_CORRECTION: "需要撤回修正",
    ReviewStatus.WITHDRAWN: "已撤回",
}


@dataclass
class Evidence:
    id: Optional[int] = None
    review_record_id: Optional[int] = None
    evidence_type: EvidenceType = EvidenceType.OTHER
    file_path: str = ""
    file_name: str = ""
    file_hash: str = ""
    uploaded_by: str = ""
    uploaded_at: datetime = field(default_factory=datetime.now)
    description: str = ""
    metadata: Dict = field(default_factory=dict)


@dataclass
class AuditLog:
    id: Optional[int] = None
    review_record_id: Optional[int] = None
    action_type: ActionType = ActionType.IMPORT
    operator: str = ""
    old_status: Optional[ReviewStatus] = None
    new_status: Optional[ReviewStatus] = None
    reason: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    details: Dict = field(default_factory=dict)


@dataclass
class ReviewRecord:
    id: Optional[int] = None
    customer_id: str = ""
    customer_name: str = ""
    questionnaire_id: str = ""
    questionnaire_version: str = ""
    source_type: SourceType = SourceType.BATCH_IMPORT
    source_batch_id: str = ""
    current_status: ReviewStatus = ReviewStatus.PENDING_APPROVAL_SCREENSHOT
    pending_reason: str = ""
    assigned_to: str = ""
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    evidences: List[Evidence] = field(default_factory=list)
    audit_logs: List[AuditLog] = field(default_factory=list)
    is_duplicate: bool = False
    duplicate_of_id: Optional[int] = None
    correction_note: str = ""

    def update_pending_reason(self) -> None:
        self.pending_reason = PENDING_REASONS.get(self.current_status, "")

    def can_transition_to(self, target_status: ReviewStatus) -> bool:
        return target_status in STATUS_FLOW.get(self.current_status, [])

    def get_evidence_by_type(self, evidence_type: EvidenceType) -> Optional[Evidence]:
        for ev in self.evidences:
            if ev.evidence_type == evidence_type:
                return ev
        return None

    def has_all_required_evidences(self) -> bool:
        has_screenshot = self.get_evidence_by_type(EvidenceType.APPROVAL_SCREENSHOT) is not None
        has_email = self.get_evidence_by_type(EvidenceType.SUPPLEMENT_EMAIL) is not None
        has_confirm = self.get_evidence_by_type(EvidenceType.MANUAL_CONFIRMATION) is not None
        return has_screenshot and has_email and has_confirm
