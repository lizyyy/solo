from datetime import date, datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class ExceptionStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    RECOVERED = "recovered"


class RecoveryStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class FieldContract(BaseModel):
    field_path: str
    is_nullable: bool = False
    description: Optional[str] = None


class DataContract(BaseModel):
    contract_id: str
    name: str
    version: str
    fields: List[FieldContract]
    created_at: date

    @field_validator("fields")
    def sort_fields(cls, v):
        return sorted(v, key=lambda x: x.field_path)


class ExceptionRule(BaseModel):
    rule_id: str
    contract_id: str
    field_path: str
    reason: str
    exception_date: date
    owner: Optional[str] = None
    status: ExceptionStatus = ExceptionStatus.ACTIVE
    source_file: Optional[str] = None
    source_line: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.now)

    def is_expired(self, check_date: Optional[date] = None) -> bool:
        check_date = check_date or date.today()
        return check_date > self.exception_date


class HitRecord(BaseModel):
    record_id: str
    contract_id: str
    field_path: str
    rule_id: str
    null_count: int = 0
    total_count: int = 0
    sample_values: List[Any] = Field(default_factory=list)
    source_file: str
    source_line: Optional[int] = None
    detected_at: datetime = Field(default_factory=datetime.now)

    @property
    def null_rate(self) -> float:
        if self.total_count == 0:
            return 0.0
        return round(self.null_count / self.total_count, 4)


class RecoveryItem(BaseModel):
    rule_id: str
    field_path: str
    exception_date: date
    reason: str
    null_rate: float
    null_count: int
    total_count: int
    recovery_status: RecoveryStatus = RecoveryStatus.PENDING
    approval_note: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None


class BadLine(BaseModel):
    source_file: str
    line_number: int
    raw_content: str
    error_message: str
    error_type: str


class ScanResult(BaseModel):
    scan_id: str
    scan_date: date
    total_contracts: int = 0
    total_exceptions: int = 0
    expired_exceptions: int = 0
    hit_records: List[HitRecord] = Field(default_factory=list)
    recovery_items: List[RecoveryItem] = Field(default_factory=list)
    bad_lines: List[BadLine] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)

    def sort_all(self):
        self.hit_records.sort(key=lambda x: (x.contract_id, x.field_path, x.record_id))
        self.recovery_items.sort(key=lambda x: (x.exception_date, x.field_path))
        self.bad_lines.sort(key=lambda x: (x.source_file, x.line_number))


class ReportConfig(BaseModel):
    output_dir: str = "./reports"
    formats: List[str] = Field(default_factory=lambda: ["json", "excel"])
    include_samples: bool = True
    max_samples: int = 100
