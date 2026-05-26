from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


# ------------------------------ 业务模型 ------------------------------ #


class Agreement(BaseModel):
    """单位协议：单位维度的限额与券信息。"""

    agreement_id: str
    company_name: str
    per_person_limit: Optional[float] = None   # 每人限额
    company_total_limit: Optional[float] = None  # 单位总额度
    coupons: List[Dict[str, Any]] = Field(default_factory=list)
    # 券: {"coupon_id": "xx", "type": "fixed|percent", "value": 50, "stackable": true}


class PackageItem(BaseModel):
    item_code: str
    item_name: str
    unit_price: float
    qty: int = 1
    refunded_qty: int = 0   # 退项冲正


class Package(BaseModel):
    package_id: str
    examinee_id: str
    examinee_name: str
    agreement_id: str
    items: List[PackageItem]


class AdditionRecord(BaseModel):
    """加项 CSV 中每一行."""

    addition_id: str
    examinee_id: str
    examinee_name: str
    agreement_id: str
    item_code: str
    item_name: str
    unit_price: float
    qty: int
    gross_amount: float
    # 客户 / 现场填写的应收
    onsite_receivable: Optional[float] = None
    # 已使用的券（逗号分隔 coupon_id）
    applied_coupons: Optional[str] = None


# ------------------------------ 差异解释 ------------------------------ #


class ReasonCode(str, Enum):
    COUPON_STACK = "COUPON_STACK"
    REFUND_REVERSAL = "REFUND_REVERSAL"
    AGREEMENT_LIMIT = "AGREEMENT_LIMIT"
    PRICE_MISMATCH = "PRICE_MISMATCH"
    QTY_MISMATCH = "QTY_MISMATCH"
    DUPLICATE = "DUPLICATE"
    MISSING = "MISSING"


class DiffExplanation(BaseModel):
    reason_codes: List[ReasonCode] = Field(default_factory=list)
    human_readable: str = ""
    break_down: Dict[str, Any] = Field(default_factory=dict)


# ------------------------------ 对账明细 ------------------------------ #


class ReviewStatus(str, Enum):
    PENDING = "PENDING"        # 待复核
    APPROVED = "APPROVED"      # 放行
    REJECTED = "REJECTED"      # 退回
    SUPPLEMENT = "SUPPLEMENT"  # 要求补材料


class ReconciliationItem(BaseModel):
    trace_id: str = Field(default_factory=lambda: f"TR-{uuid4().hex[:10].upper()}")
    addition: Optional[AdditionRecord] = None
    package: Optional[Package] = None
    agreement: Optional[Agreement] = None

    expected_amount: float = 0.0       # 系统计算出的应收
    onsite_amount: float = 0.0         # 现场填写的应收
    diff_amount: float = 0.0           # 差额
    explanation: DiffExplanation = Field(default_factory=DiffExplanation)

    review_status: ReviewStatus = ReviewStatus.PENDING
    review_comment: str = ""
    adjustment_amount: float = 0.0     # 复核产生的调整额

    final_amount: float = 0.0          # 复核重算后的最终金额


# ------------------------------ 会话 & 汇总 ------------------------------ #


class SessionStatus(str, Enum):
    CREATED = "CREATED"
    DATA_LOADED = "DATA_LOADED"
    MATCHED = "MATCHED"
    REVIEWED = "REVIEWED"
    RECALCULATED = "RECALCULATED"
    REPORTED = "REPORTED"


class Session(BaseModel):
    id: str = Field(default_factory=lambda: f"SESS-{uuid4().hex[:8].upper()}")
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: SessionStatus = SessionStatus.CREATED
    note: str = ""


class SessionSummary(BaseModel):
    session_id: str
    total_items: int = 0
    matched_items: int = 0
    diff_items: int = 0
    pending_review: int = 0
    approved: int = 0
    rejected: int = 0
    supplement: int = 0
    onsite_total: float = 0.0
    expected_total: float = 0.0
    final_total: float = 0.0
    adjustment_total: float = 0.0
    reason_distribution: Dict[str, int] = Field(default_factory=dict)
