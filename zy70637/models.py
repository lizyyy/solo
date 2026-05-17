from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
import hashlib


class MaterialType(Enum):
    FLOWER_STAND = "花架"
    LIGHT_STRING = "灯串"
    TABLE_CARD = "桌牌"
    OTHER = "其他"


class DamageLevel(Enum):
    NONE = "无损坏"
    MINOR = "轻微损坏"
    MAJOR = "严重损坏"
    LOST = "丢失"


class CompensationStatus(Enum):
    PENDING = "待赔付"
    IN_PROGRESS = "赔付中"
    COMPLETED = "已赔付"
    WAIVED = "已豁免"


@dataclass
class SourceInfo:
    file_path: str = ""
    sheet_name: Optional[str] = None
    row_number: int = 0
    raw_content: str = ""


@dataclass
class Order:
    source: SourceInfo = field(repr=False)
    order_id: str = ""
    event_name: str = ""
    event_date: str = ""
    customer_name: str = ""
    customer_phone: str = ""

    def __hash__(self):
        return hash(self.order_id)


@dataclass
class Material:
    source: SourceInfo = field(repr=False)
    material_id: str = ""
    name: str = ""
    material_type: MaterialType = MaterialType.OTHER
    unit_price: float = 0.0
    quantity: int = 0

    def __hash__(self):
        return hash(self.material_id)


@dataclass
class OutboundRecord:
    source: SourceInfo = field(repr=False)
    outbound_id: str = ""
    order_id: str = ""
    material_id: str = ""
    quantity: int = 0
    outbound_date: str = ""
    handler: str = ""

    def __hash__(self):
        return hash(self.outbound_id)


@dataclass
class ReturnRecord:
    source: SourceInfo = field(repr=False)
    return_id: str = ""
    order_id: str = ""
    material_id: str = ""
    quantity: int = 0
    return_date: str = ""
    checker: str = ""
    damage_level: DamageLevel = DamageLevel.NONE
    damage_description: str = ""

    def __hash__(self):
        return hash(self.return_id)


@dataclass
class CompensationRecord:
    source: SourceInfo = field(repr=False)
    compensation_id: str = ""
    order_id: str = ""
    material_id: str = ""
    damage_level: DamageLevel = DamageLevel.NONE
    compensation_amount: float = 0.0
    status: CompensationStatus = CompensationStatus.PENDING
    recorded_at: str = ""
    notes: str = ""

    def __hash__(self):
        return hash(self.compensation_id)


@dataclass
class BadRecord:
    source: SourceInfo = field(repr=False)
    error_message: str = ""
    error_type: str = ""


@dataclass
class MaterialInventory:
    material_id: str
    order_id: str
    outbound_quantity: int = 0
    returned_quantity: int = 0
    lost_quantity: int = 0
    damaged_quantity: int = 0

    @property
    def pending_quantity(self) -> int:
        return self.outbound_quantity - self.returned_quantity


def stable_hash(obj: Any) -> str:
    if isinstance(obj, dict):
        sorted_items = sorted((k, stable_hash(v)) for k, v in obj.items())
        content = str(sorted_items)
    elif isinstance(obj, (list, tuple)):
        content = str([stable_hash(x) for x in sorted(obj, key=str)])
    else:
        content = str(obj)
    return hashlib.md5(content.encode("utf-8")).hexdigest()
