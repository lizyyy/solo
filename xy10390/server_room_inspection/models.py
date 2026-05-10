"""
数据模型模块
定义巡检、UPS、空调告警等数据结构
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, Dict, Any, List
import json


@dataclass
class InspectionRecord:
    """人工巡检记录"""
    inspection_time: str
    room_id: str
    room_name: str
    inspector: str
    temperature: float
    temperature_unit: str
    humidity: float
    humidity_unit: str
    remarks: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def inspection_date(self) -> str:
        return self.inspection_time.split()[0]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "InspectionRecord":
        return cls(**data)


@dataclass
class UPSStatus:
    """UPS状态记录"""
    ups_id: str
    ups_name: str
    inspection_time: str
    battery_voltage: float
    load_percent: float
    status: str
    remarks: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def inspection_date(self) -> str:
        return self.inspection_time.split()[0]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UPSStatus":
        return cls(**data)


@dataclass
class ACAlarm:
    """空调告警记录"""
    ac_id: str
    ac_name: str
    alarm_time: str
    alarm_code: str
    alarm_message: str
    status: str
    handled_by: str = ""
    handled_time: str = ""
    resolution: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def inspection_date(self) -> str:
        return self.alarm_time.split()[0]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ACAlarm":
        return cls(**data)


@dataclass
class Risk:
    """风险记录"""
    risk_id: str
    date: str
    type: str
    code: str
    level: str
    source: str
    message: str
    suggestion: str
    status: str = "待处理"
    reviewed: bool = False
    reviewed_by: str = ""
    reviewed_at: str = ""
    notes: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Risk":
        return cls(**data)


@dataclass
class ReviewRecord:
    """复核记录"""
    date: str
    reviewer: str
    reviewed_at: str
    status: str
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ReviewRecord":
        return cls(**data)
