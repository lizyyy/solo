from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class SampleType(Enum):
    BLOOD = "血样"
    REAGENT = "试剂"
    OTHER = "其他"


class AlertType(Enum):
    TIMEOUT = "超时离柜"
    TEMP_EXCEED = "温度越界"
    RACK_CONFLICT = "架位冲突"
    MISSING_SIGNATURE = "缺签"


class HandoverStatus(Enum):
    PENDING = "待交接"
    IN_PROGRESS = "交接中"
    COMPLETED = "已交接"
    CANCELLED = "已取消"


@dataclass
class Sample:
    sample_id: str
    sample_type: SampleType
    rack_id: str
    position: str
    scan_time: datetime
    in_fridge_time: Optional[datetime] = None
    out_fridge_time: Optional[datetime] = None
    status: str = "在柜"
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def duration_out(self) -> float:
        if self.in_fridge_time and self.out_fridge_time:
            delta = self.in_fridge_time - self.out_fridge_time
            return delta.total_seconds() / 60
        return 0.0


@dataclass
class Fridge:
    fridge_id: str
    name: str
    min_temp: float = 2.0
    max_temp: float = 8.0
    current_temp: Optional[float] = None
    last_temp_time: Optional[datetime] = None
    racks: List[str] = field(default_factory=list)
    
    def is_temp_normal(self, temp: float) -> bool:
        return self.min_temp <= temp <= self.max_temp


@dataclass
class Rack:
    rack_id: str
    fridge_id: str
    capacity: int = 20
    occupied_positions: Dict[str, str] = field(default_factory=dict)
    
    def is_position_occupied(self, position: str) -> bool:
        return position in self.occupied_positions
    
    def get_occupied_samples(self) -> List[str]:
        return list(self.occupied_positions.values())


@dataclass
class HandoverRecord:
    record_id: str
    sample_id: str
    from_operator: str
    to_operator: str
    handover_time: datetime
    status: HandoverStatus = HandoverStatus.PENDING
    notes: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Alert:
    alert_id: str
    alert_type: AlertType
    related_id: str
    related_type: str
    message: str
    timestamp: datetime
    is_resolved: bool = False
    resolved_time: Optional[datetime] = None
    resolver: str = ""
    notes: str = ""


@dataclass
class DutyNote:
    note_id: str
    shift_date: datetime
    operator_name: str
    content: str
    created_time: datetime
    updated_time: Optional[datetime] = None
    is_important: bool = False
