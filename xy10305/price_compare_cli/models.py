from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class WarningType(Enum):
    MISSING_TAX_RATE = "缺税率"
    GIFT_NOT_CONVERTIBLE = "赠品无法折算"
    UNIT_MISMATCH = "数量单位不一致"
    PACKAGE_UNKNOWN = "套餐包内容未知"


@dataclass
class Item:
    sku: str
    name: str
    quantity: float
    unit: str
    unit_price: float
    tax_rate: Optional[float] = None
    is_gift: bool = False
    is_package_item: bool = False
    original_line: Dict[str, Any] = field(default_factory=dict)
    warnings: List[WarningType] = field(default_factory=list)
    
    @property
    def subtotal(self) -> float:
        return self.unit_price * self.quantity
    
    @property
    def tax_amount(self) -> float:
        if self.tax_rate is None:
            return 0.0
        return self.subtotal * self.tax_rate / 100
    
    @property
    def total(self) -> float:
        return self.subtotal + self.tax_amount


@dataclass
class Package:
    sku: str
    name: str
    quantity: float
    unit: str
    package_price: float
    items: List[Item]
    tax_rate: Optional[float] = None
    original_line: Dict[str, Any] = field(default_factory=dict)
    warnings: List[WarningType] = field(default_factory=list)


@dataclass
class Correction:
    timestamp: datetime
    field: str
    old_value: Any
    new_value: Any
    reason: str


@dataclass
class SupplierQuote:
    supplier_name: str
    quote_id: str
    quote_date: Optional[datetime] = None
    items: List[Item] = field(default_factory=list)
    packages: List[Package] = field(default_factory=list)
    shipping_fee: float = 0.0
    shipping_tax_rate: Optional[float] = None
    corrections: List[Correction] = field(default_factory=list)
    file_hash: str = ""
    
    @property
    def items_subtotal(self) -> float:
        return sum(item.subtotal for item in self.items) + sum(
            pkg.package_price * pkg.quantity for pkg in self.packages
        )
    
    @property
    def items_tax(self) -> float:
        return sum(item.tax_amount for item in self.items) + sum(
            (pkg.package_price * pkg.quantity * (pkg.tax_rate or 0)) / 100
            for pkg in self.packages
        )
    
    @property
    def shipping_tax(self) -> float:
        if self.shipping_tax_rate is None:
            return 0.0
        return self.shipping_fee * self.shipping_tax_rate / 100
    
    @property
    def grand_total(self) -> float:
        return self.items_subtotal + self.items_tax + self.shipping_fee + self.shipping_tax
    
    @property
    def all_warnings(self) -> List[str]:
        warnings = []
        for item in self.items:
            for w in item.warnings:
                warnings.append(f"[{item.sku} {item.name}] {w.value}")
        for pkg in self.packages:
            for w in pkg.warnings:
                warnings.append(f"[套餐 {pkg.sku} {pkg.name}] {w.value}")
        return warnings
