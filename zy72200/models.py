from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List


class DividendStatus(Enum):
    PENDING = "待对账"
    MATCHED = "对账成功"
    MIXED_CURRENCY = "港币人民币同列待复核"
    NEEDS_CONFIRMATION = "待托管确认"
    ADJUSTED = "尾差已调整"
    OLD_STANDARD = "旧口径补录"


class AuditAction(Enum):
    IMPORT = "导入尾差调整条"
    CURRENCY_FLAG = "标记港币人民币同列"
    ADD_CONFIRMATION = "补录托管确认页"
    MANUAL_CORRECT = "人工修正"
    RERUN = "重跑对账"
    COMPLETE = "对账完成"


@dataclass
class TailAdjustmentEntry:
    id: str
    stock_code: str
    stock_name: str
    amount_str: str
    amount: float = 0.0
    currency: Optional[str] = None
    has_mixed_currency: bool = False
    ex_date: str = ""
    record_date: str = ""
    status: DividendStatus = DividendStatus.PENDING
    remark: str = ""


@dataclass
class CustodianConfirmation:
    id: str
    entry_id: str
    confirmed_amount: float
    confirmed_currency: str
    is_old_standard: bool = False
    confirmation_date: str = ""
    custodian_remark: str = ""


@dataclass
class AuditLog:
    id: str
    entry_id: str
    action: AuditAction
    timestamp: datetime
    operator: str
    before_status: Optional[DividendStatus] = None
    after_status: Optional[DividendStatus] = None
    remark: str = ""


@dataclass
class ReconciliationResult:
    entry_id: str
    stock_code: str
    stock_name: str
    final_amount: float
    final_currency: str
    status: DividendStatus
    is_mixed_currency: bool
    is_old_standard: bool
    audit_trail: List[AuditLog] = field(default_factory=list)
    conclusion: str = ""
