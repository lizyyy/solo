from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime, date


@dataclass
class Customer:
    id: int
    customer_code: str
    name: str
    phone: str = ''
    id_card: str = ''
    disease_type: str = ''
    notes: str = ''


@dataclass
class Drug:
    id: int
    drug_code: str
    name: str
    generic_name: str = ''
    specification: str = ''
    unit: str = '片'
    unit_price: float = 0.0
    manufacturer: str = ''
    category: str = ''


@dataclass
class DrugRule:
    id: int
    drug_id: int
    default_dosage: Optional[float] = None
    dosage_unit: str = ''
    daily_frequency: Optional[int] = None
    refill_window_days: int = 7
    min_days_remaining: int = 3


@dataclass
class SaleItem:
    id: int
    drug_id: int
    drug_name: str
    quantity: float
    unit_price: float
    subtotal: float
    dosage: Optional[float] = None
    dosage_unit: str = ''
    daily_frequency: Optional[int] = None


@dataclass
class SalesRecord:
    id: int
    receipt_no: str
    customer_id: int
    sale_date: str
    total_amount: float
    items: List[SaleItem] = field(default_factory=list)


@dataclass
class RefillItem:
    customer_id: int
    customer_name: str
    phone: str
    customer_code: str
    drug_id: int
    drug_name: str
    last_sale_date: date
    days_supplied: float
    days_remaining: float
    estimated_finish_date: date
    refill_window_start: date
    refill_window_end: date
    quantity_needed: float
    unit_price: float
    estimated_amount: float
    status: str
    warnings: List[str] = field(default_factory=list)


@dataclass
class ContactLog:
    id: int
    customer_id: int
    contact_date: str
    contacted_by: str = ''
    status: str = ''
    notes: str = ''
