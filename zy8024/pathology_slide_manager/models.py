from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, Dict, List
from dataclasses import dataclass, field


class SlideStatus(Enum):
    AVAILABLE = "在库"
    BORROWED = "已借出"
    RETURNED = "已归还"
    OVERDUE = "逾期"
    LOST = "丢失"


class Department(Enum):
    PATHOLOGY = "病理科"
    ONCOLOGY = "肿瘤科"
    SURGERY = "外科"
    RESEARCH = "研究所"
    OTHER = "其他"


@dataclass
class Slide:
    slide_id: str
    patient_id: str
    specimen_type: str
    collection_date: str
    department: str
    storage_location: str
    status: SlideStatus = SlideStatus.AVAILABLE
    notes: str = ""

    def to_dict(self) -> Dict:
        return {
            "slide_id": self.slide_id,
            "patient_id": self.patient_id,
            "specimen_type": self.specimen_type,
            "collection_date": self.collection_date,
            "department": self.department,
            "storage_location": self.storage_location,
            "status": self.status.value,
            "notes": self.notes
        }


@dataclass
class BorrowRecord:
    record_id: str
    slide_id: str
    borrower_name: str
    borrower_dept: str
    borrow_date: str
    expected_return_date: str
    actual_return_date: Optional[str] = None
    actual_return_dept: Optional[str] = None
    status: SlideStatus = SlideStatus.BORROWED
    notes: str = ""
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "record_id": self.record_id,
            "slide_id": self.slide_id,
            "borrower_name": self.borrower_name,
            "borrower_dept": self.borrower_dept,
            "borrow_date": self.borrow_date,
            "expected_return_date": self.expected_return_date,
            "actual_return_date": self.actual_return_date,
            "actual_return_dept": self.actual_return_dept,
            "status": self.status.value,
            "notes": self.notes,
            "confirmed_by": self.confirmed_by,
            "confirmed_at": self.confirmed_at
        }


@dataclass
class DepartmentRule:
    department: str
    max_borrow_days: int
    max_concurrent_borrows: int
    allow_extend: bool = True
    requires_approval: bool = True
    notes: str = ""

    def to_dict(self) -> Dict:
        return {
            "department": self.department,
            "max_borrow_days": self.max_borrow_days,
            "max_concurrent_borrows": self.max_concurrent_borrows,
            "allow_extend": self.allow_extend,
            "requires_approval": self.requires_approval,
            "notes": self.notes
        }


@dataclass
class ValidationError:
    field: str
    message: str
    row_data: Optional[Dict] = None

    def __str__(self):
        return f"[{self.field}] {self.message}"


@dataclass
class ValidationResult:
    is_valid: bool = True
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def add_error(self, field: str, message: str, row_data: Dict = None):
        self.is_valid = False
        self.errors.append(ValidationError(field, message, row_data))

    def add_warning(self, message: str):
        self.warnings.append(message)
