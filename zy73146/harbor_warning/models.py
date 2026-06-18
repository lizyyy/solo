"""核心数据模型定义。

所有字段名、枚举值保持稳定，供日常脚本调用。
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class ProcessStatus(str, Enum):
    """处理状态枚举 —— 值保持稳定，复核人脚本依赖。"""

    PENDING = "pending"
    ALIGNED = "aligned"
    DRIFT_DETECTED = "drift_detected"
    DRIFT_ISOLATED = "drift_isolated"
    WARNING_RAISED = "warning_raised"
    MANUAL_CONFIRMED = "manual_confirmed"
    MANUAL_REVISED = "manual_revised"
    COMPLETED = "completed"
    FAILED = "failed"


class WarningLevel(str, Enum):
    """预警级别枚举 —— 值保持稳定。"""

    NORMAL = "normal"
    ATTENTION = "attention"
    WARNING = "warning"
    CRITICAL = "critical"


class DataSource(str, Enum):
    """数据来源枚举 —— 值保持稳定。"""

    SENSOR = "sensor"
    SHIP_LOG = "ship_log"
    MANUAL = "manual"
    ALIGNED = "aligned"


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


@dataclass
class BuoyLog:
    """浮标日志原始记录。

    必须保住的字段：source（来源）、process_status（处理状态）
    其余字段通过 field_mapper 兼容各种命名。
    """

    log_id: str
    timestamp: str
    source: DataSource
    process_status: ProcessStatus = ProcessStatus.PENDING
    water_depth: Optional[float] = None
    sediment_thickness: Optional[float] = None
    flow_velocity: Optional[float] = None
    temperature: Optional[float] = None
    buoy_id: Optional[str] = None
    ship_id: Optional[str] = None
    raw_fields: dict[str, Any] = field(default_factory=dict)
    fingerprint: str = ""
    imported_at: str = field(default_factory=_now)

    def __post_init__(self) -> None:
        if not self.fingerprint:
            self.fingerprint = self._compute_fingerprint()

    def _compute_fingerprint(self) -> str:
        payload = {
            "log_id": self.log_id,
            "timestamp": self.timestamp,
            "source": self.source.value,
            "water_depth": self.water_depth,
            "sediment_thickness": self.sediment_thickness,
            "flow_velocity": self.flow_velocity,
            "temperature": self.temperature,
            "buoy_id": self.buoy_id,
            "ship_id": self.ship_id,
        }
        raw = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["source"] = self.source.value
        d["process_status"] = self.process_status.value
        return d


@dataclass
class DriftMark:
    """传感器漂移标记 —— 单独拎出来，避免混入正常结果。"""

    mark_id: str
    buoy_log_id: str
    buoy_id: Optional[str]
    detected_at: str = field(default_factory=_now)
    drift_type: str = ""
    drift_offset: float = 0.0
    baseline_value: float = 0.0
    drifted_value: float = 0.0
    confidence: float = 0.0
    description: str = ""
    isolated: bool = True

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class WarningRecord:
    """淤积异常预警记录。"""

    warning_id: str
    buoy_log_id: str
    buoy_id: Optional[str]
    timestamp: str
    warning_level: WarningLevel
    source: DataSource
    process_status: ProcessStatus = ProcessStatus.WARNING_RAISED
    water_depth: Optional[float] = None
    sediment_thickness: Optional[float] = None
    sediment_rate: Optional[float] = None
    threshold_value: float = 0.0
    actual_value: float = 0.0
    description: str = ""
    created_at: str = field(default_factory=_now)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["warning_level"] = self.warning_level.value
        d["source"] = self.source.value
        d["process_status"] = self.process_status.value
        return d


@dataclass
class ManualNote:
    """人工备注 —— 受幂等导入保护，不被覆盖。"""

    note_id: str
    target_type: str
    target_id: str
    content: str
    author: str = ""
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)
    protected: bool = True

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ChangeLog:
    """变更日志 —— 人工改口径时必记：旧值、新判断、原因。"""

    change_id: str
    target_type: str
    target_id: str
    field_name: str
    old_value: Optional[Any]
    new_value: Optional[Any]
    reason: str
    operator: str = ""
    changed_at: str = field(default_factory=_now)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class AlignedPair:
    """时序对齐对：传感器 + 晚到的船上记录。"""

    pair_id: str
    sensor_log_id: str
    ship_log_id: str
    buoy_id: str
    aligned_on: str
    sensor_ts: str
    ship_ts: str
    time_gap_seconds: float
    merged_log_id: str
    created_at: str = field(default_factory=_now)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
