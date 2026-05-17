from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict
from decimal import Decimal, ROUND_HALF_UP


@dataclass
class InvoiceItem:
    invoice_no: str
    invoice_date: str
    total_amount: Decimal
    total_tax: Decimal
    invoice_type: str
    items: List[Dict] = field(default_factory=list)
    vendor_name: str = ""
    tax_rate: Decimal = Decimal("0.06")

    def __post_init__(self):
        if isinstance(self.total_amount, (int, float)):
            self.total_amount = Decimal(str(self.total_amount))
        if isinstance(self.total_tax, (int, float)):
            self.total_tax = Decimal(str(self.total_tax))
        if isinstance(self.tax_rate, (int, float)):
            self.tax_rate = Decimal(str(self.tax_rate))


@dataclass
class Traveler:
    name: str
    employee_id: str
    project_code: str
    weight: Decimal = Decimal("1")


@dataclass
class SplitResult:
    invoice_no: str
    traveler_name: str
    employee_id: str
    project_code: str
    split_amount: Decimal
    split_tax: Decimal
    split_amount_excl_tax: Decimal
    tax_rate: Decimal
    original_amount: Decimal
    original_tax: Decimal
    split_ratio: Decimal
    is_valid: bool = True
    error_message: str = ""


@dataclass
class SplitReport:
    report_id: str
    report_date: str
    total_invoices: int
    total_invoices_valid: int
    total_invoices_invalid: int
    total_original_amount: Decimal
    total_original_tax: Decimal
    total_split_amount: Decimal
    total_split_tax: Decimal
    tax_diff_amount: Decimal
    split_results: List[SplitResult]
    warnings: List[str]
    errors: List[str]


def round_decimal(value: Decimal, places: int = 2) -> Decimal:
    return value.quantize(Decimal(f"0.{'0' * places}"), rounding=ROUND_HALF_UP)
