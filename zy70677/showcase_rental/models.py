from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Dict, Any
from hashlib import sha256
import json


class ValidationSeverity(Enum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


@dataclass
class SourceLocation:
    file_name: str
    sheet_name: Optional[str] = None
    row_number: Optional[int] = None
    column_name: Optional[str] = None

    def __str__(self) -> str:
        parts = [self.file_name]
        if self.sheet_name:
            parts.append(f"Sheet:{self.sheet_name}")
        if self.row_number:
            parts.append(f"Row:{self.row_number}")
        if self.column_name:
            parts.append(f"Col:{self.column_name}")
        return "|".join(parts)


@dataclass
class ValidationError:
    message: str
    severity: ValidationSeverity
    source: SourceLocation
    rule_code: str
    data_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "message": self.message,
            "severity": self.severity.value,
            "source": str(self.source),
            "rule_code": self.rule_code,
            "data_id": self.data_id,
        }


@dataclass
class BadRow:
    source: SourceLocation
    raw_data: Dict[str, Any]
    error_message: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": str(self.source),
            "raw_data": self.raw_data,
            "error_message": self.error_message,
        }


@dataclass
class Contract:
    contract_id: str
    merchant_name: str
    start_date: date
    end_date: date
    daily_rate: Decimal
    deposit_amount: Decimal
    showcase_count: int
    source: SourceLocation
    allow_add_cabinet: bool = True
    add_cabinet_daily_rate: Optional[Decimal] = None
    deposit_refund_days: int = 30
    billing_cycle_days: int = 30
    cancellation_notice_days: int = 7

    def get_stable_id(self) -> str:
        data = json.dumps(
            {
                "contract_id": self.contract_id,
                "merchant_name": self.merchant_name,
                "start_date": self.start_date.isoformat(),
                "end_date": self.end_date.isoformat(),
                "daily_rate": str(self.daily_rate),
                "deposit_amount": str(self.deposit_amount),
            },
            sort_keys=True,
        )
        return sha256(data.encode()).hexdigest()[:16]


@dataclass
class Showcase:
    showcase_id: str
    contract_id: str
    location: str
    is_active: bool = True
    source: SourceLocation = None

    def get_stable_id(self) -> str:
        data = json.dumps(
            {
                "showcase_id": self.showcase_id,
                "contract_id": self.contract_id,
                "location": self.location,
            },
            sort_keys=True,
        )
        return sha256(data.encode()).hexdigest()[:16]


@dataclass
class LeasePeriod:
    lease_id: str
    contract_id: str
    showcase_id: str
    start_date: date
    end_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    source: SourceLocation = None

    @property
    def effective_end_date(self) -> date:
        return self.actual_end_date or self.end_date or date.today()

    def get_stable_id(self) -> str:
        data = json.dumps(
            {
                "lease_id": self.lease_id,
                "contract_id": self.contract_id,
                "showcase_id": self.showcase_id,
                "start_date": self.start_date.isoformat(),
                "end_date": self.end_date.isoformat() if self.end_date else None,
            },
            sort_keys=True,
        )
        return sha256(data.encode()).hexdigest()[:16]


@dataclass
class AddCabinetRecord:
    add_id: str
    contract_id: str
    showcase_id: str
    add_date: date
    remove_date: Optional[date] = None
    daily_rate_override: Optional[Decimal] = None
    source: SourceLocation = None

    def get_stable_id(self) -> str:
        data = json.dumps(
            {
                "add_id": self.add_id,
                "contract_id": self.contract_id,
                "showcase_id": self.showcase_id,
                "add_date": self.add_date.isoformat(),
                "remove_date": self.remove_date.isoformat() if self.remove_date else None,
            },
            sort_keys=True,
        )
        return sha256(data.encode()).hexdigest()[:16]


@dataclass
class DepositRecord:
    deposit_id: str
    contract_id: str
    amount: Decimal
    transaction_type: str
    transaction_date: date
    is_refunded: bool = False
    refund_date: Optional[date] = None
    source: SourceLocation = None

    def get_stable_id(self) -> str:
        data = json.dumps(
            {
                "deposit_id": self.deposit_id,
                "contract_id": self.contract_id,
                "amount": str(self.amount),
                "transaction_type": self.transaction_type,
                "transaction_date": self.transaction_date.isoformat(),
            },
            sort_keys=True,
        )
        return sha256(data.encode()).hexdigest()[:16]


@dataclass
class BillingPeriod:
    period_id: str
    contract_id: str
    start_date: date
    end_date: date
    base_days: int
    base_amount: Decimal
    add_cabinet_days: int
    add_cabinet_amount: Decimal
    deposit_deduction: Decimal
    total_amount: Decimal
    details: List[Dict[str, Any]] = field(default_factory=list)
    source: SourceLocation = None

    def get_stable_id(self) -> str:
        data = json.dumps(
            {
                "period_id": self.period_id,
                "contract_id": self.contract_id,
                "start_date": self.start_date.isoformat(),
                "end_date": self.end_date.isoformat(),
                "base_days": self.base_days,
                "base_amount": str(self.base_amount),
                "add_cabinet_days": self.add_cabinet_days,
                "add_cabinet_amount": str(self.add_cabinet_amount),
                "deposit_deduction": str(self.deposit_deduction),
                "total_amount": str(self.total_amount),
            },
            sort_keys=True,
        )
        return sha256(data.encode()).hexdigest()[:16]


@dataclass
class ProcessingResult:
    contracts: List[Contract]
    showcases: List[Showcase]
    lease_periods: List[LeasePeriod]
    add_cabinet_records: List[AddCabinetRecord]
    deposit_records: List[DepositRecord]
    billing_periods: List[BillingPeriod]
    validation_errors: List[ValidationError]
    bad_rows: List[BadRow]
    summary: Dict[str, Any] = field(default_factory=dict)
