from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class BillStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    NORMAL = "normal"
    SUPPLEMENTED = "supplemented"
    WITHDRAWN = "withdrawn"
    RESUBMITTED = "resubmitted"
    EXCEPTION = "exception"


class ValidationSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class CoInsurer(BaseModel):
    insurer_id: str
    insurer_name: str
    is_leader: bool = False
    share_ratio: float
    confirmed: bool = False
    confirmed_at: Optional[datetime] = None


class Policy(BaseModel):
    policy_no: str
    policy_name: str
    effective_date: datetime
    expiry_date: datetime
    total_sum_insured: float
    deductible: float
    co_insurers: List[CoInsurer]
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    remarks: Optional[str] = None

    @field_validator("co_insurers")
    @classmethod
    def check_leader_exists(cls, v: List[CoInsurer]) -> List[CoInsurer]:
        leaders = [c for c in v if c.is_leader]
        if len(leaders) == 0:
            raise ValueError("保单必须指定主承保人")
        if len(leaders) > 1:
            raise ValueError("保单只能有一个主承保人")
        return v


class Claim(BaseModel):
    claim_no: str
    policy_no: str
    claim_amount: float
    reported_date: datetime
    accident_date: datetime
    loss_description: str
    deductible_applied: Optional[float] = None
    deductible_waived: bool = False
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    remarks: Optional[str] = None
    is_late_supplement: bool = False
    supplement_date: Optional[datetime] = None
    remarks_modified: bool = False


class BillItem(BaseModel):
    insurer_id: str
    insurer_name: str
    is_leader: bool
    share_ratio: float
    payable_amount: float
    confirmed: bool = False
    confirmed_at: Optional[datetime] = None


class ValidationResult(BaseModel):
    field: str
    severity: ValidationSeverity
    message: str
    code: str


class Bill(BaseModel):
    bill_no: str
    claim_no: str
    policy_no: str
    claim_amount: float
    deductible_amount: float
    net_claim_amount: float
    items: List[BillItem]
    status: BillStatus = BillStatus.DRAFT
    validation_results: List[ValidationResult] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    version: int = 1
    previous_version_bill_no: Optional[str] = None
    processed_at: Optional[datetime] = None
    remarks: Optional[str] = None

    def has_errors(self) -> bool:
        return any(v.severity == ValidationSeverity.ERROR for v in self.validation_results)

    def has_warnings(self) -> bool:
        return any(v.severity == ValidationSeverity.WARNING for v in self.validation_results)

    def get_errors(self) -> List[ValidationResult]:
        return [v for v in self.validation_results if v.severity == ValidationSeverity.ERROR]

    def get_warnings(self) -> List[ValidationResult]:
        return [v for v in self.validation_results if v.severity == ValidationSeverity.WARNING]


class AuditLogEntry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    action: str
    bill_no: Optional[str] = None
    claim_no: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
