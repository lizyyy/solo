"""数据模型定义"""
from dataclasses import dataclass, field
from datetime import datetime, time
from enum import Enum
from typing import Optional, List


class OrderStatus(str, Enum):
    PENDING = "pending"
    PROOFING = "proofing"
    BAKING = "baking"
    READY = "ready"
    DELIVERED = "delivered"
    CONFLICT = "conflict"
    ERROR = "error"


class ScheduleStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Product:
    product_id: str
    name: str
    proofing_time_minutes: int
    baking_time_minutes: int
    oven_capacity_units: int


@dataclass
class Oven:
    oven_id: str
    name: str
    max_capacity_units: int
    available_from: time
    available_to: time


@dataclass
class DeliveryWindow:
    window_id: str
    start_time: time
    end_time: time
    description: str


@dataclass
class Order:
    order_id: str
    source_system: str
    source_record_id: str
    product_id: str
    quantity: int
    customer_name: str
    delivery_window_id: str
    status: OrderStatus = OrderStatus.PENDING
    priority: int = 0
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class ProofingSchedule:
    schedule_id: str
    order_id: str
    proofing_start: datetime
    proofing_end: datetime
    status: ScheduleStatus = ScheduleStatus.PENDING
    notes: Optional[str] = None


@dataclass
class BakingSchedule:
    schedule_id: str
    order_id: str
    oven_id: str
    baking_start: datetime
    baking_end: datetime
    units_used: int
    status: ScheduleStatus = ScheduleStatus.PENDING
    notes: Optional[str] = None


@dataclass
class Anomaly:
    anomaly_id: str
    order_id: str
    anomaly_type: str
    description: str
    detected_at: datetime = field(default_factory=datetime.now)
    resolved: bool = False


@dataclass
class ScheduledDelivery:
    order_id: str
    product_name: str
    quantity: int
    customer_name: str
    proofing_start: datetime
    proofing_end: datetime
    oven_id: str
    baking_start: datetime
    baking_end: datetime
    delivery_window: str
    status: str
