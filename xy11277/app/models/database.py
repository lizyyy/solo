from datetime import datetime, date
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from uuid import uuid4


def generate_id() -> str:
    return str(uuid4())


@dataclass
class Forklift:
    id: str = field(default_factory=generate_id)
    name: str = ""
    battery_level: float = 100.0
    status: str = "idle"
    current_driver: Optional[str] = None
    last_maintenance: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    is_active: bool = True


@dataclass
class ChargingStation:
    id: str = field(default_factory=generate_id)
    name: str = ""
    status: str = "available"
    current_forklift: Optional[str] = None
    charging_start_time: Optional[datetime] = None
    power: float = 100.0
    created_at: datetime = field(default_factory=datetime.now)
    is_active: bool = True


@dataclass
class Driver:
    id: str = field(default_factory=generate_id)
    name: str = ""
    phone: str = ""
    id_card: str = ""
    employee_id: str = ""
    status: str = "available"
    shift_type: str = "night"
    created_at: datetime = field(default_factory=datetime.now)
    is_active: bool = True


@dataclass
class Schedule:
    id: str = field(default_factory=generate_id)
    schedule_date: date = field(default_factory=lambda: date.today())
    shift: str = "night"
    driver_id: str = ""
    forklift_id: str = ""
    task_ids: List[str] = field(default_factory=list)
    status: str = "scheduled"
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    idempotency_key: Optional[str] = None


@dataclass
class Task:
    id: str = field(default_factory=generate_id)
    name: str = ""
    description: str = ""
    priority: str = "normal"
    estimated_duration: int = 60
    status: str = "pending"
    assigned_to: Optional[str] = None
    schedule_id: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    idempotency_key: Optional[str] = None


@dataclass
class LockRecord:
    id: str = field(default_factory=generate_id)
    resource_type: str = ""
    resource_id: str = ""
    locked_by: str = ""
    locked_at: datetime = field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None
    reason: str = ""
    is_active: bool = True


@dataclass
class ExceptionRecord:
    id: str = field(default_factory=generate_id)
    schedule_id: Optional[str] = None
    task_id: Optional[str] = None
    forklift_id: Optional[str] = None
    driver_id: Optional[str] = None
    exception_type: str = ""
    description: str = ""
    severity: str = "medium"
    status: str = "open"
    reported_by: str = ""
    reported_at: datetime = field(default_factory=datetime.now)
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution: Optional[str] = None


@dataclass
class DailyReport:
    id: str = field(default_factory=generate_id)
    report_date: date = field(default_factory=lambda: date.today())
    shift: str = "night"
    total_tasks: int = 0
    completed_tasks: int = 0
    total_drivers: int = 0
    active_drivers: int = 0
    total_forklifts: int = 0
    active_forklifts: int = 0
    total_exceptions: int = 0
    resolved_exceptions: int = 0
    charging_stations_used: int = 0
    generated_at: datetime = field(default_factory=datetime.now)
    generated_by: str = ""
    details: Dict[str, Any] = field(default_factory=dict)


class InMemoryDB:
    def __init__(self):
        self.forklifts: Dict[str, Forklift] = {}
        self.charging_stations: Dict[str, ChargingStation] = {}
        self.drivers: Dict[str, Driver] = {}
        self.schedules: Dict[str, Schedule] = {}
        self.tasks: Dict[str, Task] = {}
        self.lock_records: Dict[str, LockRecord] = {}
        self.exception_records: Dict[str, ExceptionRecord] = {}
        self.daily_reports: Dict[str, DailyReport] = {}
        
        self._init_sample_data()
    
    def _init_sample_data(self):
        for i in range(5):
            forklift = Forklift(name=f"叉车-{i+1:02d}", battery_level=80.0 + i * 4)
            self.forklifts[forklift.id] = forklift
        
        for i in range(3):
            station = ChargingStation(name=f"充电桩-{i+1:02d}")
            self.charging_stations[station.id] = station
        
        drivers_data = [
            ("张三", "13800138001", "110101199001011234"),
            ("李四", "13800138002", "110101199002022345"),
            ("王五", "13800138003", "110101199003033456"),
        ]
        for name, phone, id_card in drivers_data:
            driver = Driver(name=name, phone=phone, id_card=id_card, employee_id=f"EMP{len(self.drivers)+1:04d}")
            self.drivers[driver.id] = driver


db = InMemoryDB()
