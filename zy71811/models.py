from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict
from enum import Enum


class TransactionType(Enum):
    PAYMENT = "支付"
    REFUND = "退款"
    REVERSAL = "冲正"


class SettlementStatus(Enum):
    PENDING = "待处理"
    MATCHED = "已匹配"
    SUSPENDED = "挂账"
    SETTLED = "已清算"
    DISPUTED = "有争议"


class JudgmentReason(Enum):
    NORMAL_MATCH = "正常匹配"
    REFUND_NO_OFFSET = "退款未找到对应支付记录"
    REFUND_PARTIAL_OFFSET = "退款部分匹配"
    AMOUNT_MISMATCH = "金额不匹配"
    RATE_CHANGED = "费率变更"
    DUPLICATE_RECORD = "重复记录"
    MANUAL_REVIEW = "需人工复核"
    OVER_THRESHOLD = "超过挂账阈值"


@dataclass
class Transaction:
    txn_id: str
    order_id: str
    card_no: str
    txn_type: TransactionType
    amount: float
    txn_time: datetime
    channel: str
    merchant_id: str
    status: str = "SUCCESS"
    original_txn_id: Optional[str] = None
    batch_id: str = ""


@dataclass
class RateRule:
    merchant_id: str
    card_type: str
    rate: float
    fixed_fee: float
    effective_date: datetime
    expire_date: Optional[datetime] = None
    version: str = "v1"


@dataclass
class SettlementRecord:
    settlement_id: str
    txn_id: str
    order_id: str
    card_no: str
    original_amount: float
    rate_applied: float
    fee_amount: float
    settlement_amount: float
    status: SettlementStatus
    judgment_reason: JudgmentReason
    judgment_detail: str
    next_step: str
    rate_version: str
    created_at: datetime = field(default_factory=datetime.now)
    batch_id: str = ""
    is_historical: bool = False


@dataclass
class SettlementBatch:
    batch_id: str
    process_time: datetime
    total_transactions: int
    settled_count: int
    suspended_count: int
    disputed_count: int
    rate_version: str
    rate_changes: List[Dict] = field(default_factory=list)
