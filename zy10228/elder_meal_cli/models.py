from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional, List, Dict
from enum import Enum


class OrderStatus(str, Enum):
    PLACED = "已下单"
    PREPPING = "备餐中"
    DELIVERING = "配送中"
    DELIVERED = "已送达"
    CANCELLED = "已取消"
    REFUNDED = "已退餐"


class SubsidyType(str, Enum):
    NONE = "无补贴"
    GENERAL = "普通补贴"
    SPECIAL = "特殊补贴"
    DISABLED = "残障补贴"


class CancellationReason(str, Enum):
    ILLNESS = "身体不适"
    OUTING = "外出"
    FAMILY_VISIT = "家人来访"
    NO_NEED = "不需要"
    OTHER = "其他"


@dataclass
class Elder:
    id: Optional[int] = None
    name: str = ""
    phone: str = ""
    id_card: str = ""
    subsidy_type: str = SubsidyType.GENERAL.value
    address: str = ""
    district: str = ""
    route: str = ""
    notes: str = ""
    created_at: str = ""
    updated_at: str = ""


@dataclass
class MealPlan:
    id: Optional[int] = None
    name: str = ""
    price: float = 0.0
    subsidy_amount: float = 0.0
    description: str = ""
    is_active: bool = True


@dataclass
class SubsidyHistory:
    id: Optional[int] = None
    elder_id: int = 0
    old_subsidy_type: str = ""
    new_subsidy_type: str = ""
    effective_date: str = ""
    notes: str = ""
    changed_at: str = ""


@dataclass
class Order:
    id: Optional[int] = None
    elder_id: int = 0
    elder_name: str = ""
    meal_date: str = ""
    meal_plan_id: int = 0
    meal_plan_name: str = ""
    price: float = 0.0
    subsidy_type: str = ""
    subsidy_amount: float = 0.0
    actual_payment: float = 0.0
    delivery_address: str = ""
    district: str = ""
    route: str = ""
    status: str = OrderStatus.PLACED.value
    import_source: str = ""
    import_id: str = ""
    created_at: str = ""
    updated_at: str = ""


@dataclass
class CancellationRecord:
    id: Optional[int] = None
    order_id: int = 0
    cancel_time: str = ""
    reason: str = ""
    reason_detail: str = ""
    is_after_deadline: bool = False
    deadline_time: str = ""
    is_delivered: bool = False
    refund_amount: float = 0.0
    deduction_amount: float = 0.0
    notes: str = ""


@dataclass
class DeliveryRecord:
    id: Optional[int] = None
    order_id: int = 0
    deliverer: str = ""
    delivery_time: str = ""
    delivered: bool = True
    receiver: str = ""
    notes: str = ""


@dataclass
class PaymentRecord:
    id: Optional[int] = None
    order_id: int = 0
    amount: float = 0.0
    payment_method: str = ""
    payment_time: str = ""
    notes: str = ""


@dataclass
class ValidationError:
    field: str
    message: str
    severity: str = "error"


@dataclass
class ValidationResult:
    success: bool
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)
