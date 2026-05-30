"""
核心数据模型定义
"""
from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
from enum import Enum
import uuid


class DataSourceType(str, Enum):
    """数据源类型"""
    DROP_CONFIG = "drop_config"
    PLAYER_LOG = "player_log"
    ITEM_POOL = "item_pool"
    ACTIVITY_PERIOD = "activity_period"
    COMPLAINT_RECORD = "complaint_record"
    CALIBRATION_REPORT = "calibration_report"


@dataclass
class DataSource:
    """
    数据源信息，用于追踪数据来源和版本
    保留所有导入的历史版本，不覆盖旧数据
    """
    source_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source_type: DataSourceType = DataSourceType.DROP_CONFIG
    file_path: str = ""
    file_name: str = ""
    sheet_name: Optional[str] = None
    version: str = "1.0"
    import_time: datetime = field(default_factory=datetime.now)
    is_active: bool = True
    import_notes: str = ""
    original_row_count: int = 0
    imported_row_count: int = 0
    skipped_row_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result["import_time"] = self.import_time.isoformat()
        result["source_type"] = self.source_type.value
        return result


@dataclass
class DropConfig:
    """
    掉落配置
    包含某个掉落点的配置概率信息
    """
    config_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source_id: str = ""
    pool_id: str = ""
    item_id: str = ""
    item_name: str = ""
    probability: float = 0.0
    min_count: int = 1
    max_count: int = 1
    weight: float = 0.0
    effective_time: Optional[datetime] = None
    expire_time: Optional[datetime] = None
    is_enabled: bool = True
    config_version: str = "1.0"
    source_row: Optional[int] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ItemPool:
    """
    道具池
    定义一组可掉落的道具
    """
    pool_id: str = ""
    pool_name: str = ""
    source_id: str = ""
    description: str = ""
    pool_type: str = "normal"
    is_active: bool = True
    total_weight: float = 0.0
    item_count: int = 0
    source_row: Optional[int] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ActivityPeriod:
    """
    活动时段
    定义活动期间的掉落加成
    """
    activity_id: str = ""
    activity_name: str = ""
    source_id: str = ""
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    pool_id: str = ""
    item_id: str = ""
    drop_rate_multiplier: float = 1.0
    guaranteed_drop_count: int = 0
    is_active: bool = True
    source_row: Optional[int] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PlayerLog:
    """
    玩家掉落日志
    记录实际的掉落事件
    """
    log_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source_id: str = ""
    player_id: str = ""
    pool_id: str = ""
    item_id: str = ""
    item_name: str = ""
    drop_count: int = 1
    drop_time: Optional[datetime] = None
    server_id: str = ""
    channel: str = ""
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None
    activity_applied: Optional[str] = None
    effective_probability: Optional[float] = None
    source_row: Optional[int] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ComplaintRecord:
    """
    投诉记录
    玩家投诉掉落异常的记录
    """
    complaint_id: str = ""
    source_id: str = ""
    player_id: str = ""
    pool_id: str = ""
    item_id: str = ""
    complaint_time: Optional[datetime] = None
    complaint_content: str = ""
    expected_probability: Optional[float] = None
    actual_drop_count: int = 0
    total_attempts: int = 0
    is_verified: bool = False
    verification_result: str = ""
    source_row: Optional[int] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CalibrationParams:
    """
    校准参数
    用于保证计算的可复现性，所有筛选条件和计算参数都要记录
    """
    params_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_time: datetime = field(default_factory=datetime.now)

    # 时间筛选
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    # 数据筛选
    pool_ids: List[str] = field(default_factory=list)
    item_ids: List[str] = field(default_factory=list)
    player_ids: List[str] = field(default_factory=list)
    server_ids: List[str] = field(default_factory=list)
    channels: List[str] = field(default_factory=list)
    activity_ids: List[str] = field(default_factory=list)

    # 数据清洗参数
    deduplicate_enabled: bool = True
    deduplicate_keys: List[str] = field(
        default_factory=lambda: ["player_id", "pool_id", "item_id", "drop_time"]
    )
    activity_bonus_enabled: bool = True
    probability_normalization_enabled: bool = True

    # 统计检验参数
    confidence_level: float = 0.95
    min_sample_size: int = 30
    max_sample_size: Optional[int] = None
    test_method: str = "chi_square"
    significance_level: float = 0.05

    # 异常检测参数
    deviation_warning_threshold: float = 0.1
    deviation_critical_threshold: float = 0.3

    # 分组参数
    group_by: List[str] = field(
        default_factory=lambda: ["pool_id", "item_id"]
    )

    # 备注
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        for key in ["created_time", "start_time", "end_time"]:
            if getattr(self, key):
                result[key] = getattr(self, key).isoformat()
        return result

    def get_filter_hash(self) -> str:
        """生成筛选条件的哈希，用于判断是否相同的筛选条件"""
        import hashlib
        from .utils import safe_json_dumps
        params_dict = self.to_dict()
        params_dict.pop("params_id")
        params_dict.pop("created_time")
        params_str = safe_json_dumps(params_dict, sort_keys=True)
        return hashlib.md5(params_str.encode("utf-8")).hexdigest()
