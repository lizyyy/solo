# -*- coding: utf-8 -*-
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any
from decimal import Decimal


class RoundingMode(Enum):
    ROUND_HALF_UP = "ROUND_HALF_UP"
    CEIL = "CEIL"
    FLOOR = "FLOOR"
    ROUND_UP = "ROUND_UP"
    ROUND_DOWN = "ROUND_DOWN"


class DiscountType(Enum):
    PERCENTAGE = "PERCENTAGE"
    FIXED_AMOUNT = "FIXED_AMOUNT"


class DiscountApplication(Enum):
    PRE_TAX = "PRE_TAX"
    POST_TAX = "POST_TAX"


@dataclass
class BillLineItem:
    id: str
    name: str
    quantity: int
    unit_price: Decimal
    tax_rate: Decimal
    is_tax_exempt: bool = False
    service_fee_rate: Optional[Decimal] = None
    discounts: List[str] = field(default_factory=list)
    
    subtotal: Decimal = Decimal(0)
    discount_amount: Decimal = Decimal(0)
    tax_amount: Decimal = Decimal(0)
    service_fee_amount: Decimal = Decimal(0)
    line_total: Decimal = Decimal(0)
    errors: List[str] = field(default_factory=list)


@dataclass
class DiscountRule:
    id: str
    name: str
    type: DiscountType
    value: Decimal
    application: DiscountApplication
    priority: int = 0
    applicable_line_ids: List[str] = field(default_factory=list)
    applicable_to_all: bool = False


@dataclass
class TaxRule:
    id: str
    name: str
    rate: Decimal
    categories: List[str] = field(default_factory=list)
    is_default: bool = False


@dataclass
class RoundingProfile:
    id: str
    name: str
    line_level_mode: RoundingMode = RoundingMode.ROUND_HALF_UP
    line_level_precision: int = 2
    order_level_mode: RoundingMode = RoundingMode.ROUND_HALF_UP
    order_level_precision: int = 2
    tax_rounding_mode: RoundingMode = RoundingMode.ROUND_HALF_UP
    tax_rounding_precision: int = 2


@dataclass
class Bill:
    id: str
    order_id: str
    lines: List[BillLineItem]
    currency: str = "CNY"
    rounding_profile_id: str = "default"
    discounts: List[str] = field(default_factory=list)
    notes: Optional[str] = None
    
    total_subtotal: Decimal = Decimal(0)
    total_discount: Decimal = Decimal(0)
    total_tax: Decimal = Decimal(0)
    total_service_fee: Decimal = Decimal(0)
    grand_total: Decimal = Decimal(0)
    errors: List[str] = field(default_factory=list)


@dataclass
class CalculationResult:
    bill: Bill
    calculation_steps: List[Dict[str, Any]] = field(default_factory=list)
    rounding_profile: Optional[RoundingProfile] = None
    is_valid: bool = True
    validation_errors: List[str] = field(default_factory=list)


@dataclass
class ComparisonResult:
    bill_id: str
    order_id: str
    expected: CalculationResult
    actual: CalculationResult
    differences: List[Dict[str, Any]] = field(default_factory=list)
    has_differences: bool = False
