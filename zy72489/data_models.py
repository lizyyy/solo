from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum


class PointStatus(Enum):
    PENDING = "待复核"
    NORMAL = "正常"
    NEEDS_REVIEW = "需居民代表复核"
    SUPPLEMENTED = "补录完成"
    CONSTRUCTION_DETOUR = "施工临时改道"


class DataSource(Enum):
    RAMP_IMPORT = "无障碍坡道导入"
    NIGHT_SAMPLING = "夜间采样点补录"
    MANUAL_CORRECTION = "人工修正"
    RERUN = "重跑"


@dataclass
class PointRecord:
    point_id: str
    name: str
    address: str
    status: PointStatus
    source: DataSource
    created_at: str
    updated_at: str
    notes: str = ""
    map_synced: bool = True
    construction_note: str = ""
    old_caliber: str = ""
    new_caliber: str = ""


@dataclass
class HistoryLog:
    log_id: str
    point_id: str
    action: str
    operator: str
    timestamp: str
    details: str
    before_status: Optional[str] = None
    after_status: Optional[str] = None


@dataclass
class ProcessingSession:
    session_id: str
    name: str
    material_type: str
    start_time: str
    end_time: Optional[str] = None
    point_records: List[PointRecord] = field(default_factory=list)
    history_logs: List[HistoryLog] = field(default_factory=list)
    step: int = 0
    remarks: str = ""
