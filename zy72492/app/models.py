from datetime import datetime
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from enum import Enum


class RecordType(str, Enum):
    CONSTRUCTION_NOTICE = "施工告示"
    RAMP_RECORD = "无障碍坡道记录"
    STREET_FURNITURE = "街道家具破损"


class SamplingTime(str, Enum):
    DAY = "白天"
    NIGHT = "晚上"


class Status(str, Enum):
    PENDING_REVIEW = "待街道规划员复核"
    NORMAL = "正常"
    LOW_COVERAGE = "晚上缺采样导致热力图偏低"
    SUPPLEMENTED = "已补录"
    CORRECTED = "人工修正"


class AuditAction(str, Enum):
    IMPORT = "导入"
    SUPPLEMENT = "补录"
    CORRECT = "人工修正"
    RERUN = "重跑"
    REVIEW = "复核"


class StreetPoint(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    district: str


class SamplingRecord(BaseModel):
    id: str
    point_id: str
    record_type: RecordType
    sampling_time: SamplingTime
    has_coverage: bool
    score: float
    data: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)
    created_by: str


class DispatchOrder(BaseModel):
    id: str
    title: str
    description: str
    point_id: str
    status: Status
    heatmap_score: float
    missing_reason: Optional[str] = None
    next_action: Optional[str] = None
    responsible_person: Optional[str] = None
    records: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class AuditLog(BaseModel):
    id: str
    order_id: Optional[str] = None
    action: AuditAction
    operator: str
    timestamp: datetime = Field(default_factory=datetime.now)
    changes: Dict[str, Any] = Field(default_factory=dict)
    reason: Optional[str] = None


class HeatmapCell(BaseModel):
    point_id: str
    score: float
    status: Status
    reason: Optional[str] = None
    has_day_coverage: bool
    has_night_coverage: bool
    related_orders: List[str] = Field(default_factory=list)


class HeatmapResult(BaseModel):
    generated_at: datetime
    cells: List[HeatmapCell]
    version: int
    notes: List[str] = Field(default_factory=list)
