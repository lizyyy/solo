from dataclasses import dataclass, field
from datetime import datetime, time
from enum import Enum
from typing import List, Dict, Optional, Any
import json


class RiskType(Enum):
    MISSING_INSPECTION = "漏巡"
    ODOR_EXCEED = "异味超阈"
    PEAK_FLOW_UNATTENDED = "客流突增未补给"
    EMPTYING_OVERDUE = "清掏逾期"
    REPEAT_COMPLAINT = "重复投诉"


class RiskLevel(Enum):
    HIGH = "高风险"
    MEDIUM = "中风险"
    LOW = "低风险"


class ActionType(Enum):
    ADD_STAFF = "加派保洁"
    SUSPEND = "暂停开放"
    ARRANGE_EMPTYING = "安排清掏"
    NORMAL = "正常运营"


@dataclass
class InspectionRecord:
    toilet_id: str
    station_id: str
    inspect_time: datetime
    inspector: str
    status: str  # 正常/异常
    notes: str = ""
    
    @classmethod
    def from_csv_row(cls, row: Dict[str, str]) -> 'InspectionRecord':
        return cls(
            toilet_id=str(row.get('toilet_id', '')).strip(),
            station_id=str(row.get('station_id', '')).strip(),
            inspect_time=datetime.strptime(str(row.get('inspect_time', '')).strip(), '%Y-%m-%d %H:%M:%S'),
            inspector=str(row.get('inspector', '')).strip(),
            status=str(row.get('status', '正常')).strip(),
            notes=str(row.get('notes', '')).strip()
        )


@dataclass
class SensorRecord:
    toilet_id: str
    timestamp: datetime
    ammonia_level: float  # ppm
    passenger_flow: int  # 人数
    
    @classmethod
    def from_jsonl(cls, line: str) -> 'SensorRecord':
        data = json.loads(line.strip())
        return cls(
            toilet_id=str(data.get('toilet_id', '')).strip(),
            timestamp=datetime.strptime(str(data.get('timestamp', '')).strip(), '%Y-%m-%dT%H:%M:%S'),
            ammonia_level=float(data.get('ammonia_level', 0)),
            passenger_flow=int(data.get('passenger_flow', 0))
        )


@dataclass
class EmptyingRecord:
    toilet_id: str
    arrival_time: datetime
    truck_id: str
    volume_emptied: float  # 立方米
    notes: str = ""
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EmptyingRecord':
        return cls(
            toilet_id=str(data.get('toilet_id', '')).strip(),
            arrival_time=datetime.strptime(str(data.get('arrival_time', '')).strip(), '%Y-%m-%d %H:%M:%S'),
            truck_id=str(data.get('truck_id', '')).strip(),
            volume_emptied=float(data.get('volume_emptied', 0)),
            notes=str(data.get('notes', '')).strip()
        )


@dataclass
class ComplaintRecord:
    toilet_id: str
    complaint_time: datetime
    complaint_type: str  # 异味/卫生/设施
    description: str
    reporter: str = ""
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ComplaintRecord':
        return cls(
            toilet_id=str(data.get('toilet_id', '')).strip(),
            complaint_time=datetime.strptime(str(data.get('complaint_time', '')).strip(), '%Y-%m-%d %H:%M:%S'),
            complaint_type=str(data.get('complaint_type', '')).strip(),
            description=str(data.get('description', '')).strip(),
            reporter=str(data.get('reporter', '')).strip()
        )


@dataclass
class ToiletInfo:
    toilet_id: str
    name: str
    location: str
    total_stalls: int
    inspection_interval_minutes: int = 60  # 巡检间隔（分钟）
    emptying_cycle_days: int = 30  # 清掏周期（天）
    ammonia_threshold: float = 25.0  # 氨气阈值（ppm）
    peak_flow_threshold: int = 50  # 客流突增阈值（每小时）
    
    def get_time_slot(self, dt: datetime) -> str:
        hour = dt.hour
        if 6 <= hour < 10:
            return "早高峰 (06:00-10:00)"
        elif 10 <= hour < 14:
            return "午间 (10:00-14:00)"
        elif 14 <= hour < 18:
            return "下午 (14:00-18:00)"
        elif 18 <= hour < 22:
            return "晚高峰 (18:00-22:00)"
        else:
            return "夜间 (22:00-06:00)"


@dataclass
class RiskItem:
    risk_id: str
    toilet_id: str
    toilet_name: str
    time_slot: str
    risk_type: RiskType
    risk_level: RiskLevel
    description: str
    timestamp: datetime
    raw_data: Dict[str, Any] = field(default_factory=dict)
    
    suggested_action: ActionType = ActionType.NORMAL
    manual_override: Optional[ActionType] = None
    notes: str = ""
    is_resolved: bool = False
    
    @property
    def final_action(self) -> ActionType:
        return self.manual_override if self.manual_override else self.suggested_action
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk_id": self.risk_id,
            "toilet_id": self.toilet_id,
            "toilet_name": self.toilet_name,
            "time_slot": self.time_slot,
            "risk_type": self.risk_type.value,
            "risk_level": self.risk_level.value,
            "description": self.description,
            "timestamp": self.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            "suggested_action": self.suggested_action.value,
            "manual_override": self.manual_override.value if self.manual_override else None,
            "final_action": self.final_action.value,
            "notes": self.notes,
            "is_resolved": self.is_resolved,
            "raw_data": self.raw_data
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'RiskItem':
        return cls(
            risk_id=data["risk_id"],
            toilet_id=data["toilet_id"],
            toilet_name=data["toilet_name"],
            time_slot=data["time_slot"],
            risk_type=RiskType(data["risk_type"]),
            risk_level=RiskLevel(data["risk_level"]),
            description=data["description"],
            timestamp=datetime.strptime(data["timestamp"], '%Y-%m-%d %H:%M:%S'),
            raw_data=data.get("raw_data", {}),
            suggested_action=ActionType(data["suggested_action"]),
            manual_override=ActionType(data["manual_override"]) if data.get("manual_override") else None,
            notes=data.get("notes", ""),
            is_resolved=data.get("is_resolved", False)
        )
