from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional


class ShortageLevel(Enum):
    NONE = "无短少"
    MINOR = "轻微短少(≤5%)"
    MEDIUM = "中等短少(5%-15%)"
    SEVERE = "严重短少(>15%)"


class LinenType(Enum):
    BEDSHEET = "床单"
    PILLOWCASE = "枕套"
    TOWEL = "毛巾"
    BATH_TOWEL = "浴巾"
    TABLECLOTH = "台布"
    NAPKIN = "口布"


@dataclass
class DamageRecord:
    linen_type: str
    quantity: int
    reason: str
    recorded_at: datetime = field(default_factory=datetime.now)


@dataclass
class RewashRecord:
    linen_type: str
    quantity: int
    reason: str
    recorded_at: datetime = field(default_factory=datetime.now)


@dataclass
class HotelRecord:
    hotel_name: str
    linen_type: str
    inbound_quantity: int
    damage_records: List[DamageRecord] = field(default_factory=list)
    rewash_records: List[RewashRecord] = field(default_factory=list)


@dataclass
class ProcessingResult:
    hotel_name: str
    linen_type: str
    inbound_quantity: int
    total_damage: int
    total_rewash: int
    outbound_quantity: int
    shortage: int
    shortage_rate: float
    shortage_level: ShortageLevel
    processed_at: datetime = field(default_factory=datetime.now)


@dataclass
class ValidationError:
    field: str
    message: str
    severity: str = "error"
