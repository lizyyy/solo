from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional, Dict, List, Any
from enum import Enum


class DocumentType(Enum):
    INVOICE = "invoice"
    GRN = "grn"
    PAYMENT = "payment"


class ReconciliationStatus(Enum):
    MATCHED = "matched"
    PARTIAL = "partial"
    UNMATCHED = "unmatched"
    DUPLICATE = "duplicate"
    INVALID = "invalid"


@dataclass
class Document:
    doc_type: DocumentType
    doc_number: str
    supplier_id: str
    supplier_name: str
    amount: float
    doc_date: date
    due_date: Optional[date] = None
    description: str = ""
    reference: str = ""
    line_items: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    validation_errors: List[str] = field(default_factory=list)
    is_valid: bool = True
    
    @property
    def key(self) -> str:
        return f"{self.doc_type.value}:{self.doc_number}:{self.supplier_id}"
    
    def validate(self) -> List[str]:
        errors = []
        if not self.doc_number.strip():
            errors.append("凭证号不能为空")
        if not self.supplier_id.strip():
            errors.append("供应商ID不能为空")
        if self.amount < 0:
            errors.append(f"金额不能为负数: {self.amount}")
        if self.doc_date > date.today():
            errors.append(f"凭证日期不能晚于今天: {self.doc_date}")
        self.validation_errors = errors
        self.is_valid = len(errors) == 0
        return errors


@dataclass
class ReconciliationItem:
    document: Document
    matched_amount: float = 0.0
    matched_documents: List[str] = field(default_factory=list)
    status: ReconciliationStatus = ReconciliationStatus.UNMATCHED
    aging_days: int = 0
    period: str = ""
    
    @property
    def remaining_amount(self) -> float:
        return self.document.amount - self.matched_amount


@dataclass
class ReconciliationRun:
    run_id: str
    run_date: datetime
    period: str
    documents: List[Document] = field(default_factory=list)
    results: List[ReconciliationItem] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
