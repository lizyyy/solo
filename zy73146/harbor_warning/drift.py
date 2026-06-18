"""传感器漂移检测与隔离。

复核人最担心的：漂移被揉进正常结果里。
策略：
  1. 对同一 buoy_id，按时间滑动窗口算统计基线；
  2. 若单点偏离 > drift_threshold * sigma，标记为漂移；
  3. 漂移记录状态置为 DRIFT_ISOLATED，写入 DriftMark，
     不参与预警计算，保证正常结果干净。
"""

from __future__ import annotations

import statistics
import uuid
from typing import Any, Optional

from .models import (
    BuoyLog,
    DataSource,
    DriftMark,
    ProcessStatus,
)


class DriftDetectError(RuntimeError):
    CODE = "DRIFT_DETECT_ERROR"

    def __init__(self, detail: str):
        super().__init__(f"[{DriftDetectError.CODE}] {detail}")


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def _group_by_buoy(logs: list[BuoyLog]) -> dict[str, list[BuoyLog]]:
    out: dict[str, list[BuoyLog]] = {}
    for l in logs:
        if l.process_status in (ProcessStatus.DRIFT_DETECTED, ProcessStatus.DRIFT_ISOLATED):
            continue
        bid = l.buoy_id or "UNKNOWN"
        out.setdefault(bid, []).append(l)
    for lst in out.values():
        lst.sort(key=lambda x: x.timestamp)
    return out


def _window_values(
    series: list[BuoyLog],
    field: str,
    idx: int,
    window: int,
) -> list[float]:
    vals: list[float] = []
    start = max(0, idx - window)
    end = min(len(series), idx + window + 1)
    for i in range(start, end):
        if i == idx:
            continue
        v = getattr(series[i], field, None)
        if isinstance(v, (int, float)):
            vals.append(float(v))
    return vals


def detect_and_isolate_drifts(
    logs: list[BuoyLog],
    drift_threshold: float = 3.0,
    min_window: int = 5,
    fields: Optional[list[str]] = None,
) -> tuple[list[DriftMark], list[BuoyLog]]:
    """检测并隔离漂移。

    参数名稳定：
      - drift_threshold: 偏离标准差倍数，默认 3σ
      - min_window: 最小窗口点数
      - fields: 检查的数值字段，默认 water_depth / sediment_thickness / temperature

    返回 (漂移标记列表, 被隔离的日志副本列表 —— process_status 已改)。
    """
    if drift_threshold <= 0:
        raise DriftDetectError("drift_threshold 必须 > 0")
    if min_window < 2:
        raise DriftDetectError("min_window 必须 >= 2")

    fields = fields or ["water_depth", "sediment_thickness", "temperature"]
    groups = _group_by_buoy(logs)

    marks: list[DriftMark] = []
    isolated_ids: set[str] = set()
    isolated_logs: list[BuoyLog] = []

    for bid, series in groups.items():
        for idx, item in enumerate(series):
            for field in fields:
                current = getattr(item, field, None)
                if not isinstance(current, (int, float)):
                    continue
                vals = _window_values(series, field, idx, min_window)
                if len(vals) < max(3, min_window - 1):
                    continue
                baseline = statistics.mean(vals)
                try:
                    sigma = statistics.pstdev(vals)
                except statistics.StatisticsError:
                    sigma = 0.0
                if sigma == 0:
                    continue
                deviation = abs(float(current) - baseline) / sigma
                if deviation >= drift_threshold:
                    mark = DriftMark(
                        mark_id=_uid("drift"),
                        buoy_log_id=item.log_id,
                        buoy_id=bid,
                        drift_type=f"field={field};z_score_outlier",
                        drift_offset=float(current) - baseline,
                        baseline_value=baseline,
                        drifted_value=float(current),
                        confidence=min(1.0, deviation / (drift_threshold * 2)),
                        description=(
                            f"浮标 {bid} 在 {item.timestamp} 的 {field}="
                            f"{current} 偏离基线 {baseline:.3f} "
                            f"{drift_offset_brief(float(current) - baseline)}，"
                            f"Z={deviation:.2f}，已隔离，不参与预警计算"
                        ),
                        isolated=True,
                    )
                    marks.append(mark)
                    if item.log_id not in isolated_ids:
                        isolated_ids.add(item.log_id)
                        isolated_logs.append(
                            BuoyLog(
                                log_id=item.log_id,
                                timestamp=item.timestamp,
                                source=item.source,
                                process_status=ProcessStatus.DRIFT_ISOLATED,
                                water_depth=item.water_depth,
                                sediment_thickness=item.sediment_thickness,
                                flow_velocity=item.flow_velocity,
                                temperature=item.temperature,
                                buoy_id=item.buoy_id,
                                ship_id=item.ship_id,
                                raw_fields=item.raw_fields,
                                fingerprint=item.fingerprint,
                                imported_at=item.imported_at,
                            )
                        )
                    break
    return marks, isolated_logs


def drift_offset_brief(offset: float) -> str:
    sign = "+" if offset >= 0 else ""
    return f"{sign}{offset:.3f}"
