from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict


class RecordType(Enum):
    NORMAL = "正常记录"
    LATE_ATTACHMENT = "晚到附件"
    DUPLICATE = "重复项"
    MANUAL_CORRECTION = "人工更正"


class RecordStatus(Enum):
    PENDING = "待处理"
    AUTO_APPROVED = "自动通过"
    AUTO_REJECTED = "自动拒绝"
    MANUAL_REVIEW = "需人工复核"
    FROZEN = "额度冻结"
    RELEASED = "额度已释放"
    FINALIZED = "已完成"


class ReviewResult(Enum):
    PASS = "复核通过"
    REJECT = "复核拒绝"
    NEED_MORE_INFO = "需补充材料"


@dataclass
class Attachment:
    id: str
    name: str
    uploaded_at: datetime
    is_late: bool = False
    note: Optional[str] = None


@dataclass
class AutoJudgement:
    judged_at: datetime
    judgement: str
    reason: str
    rule_applied: str
    confidence: float


@dataclass
class ReviewLog:
    id: str
    record_id: str
    reviewer: str
    reviewed_at: datetime
    result: ReviewResult
    comment: str
    previous_status: RecordStatus
    new_status: RecordStatus


@dataclass
class FrozenAmount:
    id: str
    record_id: str
    amount: float
    frozen_at: datetime
    frozen_reason: str
    released_at: Optional[datetime] = None
    released_reason: Optional[str] = None
    released_by: Optional[str] = None
    is_released: bool = False


@dataclass
class SaleFeeRecord:
    id: str
    serial_number: str
    sale_date: datetime
    product_code: str
    product_name: str
    expected_fee: float
    actual_fee: float
    tail_diff: float
    record_type: RecordType
    status: RecordStatus
    attachments: List[Attachment] = field(default_factory=list)
    auto_judgement: Optional[AutoJudgement] = None
    review_logs: List[ReviewLog] = field(default_factory=list)
    frozen_amounts: List[FrozenAmount] = field(default_factory=list)
    manual_correction_note: Optional[str] = None
    correction_source: Optional[str] = None
    next_step: Optional[str] = None
    review_reason: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    tags: List[str] = field(default_factory=list)
