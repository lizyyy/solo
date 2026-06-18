from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from typing import List, Optional, Dict, Any


class RecordStatus(str, Enum):
    CONFIRMED = "已确认"
    PENDING = "待补件"
    REJECTED = "退回"


class QualityFlag(str, Enum):
    NORMAL = "正常"
    CLOUD_COVER = "遥感云遮挡"
    TIME_MISMATCH = "时间不匹配"
    BOUNDARY = "边界样本"
    MISSING_BOTTLE = "采样瓶缺失"


@dataclass
class SeagrassRecord:
    record_id: str
    bottle_id: Optional[str]
    sampling_time: Optional[datetime]
    lab_time: Optional[datetime]
    seagrass_coverage: float
    biomass: float
    species: str
    location: Dict[str, float]
    quality_flags: List[QualityFlag] = field(default_factory=list)
    status: RecordStatus = RecordStatus.PENDING
    boundary_influence: float = 0.0
    notes: str = ""
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CleaningResult:
    total_records: int
    confirmed: int
    pending: int
    rejected: int
    cloud_cover_records: List[str]
    boundary_records: List[Dict[str, Any]]
    time_mismatch_count: int
    missing_bottle_count: int
    boundary_analysis: Dict[str, Any]
    cleaned_data: List[SeagrassRecord]


SCENE_LABELS = {
    "CLOUD_COVER": "遥感云遮挡记录已单独提取，不参与统计计算",
    "TIME_MISMATCH": "采样时间与实验时间偏差超过阈值，需人工复核",
    "BOUNDARY": "边界样本，对最终覆盖率计算影响显著",
    "MISSING_BOTTLE": "采样瓶编号缺失，需补充原始记录",
    "NORMAL": "数据质量合格，已确认入库"
}

SIDE_NOTES = {
    "CLOUD_COVER": "云遮挡记录单独存放于 cloud_cover_records 字段，可导出后单独处理",
    "TIME_MISMATCH": "时间偏差阈值默认 2 小时，可通过 time_threshold 参数调整",
    "BOUNDARY": "边界样本定义：覆盖率 < 5% 或 > 95%，或位置在调查区域边缘 1km 内",
    "MISSING_BOTTLE": "bottle_id 为空或格式不符合 'HC-YYYY-NNNN' 规范",
    "PENDING_FLOW": "待补件记录需在 7 个工作日内补充，否则自动转为退回"
}
