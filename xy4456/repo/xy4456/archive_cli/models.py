from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum


class CheckStatus(Enum):
    AVAILABLE = "available"
    BLOCKED = "blocked"
    WARNING = "warning"


class BlockReason(Enum):
    MOLD_RISK = "mold_risk"
    SCANNER_INCOMPATIBLE = "scanner_incompatible"
    MAINTENANCE_EXPIRED = "maintenance_expired"
    RESERVATION_CONFLICT = "reservation_conflict"


@dataclass
class FilmRoll:
    """缩微胶片卷"""
    id: str
    title: str
    description: Optional[str] = None
    format: Optional[str] = None  # 35mm, 16mm, etc.
    scanner_requirements: Optional[str] = None  # 所需扫描仪型号
    location: Optional[str] = None
    condition: Optional[str] = None  # 存储条件
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Scanner:
    """扫描仪设备"""
    id: str
    name: str
    model: str
    supported_formats: List[str] = field(default_factory=list)
    location: Optional[str] = None
    status: str = "active"  # active, maintenance, retired
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class MaintenanceRecord:
    """扫描仪维护记录"""
    id: str
    scanner_id: str
    maintenance_date: date
    next_maintenance_date: Optional[date] = None
    technician: Optional[str] = None
    description: Optional[str] = None
    status: str = "completed"  # scheduled, completed, cancelled
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class TemperatureHumidityLog:
    """库房温湿度日志"""
    id: str
    location: str
    timestamp: datetime
    temperature: float  # 摄氏度
    humidity: float  # 百分比
    recorded_by: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Reservation:
    """预约单"""
    id: str
    film_roll_id: str
    reader_name: str
    reader_contact: Optional[str] = None
    start_time: datetime
    end_time: datetime
    purpose: Optional[str] = None
    status: str = "active"  # active, cancelled, completed
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class Note:
    """人工复核备注"""
    id: str
    related_type: str  # film_roll, scanner, maintenance, reservation, check_result
    related_id: str
    content: str
    created_by: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class CheckResult:
    """检查结果"""
    id: str
    film_roll_id: str
    check_time: datetime
    status: CheckStatus
    block_reasons: List[BlockReason] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    notes: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class HandoverForm:
    """交接单"""
    id: str
    film_roll_id: str
    film_roll_title: str
    reader_name: str
    check_result: CheckResult
    handover_time: datetime
    expected_return_time: Optional[datetime] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
