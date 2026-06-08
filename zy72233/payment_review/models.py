from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List
from enum import Enum

class ReviewStatus(Enum):
    TO_IMPORT = "待导入"
    PENDING_REVIEW = "待复核"
    SUPPLEMENTING = "补录中"
    MANAGER_REVIEW = "客户经理复核"
    COMPLETED = "已完成"

class IssueType(Enum):
    PINYIN_APPROVER = "审批人拼音"
    MISSING_XR_SCREENSHOT = "缺少除权日截图"
    AMOUNT_MISMATCH = "金额不匹配"
    DATE_MISMATCH = "日期不匹配"

class NextStep(Enum):
    CONTACT_MANAGER = "联系客户经理"
    CONTACT_LIN = "联系基金会计林姐"
    SUPPLEMENT_MATERIALS = "补录材料"
    RERUN = "系统重跑"

@dataclass
class Approver:
    name: str
    is_pinyin: bool = False
    full_name: Optional[str] = None

@dataclass
class BalanceChange:
    date: str
    before_amount: float
    change_amount: float
    after_amount: float
    reason: str = ""
    missing_materials: List[str] = field(default_factory=list)
    next_step: Optional[str] = None
    has_xr_screenshot: bool = False

@dataclass
class AuditEvent:
    timestamp: str
    action: str
    actor: str
    detail: str = ""

@dataclass
class PaymentRecord:
    id: str
    payment_date: str
    amount: float
    currency: str
    payee: str
    approver: Approver
    balance_change: Optional[BalanceChange]
    status: ReviewStatus = ReviewStatus.TO_IMPORT
    issues: List[IssueType] = field(default_factory=list)
    xr_screenshot_path: Optional[str] = None
    corrections: List[str] = field(default_factory=list)
    rerun_count: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    notes: str = ""
    audit_trail: List[AuditEvent] = field(default_factory=list)

    def update_status(self, new_status: ReviewStatus):
        self.status = new_status
        self.updated_at = datetime.now()

    def add_correction(self, correction: str):
        self.corrections.append(correction)
        self.updated_at = datetime.now()

    def mark_rerun(self):
        self.rerun_count += 1
        self.updated_at = datetime.now()

    def add_audit_event(self, action: str, actor: str, detail: str = ""):
        event = AuditEvent(
            timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            action=action,
            actor=actor,
            detail=detail
        )
        self.audit_trail.append(event)
        self.updated_at = datetime.now()
