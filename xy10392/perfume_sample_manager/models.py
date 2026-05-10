from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class SampleBatch:
    batch_id: str
    fragrance_name: str
    total_quantity: int
    production_date: str
    notes: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class Shipment:
    shipment_id: str
    batch_id: str
    store_name: str
    quantity: int
    shipment_date: str
    responsible_person: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class Feedback:
    feedback_id: str
    shipment_id: str
    rating: int
    comments: Optional[str] = None
    feedback_date: Optional[str] = None
    tester_name: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class Recovery:
    recovery_id: str
    shipment_id: str
    quantity_recovered: int
    recovery_date: str
    lost_quantity: int = 0
    notes: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class Compensation:
    compensation_id: str
    recovery_id: str
    amount: float
    compensation_date: str
    responsible_person: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
