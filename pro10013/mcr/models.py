from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any
from enum import Enum


class RecordStatus(str, Enum):
    PENDING = "pending"
    NORMAL = "normal"
    SKIPPED = "skipped"
    NEED_REVIEW = "need_review"
    MANUAL_FIXED = "manual_fixed"


class SkipReason(str, Enum):
    MISSING_FIELD = "missing_field"
    DUPLICATE = "duplicate"
    CALIBER_MISMATCH = "caliber_mismatch"
    MULTI_ACCOUNT = "multi_account"
    CROSS_SETTLEMENT_REFUND = "cross_settlement_refund"
    OTHER = "other"


class ReviewResult(str, Enum):
    PASS = "pass"
    REJECT = "reject"
    NEED_FURTHER_CHECK = "need_further_check"


@dataclass
class CollateralRecord:
    id: Optional[int] = None
    batch_id: Optional[str] = None
    client_id: str = ""
    client_name: str = ""
    account_id: str = ""
    collateral_code: str = ""
    collateral_name: str = ""
    collateral_type: str = ""
    quantity: float = 0.0
    market_value: float = 0.0
    collateral_ratio: float = 0.0
    available_collateral: float = 0.0
    trade_date: str = ""
    settlement_date: str = ""
    is_refund: bool = False
    source_system: str = ""
    status: str = RecordStatus.PENDING.value
    skip_reason: Optional[str] = None
    skip_detail: Optional[str] = None
    review_result: Optional[str] = None
    review_comment: Optional[str] = None
    reviewer: Optional[str] = None
    review_time: Optional[str] = None
    is_manual_overridden: bool = False
    previous_review_comment: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class ImportBatch:
    batch_id: str
    file_name: str
    total_count: int = 0
    processed_count: int = 0
    skipped_count: int = 0
    normal_count: int = 0
    need_review_count: int = 0
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    import_user: Optional[str] = None
    skip_reason_summary: Optional[Dict[str, int]] = None


@dataclass
class ReviewHistory:
    record_id: int
    operation_type: str
    id: Optional[int] = None
    batch_id: Optional[str] = None
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    old_review_result: Optional[str] = None
    new_review_result: Optional[str] = None
    old_review_comment: Optional[str] = None
    new_review_comment: Optional[str] = None
    operator: Optional[str] = None
    operation_time: str = field(default_factory=lambda: datetime.now().isoformat())
    remark: Optional[str] = None
