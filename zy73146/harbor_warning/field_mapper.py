"""字段名兼容映射层。

复核人交来的浮标日志字段名可能前后不一，这里负责把各种命名
规范成统一的 BuoyLog 字段。无论输入如何，必须保住：
  - source（来源）
  - process_status（处理状态）
  - timestamp（时间戳）
  - log_id（日志标识）
其余字段尽量兼容。原始字段保存在 raw_fields 中可溯源。
"""

from __future__ import annotations

import re
from typing import Any, Optional

from .models import BuoyLog, DataSource, ProcessStatus


TIMESTAMP_KEYS = [
    "timestamp", "time", "ts", "datetime", "date_time",
    "record_time", "recorded_at", "observed_at", "采集时间", "时间",
]
SOURCE_KEYS = [
    "source", "data_source", "origin", "from_where", "来源", "数据来源",
]
LOG_ID_KEYS = [
    "log_id", "id", "record_id", "uuid", "日志编号", "编号",
]
WATER_DEPTH_KEYS = [
    "water_depth", "depth", "wd", "水深", "水深值",
]
SEDIMENT_KEYS = [
    "sediment_thickness", "sediment", "thickness", "st",
    "淤积厚度", "厚度", "泥沙厚度",
]
FLOW_KEYS = [
    "flow_velocity", "flow", "velocity", "fv", "流速", "水流速度",
]
TEMPERATURE_KEYS = [
    "temperature", "temp", "t", "水温", "温度",
]
BUOY_ID_KEYS = [
    "buoy_id", "buoy", "buoy_code", "浮标编号", "浮标ID", "浮标id",
]
SHIP_ID_KEYS = [
    "ship_id", "ship", "vessel_id", "vessel", "船舶编号", "船号",
    "船舶ID",
]


SOURCE_ALIASES = {
    "sensor": DataSource.SENSOR,
    "sensors": DataSource.SENSOR,
    "buoy_sensor": DataSource.SENSOR,
    "浮标": DataSource.SENSOR,
    "传感器": DataSource.SENSOR,
    "自动": DataSource.SENSOR,
    "ship": DataSource.SHIP_LOG,
    "ship_log": DataSource.SHIP_LOG,
    "vessel": DataSource.SHIP_LOG,
    "vessel_log": DataSource.SHIP_LOG,
    "船舶": DataSource.SHIP_LOG,
    "船舶日志": DataSource.SHIP_LOG,
    "人工": DataSource.MANUAL,
    "manual": DataSource.MANUAL,
    "对齐": DataSource.ALIGNED,
    "aligned": DataSource.ALIGNED,
}


STATUS_ALIASES = {
    "pending": ProcessStatus.PENDING,
    "待处理": ProcessStatus.PENDING,
    "aligned": ProcessStatus.ALIGNED,
    "已对齐": ProcessStatus.ALIGNED,
    "drift_detected": ProcessStatus.DRIFT_DETECTED,
    "检测到漂移": ProcessStatus.DRIFT_DETECTED,
    "drift_isolated": ProcessStatus.DRIFT_ISOLATED,
    "漂移已隔离": ProcessStatus.DRIFT_ISOLATED,
    "warning_raised": ProcessStatus.WARNING_RAISED,
    "已预警": ProcessStatus.WARNING_RAISED,
    "manual_confirmed": ProcessStatus.MANUAL_CONFIRMED,
    "人工确认": ProcessStatus.MANUAL_CONFIRMED,
    "manual_revised": ProcessStatus.MANUAL_REVISED,
    "人工修正": ProcessStatus.MANUAL_REVISED,
    "completed": ProcessStatus.COMPLETED,
    "完成": ProcessStatus.COMPLETED,
    "failed": ProcessStatus.FAILED,
    "失败": ProcessStatus.FAILED,
}


class FieldMapError(ValueError):
    """字段映射失败。提示文案稳定，供复核人脚本识别。"""

    CODE = "FIELD_MAP_ERROR"

    def __init__(self, missing: list[str], raw: dict[str, Any]):
        self.missing = missing
        self.raw_keys = list(raw.keys())
        msg = (
            f"[{FieldMapError.CODE}] 浮标日志缺少必填字段: {', '.join(missing)}。"
            f" 原始字段: {', '.join(self.raw_keys) or '(空)'}"
        )
        super().__init__(msg)


