"""对账数据模型（Pydantic v2）。"""
from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Literal, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


# --- 源数据 ---

class DepositRecord(BaseModel):
    """门店现金缴存记录（来自 CSV）。"""
    store_id: str
    deposit_date: date
    amount: float
    reference: str = ""  # 银行流水号 / 凭证号
    note: str = ""


class SalesRecord(BaseModel):
    """POS 销售记录（来自 JSON）。"""
    store_id: str
    sale_date: date
    pos_sales_amount: float = 0.0   # POS 机刷卡/扫码
    cash_sales_amount: float = 0.0  # 现金销售
    note: str = ""


class PettyCashRecord(BaseModel):
    """备用金流水。"""
    store_id: str
    tx_date: date
    tx_type: Literal["in", "out"] = "out"  # in=收回, out=支出
    amount: float
    purpose: str = ""
    reference: str = ""


# --- 差异 ---

class DiscrepancyType(str, Enum):
    OVER = "over"           # 长款：缴存 > 销售
    SHORT = "short"         # 短款：缴存 < 销售
    DUPLICATE = "duplicate"  # 重复缴存
    MISSING_DEPOSIT = "missing_deposit"      # 有销售无缴存
    MISSING_SALES = "missing_sales"          # 有缴存无销售
    PETTY_IMBALANCE = "petty_imbalance"      # 备用金余额异常
    HOLIDAY_DELAY = "holiday_delay"          # 节假日/周末延迟缴存


class ReviewAction(str, Enum):
    APPROVE = "approve"         # 放行（差异合理）
    REJECT = "reject"           # 退回门店
    REQUEST_INFO = "request_info"  # 要求补材料


class Discrepancy(BaseModel):
    """一条差异。"""
    id: UUID = Field(default_factory=uuid4)
    type: DiscrepancyType
    store_id: str
    biz_date: date
    # 解释用数值
    deposit_amount: float = 0.0
    sales_cash_amount: float = 0.0
    delta: float = 0.0
    # 人可读说明
    explanation: str
    # 复核
    review_action: Optional[ReviewAction] = None
    review_note: str = ""
    reviewer: str = ""
    reviewed_at: Optional[datetime] = None
    # 复核时允许覆盖数字（例如人工修正缴存金额）
    override_deposit: Optional[float] = None
    override_sales_cash: Optional[float] = None


# --- 批次 ---

class BatchStatus(str, Enum):
    IMPORTED = "imported"
    RECONCILED = "reconciled"
    UNDER_REVIEW = "under_review"
    CLOSED = "closed"


class Batch(BaseModel):
    """一次对账批次 = 一次导入 + 一次运行结果。"""
    id: UUID = Field(default_factory=uuid4)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    period_start: Optional[date] = None
    period_end: Optional[date] = None

    deposits: list[DepositRecord] = Field(default_factory=list)
    sales: list[SalesRecord] = Field(default_factory=list)
    petty_cash: list[PettyCashRecord] = Field(default_factory=list)

    discrepancies: list[Discrepancy] = Field(default_factory=list)
    status: BatchStatus = BatchStatus.IMPORTED

    meta: dict[str, Any] = Field(default_factory=dict)
