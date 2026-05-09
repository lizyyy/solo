from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional
from uuid import uuid4


class TransactionStatus(Enum):
    PENDING = "pending"
    FROZEN = "frozen"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class EmissionSource(Enum):
    SCOPE1 = "scope1"
    SCOPE2 = "scope2"
    SCOPE3 = "scope3"


@dataclass
class Enterprise:
    id: str
    name: str
    compliance_year: int

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid4())


@dataclass
class EmissionData:
    id: str
    enterprise_id: str
    period: str
    source: EmissionSource
    amount: float
    version: int = 1
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    import_batch_id: Optional[str] = None
    remark: Optional[str] = None

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid4())


@dataclass
class QuotaAllocation:
    id: str
    enterprise_id: str
    period: str
    amount: float
    created_at: datetime = field(default_factory=datetime.now)
    remark: Optional[str] = None

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid4())


@dataclass
class Transaction:
    id: str
    enterprise_id: str
    counterparty_id: str
    amount: float
    price: float
    status: TransactionStatus = TransactionStatus.PENDING
    frozen_amount: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    remark: Optional[str] = None

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid4())

    @property
    def total_value(self) -> float:
        return self.amount * self.price


@dataclass
class Revision:
    id: str
    enterprise_id: str
    period: str
    version: int
    previous_version: Optional[int]
    change_type: str
    change_description: str
    created_at: datetime = field(default_factory=datetime.now)
    operator_id: Optional[str] = None

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid4())


@dataclass
class ComplianceStatus:
    enterprise_id: str
    compliance_year: int
    total_emission: float
    total_quota: float
    frozen_quota: float
    available_quota: float
    deficit: float
    warning_level: str
    is_compliant: bool
    report_generated_at: Optional[datetime] = None


@dataclass
class ImportBatch:
    id: str
    enterprise_id: str
    period: str
    status: str
    record_count: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid4())
