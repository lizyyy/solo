from dataclasses import dataclass, field
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Dict, Any


class DocumentType(Enum):
    INVOICE = "invoice"
    PURCHASE_ORDER = "po"
    RECEIPT = "receipt"
    PAYMENT = "payment"


class IssueSeverity(Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class IssueType(Enum):
    AMOUNT_MISMATCH = "amount_mismatch"
    QUANTITY_MISMATCH = "quantity_mismatch"
    PRICE_MISMATCH = "price_mismatch"
    DATE_MISMATCH = "date_mismatch"
    CURRENCY_MISMATCH = "currency_mismatch"
    TAX_RATE_MISMATCH = "tax_rate_mismatch"
    VENDOR_MISMATCH = "vendor_mismatch"
    MISSING_CURRENCY = "missing_currency"
    MISSING_TAX_RATE = "missing_tax_rate"
    UNMATCHED_DOCUMENT = "unmatched_document"
    SPLIT_INVOICE = "split_invoice"
    MERGED_INVOICE = "merged_invoice"
    CROSS_MONTH_PAYMENT = "cross_month_payment"


@dataclass
class Document:
    doc_id: str
    doc_type: DocumentType
    vendor_id: str
    vendor_name: str
    amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    currency: Optional[str] = None
    tax_rate: Optional[Decimal] = None
    date: Optional[date] = None
    status: str = "pending"
    related_ids: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def effective_tax_rate(self) -> Optional[Decimal]:
        if self.amount > 0 and self.tax_rate is not None:
            return self.tax_rate
        if self.amount > 0:
            return self.tax_amount / self.amount
        return None


@dataclass
class Invoice(Document):
    invoice_number: str = ""
    po_number: Optional[str] = None
    tax_invoice_code: str = ""
    line_items: List[Dict[str, Any]] = field(default_factory=list)
    is_split: bool = False
    is_merged: bool = False
    split_from: Optional[str] = None
    merged_invoices: List[str] = field(default_factory=list)

    def __post_init__(self):
        self.doc_type = DocumentType.INVOICE


@dataclass
class PurchaseOrderLine(Document):
    po_number: str = ""
    po_line_number: int = 1
    item_code: str = ""
    item_description: str = ""
    quantity: Decimal = Decimal(0)
    unit_price: Decimal = Decimal(0)

    def __post_init__(self):
        self.doc_type = DocumentType.PURCHASE_ORDER


@dataclass
class Receipt(Document):
    receipt_number: str = ""
    po_number: Optional[str] = None
    po_line_number: Optional[int] = None
    item_code: str = ""
    received_quantity: Decimal = Decimal(0)
    warehouse: str = ""

    def __post_init__(self):
        self.doc_type = DocumentType.RECEIPT


@dataclass
class Payment(Document):
    payment_number: str = ""
    invoice_number: Optional[str] = None
    payment_method: str = ""
    bank_account: str = ""
    is_cross_month: bool = False

    def __post_init__(self):
        self.doc_type = DocumentType.PAYMENT


@dataclass
class Issue:
    issue_id: str
    issue_type: IssueType
    severity: IssueSeverity
    description: str
    primary_doc_id: str
    primary_doc_type: DocumentType
    related_doc_ids: List[str] = field(default_factory=list)
    related_doc_types: List[DocumentType] = field(default_factory=list)
    expected_value: Optional[Any] = None
    actual_value: Optional[Any] = None
    difference: Optional[Any] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_id": self.issue_id,
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "description": self.description,
            "primary_doc_id": self.primary_doc_id,
            "primary_doc_type": self.primary_doc_type.value,
            "related_doc_ids": ",".join(self.related_doc_ids),
            "related_doc_types": ",".join(t.value for t in self.related_doc_types),
            "expected_value": str(self.expected_value) if self.expected_value else "",
            "actual_value": str(self.actual_value) if self.actual_value else "",
            "difference": str(self.difference) if self.difference else "",
        }


@dataclass
class MatchResult:
    group_id: str
    invoice_ids: List[str]
    po_line_ids: List[str]
    receipt_ids: List[str]
    payment_ids: List[str]
    is_matched: bool
    issues: List[Issue] = field(default_factory=list)
    match_score: Decimal = Decimal(0)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationRule:
    rule_id: str
    rule_name: str
    rule_type: str
    description: str
    conditions: Dict[str, Any]
    severity: IssueSeverity = IssueSeverity.WARNING
    enabled: bool = True
