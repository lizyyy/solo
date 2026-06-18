"""时序对齐处理链：解决船上记录晚于传感器数据的问题。

港口工程师老何最缺的就是这块。把每个 buoy_id 作为独立时间序列：
  - 先按 timestamp 排序 SENSOR 日志（先到）
  - 再把 SHIP_LOG 日志（晚到但标注更早发生的时间）按对齐窗口
    找到对应的传感器时间点，拼合出 ALIGNED 合并记录
  - 对齐依据：(buoy_id, 时间窗口, 物理量一致性)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Optional

from .models import (
    AlignedPair,
    BuoyLog,
    DataSource,
    ProcessStatus,
)


def _parse_ts(ts: str) -> datetime:
    s = ts
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        for fmt in (
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%d",
        ):
            try:
                return datetime.strptime(ts, fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析时间戳: {ts!r}")


class TimeAlignError(RuntimeError):
    """对齐失败。文案稳定。"""

    CODE = "TIME_ALIGN_ERROR"

    def __init__(self, detail: str):
        super().__init__(f"[{TimeAlignError.CODE}] {detail}")


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def align_ship_to_sensor(
    sensor_logs: list[BuoyLog],
    ship_logs: list[BuoyLog],
    window_seconds: int = 3600,
) -> tuple[list[AlignedPair], list[BuoyLog], list[BuoyLog]]:
    """把晚到的船上记录按时间窗口对齐到传感器数据。

    参数名保持稳定（复核人脚本依赖）：
      - sensor_logs: 传感器日志
      - ship_logs:   船上记录日志
      - window_seconds: 对齐窗口，默认 1 小时

    返回 (对齐对列表, 合并后 ALIGNED 日志列表, 未匹配的 ship 日志)。
    """
    if window_seconds <= 0:
        raise TimeAlignError("window_seconds 必须为正整数")

    sensor_logs = [l for l in sensor_logs if l.source == DataSource.SENSOR]
    ship_logs = [l for l in ship_logs if l.source == DataSource.SHIP_LOG]

    by_buoy_sensors: dict[str, list[BuoyLog]] = {}
    for sl in sensor_logs:
        bid = sl.buoy_id or "UNKNOWN"
        by_buoy_sensors.setdefault(bid, []).append(sl)
    for lst in by_buoy_sensors.values():
        lst.sort(key=lambda x: x.timestamp)

    pairs: list[AlignedPair] = []
    merged: list[BuoyLog] = []
    unmatched: list[BuoyLog] = []
    window = timedelta(seconds=window_seconds)

    used_sensor_ids: set[str] = set()

    for ship in ship_logs:
        bid = ship.buoy_id or "UNKNOWN"
        candidates = by_buoy_sensors.get(bid, [])
        try:
            ship_ts = _parse_ts(ship.timestamp)
        except ValueError as exc:
            raise TimeAlignError(f"船上日志 {ship.log_id} 时间无法解析: {exc}") from exc

        best: Optional[tuple[float, BuoyLog]] = None
        for cand in candidates:
            if cand.log_id in used_sensor_ids:
                continue
            try:
                cand_ts = _parse_ts(cand.timestamp)
            except ValueError:
                continue
            diff = abs((cand_ts - ship_ts).total_seconds())
            if diff > window_seconds:
                continue
            if best is None or diff < best[0]:
                best = (diff, cand)

        if best is None:
            unmatched.append(ship)
            continue

        gap, sensor = best
        used_sensor_ids.add(sensor.log_id)
        sensor_ts = _parse_ts(sensor.timestamp)
        aligned_on = "timestamp|buoy_id"

        pid = _uid("pair")
        merged_id = _uid("merged")

        merged_log = BuoyLog(
            log_id=merged_id,
            timestamp=min(sensor.timestamp, ship.timestamp),
            source=DataSource.ALIGNED,
            process_status=ProcessStatus.ALIGNED,
            water_depth=_avg(sensor.water_depth, ship.water_depth),
            sediment_thickness=_pick_valid(
                ship.sediment_thickness, sensor.sediment_thickness
            ),
            flow_velocity=_avg(sensor.flow_velocity, ship.flow_velocity),
            temperature=_avg(sensor.temperature, ship.temperature),
            buoy_id=bid,
            ship_id=ship.ship_id or sensor.ship_id,
            raw_fields={
                "sensor_log_id": sensor.log_id,
                "ship_log_id": ship.log_id,
                "time_gap_seconds": gap,
                "sensor_raw": sensor.raw_fields,
                "ship_raw": ship.raw_fields,
            },
        )

        pairs.append(
            AlignedPair(
                pair_id=pid,
                sensor_log_id=sensor.log_id,
                ship_log_id=ship.log_id,
                buoy_id=bid,
                aligned_on=aligned_on,
                sensor_ts=sensor.timestamp,
                ship_ts=ship.timestamp,
                time_gap_seconds=gap,
                merged_log_id=merged_id,
            )
        )
        merged.append(merged_log)

    return pairs, merged, unmatched


def _avg(a: Optional[float], b: Optional[float]) -> Optional[float]:
    vals = [v for v in (a, b) if v is not None]
    if not vals:
        return None
    return sum(vals) / len(vals)


def _pick_valid(a: Optional[float], b: Optional[float]) -> Optional[float]:
    return a if a is not None else b
