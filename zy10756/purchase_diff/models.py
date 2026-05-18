from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List
from datetime import datetime
import hashlib


class DiffType(str, Enum):
    REISSUE = "补发"
    SHORT_SHIPMENT = "短装"
    RETURN = "退货"
    QC_DETENTION = "质检扣留"
    PENDING_CONFIRM = "待确认"


@dataclass
class PurchaseRecord:
    filename: str
    line_number: int
    purchase_order: str
    sku: str
    product_name: str
    expected_quantity: int
    actual_quantity: int
    diff_quantity: int
    diff_type: DiffType
    supplier: str
    arrival_date: str
    warehouse: str
    remark: str = ""
    record_hash: str = field(init=False)

    def __post_init__(self):
        self.record_hash = self._generate_hash()

    def _generate_hash(self) -> str:
        hash_content = (
            f"{self.filename}|{self.line_number}|{self.purchase_order}|"
            f"{self.sku}|{self.expected_quantity}|{self.actual_quantity}|"
            f"{self.diff_type.value}"
        )
        return hashlib.md5(hash_content.encode("utf-8")).hexdigest()


@dataclass
class DiffSummary:
    diff_type: DiffType
    total_count: int = 0
    total_quantity: int = 0
    records: List[PurchaseRecord] = field(default_factory=list)


@dataclass
class ProcessingResult:
    input_files: List[str]
    processed_at: str
    summary: List[DiffSummary]
    all_records: List[PurchaseRecord]
    error_files: List[str] = field(default_factory=list)
    skipped_records: int = 0

    def __post_init__(self):
        self.processed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
