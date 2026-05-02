from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime, timedelta


@dataclass
class Yard:
    id: str
    name: str
    distance_to_port: int


@dataclass
class ContainerType:
    id: str
    name: str
    is_reefer: bool = False


@dataclass
class YardInventory:
    yard_id: str
    container_type: str
    quantity: int


@dataclass
class VesselDemand:
    vessel_id: str
    vessel_name: str
    eta: datetime
    etd: datetime
    demands: Dict[str, int]
    berth: str


@dataclass
class TruckSlot:
    slot_id: str
    start_time: datetime
    end_time: datetime
    capacity: int
    available_capacity: int = field(init=False)

    def __post_init__(self):
        self.available_capacity = self.capacity


@dataclass
class Move:
    move_id: str
    from_yard: str
    to_yard: str
    container_type: str
    quantity: int
    slot_id: str
    time: datetime
    reason: str


@dataclass
class Risk:
    risk_type: str
    vessel_id: str
    container_type: str
    shortage: int = 0
    stuck: int = 0
    description: str = ""


@dataclass
class SimulationResult:
    moves: List[Move]
    risks: List[Risk]
    final_inventory: List[YardInventory]
    timeline: List[Dict] = field(default_factory=list)
