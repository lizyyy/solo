"""
数据模型模块
定义预付卡沉淀核对系统的数据结构
"""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict
import uuid


class RecordStatus(Enum):
    CONFIRMED = "已确认"
    PENDING = "待补充"
    MANUAL_MODIFIED = "人工修改"


class ReconciliationStatus(Enum):
    MATCHED = "核对一致"
    UNMATCHED = "核对不一致"
    PARTIAL = "部分匹配"
    PENDING = "待核对"


@dataclass
class PrepaidCardTransaction:
    transaction_id: str
    transaction_date: datetime
    card_number: str
    card_type: str
    transaction_amount: float
    fee_amount: float
    settlement_amount: float
    merchant_id: str
    merchant_name: str
    terminal_id: str
    order_no: str
    source_file: str
    status: RecordStatus = RecordStatus.CONFIRMED
    is_duplicate: bool = False
    duplicate_with: List[str] = field(default_factory=list)
    manual_remark: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    fee_period_crossed: bool = False


@dataclass
class SettlementRecord:
    settlement_id: str
    settlement_date: datetime
    batch_no: str
    total_amount: float
    total_fee: float
    net_settlement: float
    transaction_count: int
    bank_account: str
    source_file: str
    matched_transactions: List[str] = field(default_factory=list)
    unmatched_amount: float = 0.0
    status: ReconciliationStatus = ReconciliationStatus.PENDING
    manual_remark: str = ""


@dataclass
class DepositSummary:
    summary_id: str
    period_start: datetime
    period_end: datetime
    opening_balance: float
    total_deposit: float
    total_settlement: float
    total_fee: float
    closing_balance: float
    confirmed_count: int = 0
    pending_count: int = 0
    manual_modified_count: int = 0
    duplicate_count: int = 0
    fee_crossed_count: int = 0
    created_at: datetime = field(default_factory=datetime.now)


def generate_id() -> str:
    return str(uuid.uuid4())[:8].upper()
