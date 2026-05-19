from datetime import datetime
from typing import Optional
from pydantic import Field
from .base import BaseEntity
from .enums import DangerLevel


class Reagent(BaseEntity):
    name: str
    cas_no: Optional[str] = None
    formula: Optional[str] = None
    specification: str
    manufacturer: Optional[str] = None
    danger_level: DangerLevel = DangerLevel.NONE
    unit: str
    warning_threshold: float = 0.0
    description: Optional[str] = None
    category: Optional[str] = None
    storage_condition: Optional[str] = None

    @property
    def is_dangerous(self) -> bool:
        return self.danger_level in [DangerLevel.HIGH, DangerLevel.EXTREME]

    @property
    def requires_double_approval(self) -> bool:
        return self.danger_level in [DangerLevel.EXTREME]


class ReagentInventory(BaseEntity):
    reagent_id: str
    batch_no: str
    quantity: float = 0.0
    available_quantity: float = 0.0
    unit: str
    production_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    location: Optional[str] = None
    supplier: Optional[str] = None
    remark: Optional[str] = None

    @property
    def is_expired(self) -> bool:
        if self.expiry_date is None:
            return False
        return datetime.now() > self.expiry_date

    def add_quantity(self, amount: float):
        if amount < 0:
            raise ValueError("数量不能为负数")
        self.quantity += amount
        self.available_quantity += amount

    def subtract_quantity(self, amount: float):
        if amount < 0:
            raise ValueError("数量不能为负数")
        if self.available_quantity < amount:
            raise ValueError("可用库存不足")
        self.quantity -= amount
        self.available_quantity -= amount

    def reserve_quantity(self, amount: float):
        if amount < 0:
            raise ValueError("数量不能为负数")
        if self.available_quantity < amount:
            raise ValueError("可用库存不足")
        self.available_quantity -= amount

    def release_reserved(self, amount: float):
        if amount < 0:
            raise ValueError("数量不能为负数")
        self.available_quantity += amount
