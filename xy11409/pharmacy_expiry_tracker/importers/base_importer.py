from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ParsedRecord:
    pharmacy_code: str
    pharmacy_name: str
    drug_code: str
    drug_name: str
    batch_no: str
    expiry_date: datetime
    quantity: int
    region: Optional[str] = None
    town: Optional[str] = None
    drug_spec: Optional[str] = None
    unit: Optional[str] = None
    remarks: Optional[str] = None
    raw_data: Dict[str, Any] = None


@dataclass
class ImportResultItem:
    row_number: int
    success: bool
    record_id: Optional[int] = None
    record_no: Optional[str] = None
    error_message: Optional[str] = None
    parsed_data: Optional[ParsedRecord] = None


class BaseImporter(ABC):
    def __init__(self, allow_partial: bool = True, skip_duplicates: bool = True):
        self.allow_partial = allow_partial
        self.skip_duplicates = skip_duplicates
        self.errors: List[str] = []

    @abstractmethod
    def detect_duplicate(self, parsed: ParsedRecord, existing_records: List[Any]) -> bool:
        pass

    @abstractmethod
    def parse_row(self, row_data: Dict[str, Any], row_number: int) -> Tuple[Optional[ParsedRecord], Optional[str]]:
        pass

    def validate_parsed(self, parsed: ParsedRecord) -> Tuple[bool, Optional[str]]:
        if not parsed.pharmacy_code:
            return False, "药房编码不能为空"
        if not parsed.pharmacy_name:
            return False, "药房名称不能为空"
        if not parsed.drug_code:
            return False, "药品编码不能为空"
        if not parsed.drug_name:
            return False, "药品名称不能为空"
        if not parsed.batch_no:
            return False, "批号不能为空"
        if not parsed.expiry_date:
            return False, "有效期不能为空"
        if parsed.quantity <= 0:
            return False, "数量必须大于0"
        return True, None

    def add_error(self, message: str):
        self.errors.append(message)

    def has_errors(self) -> bool:
        return len(self.errors) > 0
