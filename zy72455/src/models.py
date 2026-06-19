from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class ProcessingStatus(str, Enum):
    IMPORTED = "已导入"
    BUS_CARD_DATA_ADDED = "公交刷卡时段已补录"
    HEATMAP_GENERATED = "热力图已生成"
    PENDING_REVIEW = "待复核"
    REVIEWED_NORMAL = "复核通过-正常"
    REVIEWED_LOW_SAMPLING = "复核通过-夜间缺采样"
    ROLLED_BACK = "已回滚"


class HeatmapIssue(str, Enum):
    NONE = "无异常"
    LOW_NIGHT_SAMPLING = "夜间缺采样导致热力图偏低"
    OTHER = "其他异常"


class ImportType(str, Enum):
    NEW = "新增"
    REUSED = "复用"


@dataclass
class OriginalRow:
    row_number: int
    raw_data: Dict[str, Any]
    source_file: str
    import_timestamp: datetime


@dataclass
class ManualChange:
    field_name: str
    old_value: Any
    new_value: Any
    operator: str
    change_timestamp: datetime
    reason: str


@dataclass
class IntersectionPhoto:
    photo_id: str
    intersection_name: str
    original_row: OriginalRow
    current_status: ProcessingStatus
    import_type: ImportType = ImportType.NEW
    manual_changes: List[ManualChange] = field(default_factory=list)
    bus_card_hours: Optional[List[str]] = None
    heatmap_data: Optional[Dict[str, Any]] = None
    heatmap_issue: HeatmapIssue = HeatmapIssue.NONE
    review_note: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class HistoryRecord:
    record_id: str
    photo_id: str
    change_type: str
    old_snapshot: Dict[str, Any]
    new_snapshot: Dict[str, Any]
    operator: str
    change_timestamp: datetime
    description: str
