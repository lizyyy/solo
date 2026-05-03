from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Any, Optional


class Severity(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class IssueType(Enum):
    MISSING_ATTACHMENT = "missing_attachment"
    DUPLICATE_INVOICE = "duplicate_invoice"
    AMOUNT_MISMATCH = "amount_mismatch"
    DATE_EXPIRED = "date_expired"
    MISSING_CONTRACT = "missing_contract"
    MISSING_ACCEPTANCE = "missing_acceptance"
    INVALID_FILENAME = "invalid_filename"
    INVALID_EXPENSE_TYPE = "invalid_expense_type"
    AMOUNT_EXCEED_LIMIT = "amount_exceed_limit"
    MISSING_CSV = "missing_csv"
    INVALID_CSV = "invalid_csv"


@dataclass
class Issue:
    issue_type: IssueType
    severity: Severity
    message: str
    reference: Optional[str] = None
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class ExpenseItem:
    line_number: int
    expense_id: str
    invoice_number: str
    amount: float
    date: Optional[date]
    expense_type: str
    project_code: Optional[str]
    description: Optional[str]
    attachment_requirements: list[str] = field(default_factory=list)
    raw_data: dict[str, Any] = field(default_factory=dict)


@dataclass
class AttachmentFile:
    filename: str
    full_path: str
    file_type: str
    size: int
    last_modified: datetime
    invoice_number: Optional[str] = None
    expense_id: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    sidecar_meta: Optional[dict[str, Any]] = None


@dataclass
class CheckResult:
    total_expenses: int = 0
    total_attachments: int = 0
    total_amount: float = 0.0
    issues: list[Issue] = field(default_factory=list)
    expenses: list[ExpenseItem] = field(default_factory=list)
    attachments: list[AttachmentFile] = field(default_factory=list)
    checked_at: datetime = field(default_factory=datetime.now)
    package_path: str = ""

    @property
    def errors(self) -> list[Issue]:
        return [i for i in self.issues if i.severity == Severity.ERROR]

    @property
    def warnings(self) -> list[Issue]:
        return [i for i in self.issues if i.severity == Severity.WARNING]

    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0
