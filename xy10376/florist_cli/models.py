from dataclasses import dataclass, field
from typing import Dict, List, Optional
from datetime import datetime


@dataclass
class FlowerRequirement:
    name: str
    quantity: int
    is_specified: bool = False


@dataclass
class Order:
    order_id: str
    customer_name: str
    phone: str
    order_type: str
    is_urgent: bool
    flowers: List[FlowerRequirement]
    packaging: str
    preferred_delivery: Optional[datetime]
    batch_id: Optional[str] = None
    source_file: Optional[str] = None
    import_time: Optional[datetime] = None
    status: str = "pending"
    workstation_id: Optional[str] = None
    delivery_slot_id: Optional[str] = None
    flower_replacements: Dict[str, str] = field(default_factory=dict)
    notes: str = ""


@dataclass
class FlowerInventory:
    name: str
    quantity: int
    unit: str = "束"


@dataclass
class Workstation:
    workstation_id: str
    name: str
    capacity: int
    packaging_types: List[str]
    current_orders: List[str] = field(default_factory=list)


@dataclass
class DeliverySlot:
    slot_id: str
    time: datetime
    capacity: int
    current_orders: List[str] = field(default_factory=list)


@dataclass
class ReplacementRule:
    original: str
    alternatives: List[str]
    priority: int = 1


@dataclass
class ProductionSchedule:
    order_id: str
    workstation_id: str
    workstation_name: str
    flowers_required: Dict[str, int]
    flowers_reserved: Dict[str, int]
    flowers_replaced: Dict[str, str]
    delivery_slot: Optional[str]
    status: str
    notes: str


@dataclass
class ProcurementGap:
    flower_name: str
    required: int
    available: int
    gap: int
    affected_orders: List[str]


@dataclass
class SystemState:
    orders: Dict[str, Order] = field(default_factory=dict)
    inventory: Dict[str, FlowerInventory] = field(default_factory=dict)
    workstations: Dict[str, Workstation] = field(default_factory=dict)
    delivery_slots: Dict[str, DeliverySlot] = field(default_factory=dict)
    replacement_rules: Dict[str, ReplacementRule] = field(default_factory=dict)
    import_sources: Dict[str, List[str]] = field(default_factory=dict)
