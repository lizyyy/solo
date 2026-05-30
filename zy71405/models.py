from dataclasses import dataclass, field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum


class RecordStatus(str, Enum):
    NORMAL = "normal"
    ERROR = "error"


class ErrorType(str, Enum):
    STEP_CROSS = "阶梯跨档错误"
    GROUP_CHANGE = "客户分组变更"
    DUPLICATE_REFUND = "返还重复入账"
    MISSING_GROUP = "客户无对应分组"
    MISSING_RULE = "无对应佣金规则"
    INVALID_AMOUNT = "交易金额无效"


@dataclass
class SourceRef:
    file_name: str
    line_number: int
    raw_content: str


@dataclass
class CustomerGroup:
    customer_id: str
    customer_name: str
    group_id: str
    valid_from: str
    valid_to: Optional[str] = None
    source: Optional[SourceRef] = None


@dataclass
class CommissionTier:
    min_amount: float
    max_amount: Optional[float]
    refund_rate: float


@dataclass
class CommissionRule:
    rule_id: str
    rule_version: str
    group_id: str
    product_type: str
    effective_date: str
    tiers: List[CommissionTier]
    source: Optional[SourceRef] = None


@dataclass
class TradeRecord:
    trade_id: str
    trade_date: str
    customer_id: str
    product_type: str
    trade_amount: float
    commission_fee: float
    source: Optional[SourceRef] = None


@dataclass
class RefundResult:
    refund_id: str
    trade_id: str
    customer_id: str
    customer_name: str
    group_id: str
    product_type: str
    trade_amount: float
    refund_amount: float
    refund_rate: float
    rule_id: str
    rule_version: str
    refund_date: str
    trade_source: Optional[SourceRef] = None
    rule_source: Optional[SourceRef] = None


@dataclass
class ProblemRecord:
    record_id: str
    status: RecordStatus
    error_type: ErrorType
    description: str
    sources: List[SourceRef]
    related_ids: List[str]
    raw_data: Dict
    rule_version: str = ""
