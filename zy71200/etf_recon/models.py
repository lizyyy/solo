from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Dict, List, Optional


class SecurityType(Enum):
    STOCK = "股票"
    BOND = "债券"
    CASH = "现金"


class SubstitutionFlag(Enum):
    ALLOWED = "允许替代"
    FORBIDDEN = "禁止替代"
    MUST = "必须替代"


class ReceiptStatus(Enum):
    PRELIMINARY = "初步回执"
    FINAL = "最终回执"
    CORRECTED = "更正回执"


@dataclass
class ComponentSecurity:
    code: str
    name: str
    quantity: int
    security_type: SecurityType = SecurityType.STOCK
    substitution_flag: SubstitutionFlag = SubstitutionFlag.FORBIDDEN
    substitution_cash: float = 0.0


@dataclass
class RedemptionList:
    etf_code: str
    etf_name: str
    trade_date: date
    creation_unit: int
    components: List[ComponentSecurity] = field(default_factory=list)
    total_cash_substitution: float = 0.0
    estimated_cash: float = 0.0


@dataclass
class BrokerReceipt:
    broker_name: str
    receipt_time: datetime
    receipt_version: int
    status: ReceiptStatus
    components: List[ComponentSecurity] = field(default_factory=list)
    total_cash_substituted: float = 0.0
    actual_cash: float = 0.0
    remarks: str = ""


@dataclass
class SuspendedSecurity:
    code: str
    name: str
    suspend_date: date
    reason: str = ""
    is_resumed: bool = False


@dataclass
class CashSubstitution:
    code: str
    name: str
    substitution_type: str
    amount: float
    unit_price: float = 0.0
    quantity: int = 0


@dataclass
class DifferenceItem:
    code: str
    name: str
    difference_type: str
    expected: str
    actual: str
    severity: str = "warning"
    explanation: str = ""


@dataclass
class ReconResult:
    etf_code: str
    trade_date: date
    analysis_time: datetime
    broker_name: str = ""
    source_files: Dict[str, str] = field(default_factory=dict)
    differences: List[DifferenceItem] = field(default_factory=list)
    anomalies: List[DifferenceItem] = field(default_factory=list)
    component_match_count: int = 0
    component_total_count: int = 0
    cash_match: bool = True
    expected_cash_total: float = 0.0
    actual_cash_total: float = 0.0
    processing_steps: List[str] = field(default_factory=list)
    is_pass: bool = False