def _first_match(raw: dict[str, Any], keys: list[str]) -> Optional[Any]:
    for k in keys:
        if k in raw and raw[k] is not None and raw[k] != "":
            return raw[k]
    lower_map = {str(rk).lower(): rv for rk, rv in raw.items()}
    for k in keys:
        kl = k.lower()
        if kl in lower_map and lower_map[kl] not in (None, ""):
            return lower_map[kl]
    return None


def _coerce_float(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        s = re.sub(r"[^\d.eE+\-]", "", str(v))
        return float(s) if s else None
    except (TypeError, ValueError):
        return None


def _coerce_str(v: Any) -> Optional[str]:
    if v is None or v == "":
        return None
    return str(v).strip()


def _coerce_source(v: Any) -> DataSource:
    if v is None:
        return DataSource.SENSOR
    if isinstance(v, DataSource):
        return v
    key = str(v).strip().lower()
    if key in SOURCE_ALIASES:
        return SOURCE_ALIASES[key]
    for alias, mapped in SOURCE_ALIASES.items():
        if alias in key:
            return mapped
    return DataSource.SENSOR


def _coerce_status(v: Any) -> ProcessStatus:
    if v is None:
        return ProcessStatus.PENDING
    if isinstance(v, ProcessStatus):
        return v
    key = str(v).strip().lower()
    if key in STATUS_ALIASES:
        return STATUS_ALIASES[key]
    return ProcessStatus.PENDING


def normalize_timestamp(v: Any) -> str:
    """把各种时间表达规范化为 ISO 格式字符串。"""
    if v is None or v == "":
        return ""
    if isinstance(v, (int, float)):
        try:
            from datetime import datetime
            return datetime.fromtimestamp(float(v)).isoformat(timespec="seconds")
        except (TypeError, ValueError, OSError):
            return str(v)
    s = str(v).strip()
    from datetime import datetime
    fmts = [
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%Y%m%d%H%M%S",
    ]
    for f in fmts:
        try:
            return datetime.strptime(s, f).isoformat(timespec="seconds")
        except ValueError:
            continue
    if re.match(r"^\d{4}-\d{2}-\d{2}", s):
        return s
    return s


def map_buoy_log(raw: dict[str, Any]) -> BuoyLog:
    """把任意命名的原始字段映射成 BuoyLog。

    必填：log_id、timestamp、source（兜底默认值）。
    缺失必填抛出 FieldMapError，提示文案稳定。
    """
    log_id = _coerce_str(_first_match(raw, LOG_ID_KEYS))
    timestamp = normalize_timestamp(_first_match(raw, TIMESTAMP_KEYS))
    source = _coerce_source(_first_match(raw, SOURCE_KEYS))
    status = _coerce_status(_first_match(raw, ["process_status", "status", "状态"]))

    missing: list[str] = []
    if not log_id:
        missing.append("log_id / 编号")
    if not timestamp:
        missing.append("timestamp / 时间")
    if missing:
        raise FieldMapError(missing, raw)

    assert log_id is not None

    water_depth = _coerce_float(_first_match(raw, WATER_DEPTH_KEYS))
    sediment = _coerce_float(_first_match(raw, SEDIMENT_KEYS))
    flow = _coerce_float(_first_match(raw, FLOW_KEYS))
    temp = _coerce_float(_first_match(raw, TEMPERATURE_KEYS))
    buoy_id = _coerce_str(_first_match(raw, BUOY_ID_KEYS))
    ship_id = _coerce_str(_first_match(raw, SHIP_ID_KEYS))

    return BuoyLog(
        log_id=log_id,
        timestamp=timestamp,
        source=source,
        process_status=status,
        water_depth=water_depth,
        sediment_thickness=sediment,
        flow_velocity=flow,
        temperature=temp,
        buoy_id=buoy_id,
        ship_id=ship_id,
        raw_fields=dict(raw),
    )
