from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, List, Dict


@dataclass
class MenuItem:
    id: str
    name: str
    window: str
    category: str
    price: float
    is_special: bool = False


@dataclass
class Reservation:
    id: str
    menu_item_id: str
    menu_item_name: str
    window: str
    weight: float
    container_id: str
    fridge_location: str
    operator: str
    registration_time: datetime
    expected_destruction_time: datetime
    status: str = "registered"
    actual_destruction_time: Optional[datetime] = None
    destruction_operator: Optional[str] = None
    notes: str = ""


@dataclass
class DailyData:
    date: str
    menu_items: List[MenuItem] = field(default_factory=list)
    reservations: List[Reservation] = field(default_factory=list)
    missed_items: List[Dict] = field(default_factory=list)


@dataclass
class ValidationIssue:
    type: str
    severity: str
    message: str
    menu_item: Optional[MenuItem] = None
    reservation: Optional[Reservation] = None
