"""历史时间线追溯。

港口工程师老何接班流程里必须跑这步：从一条浮标日志追到完整时间线，
讲清楚每个结果是怎么来的。
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Any, Optional

from .models import BuoyLog, DataSource, WarningLevel
from .storage import HarborStorage


def _evt(ts: str, kind: str, detail: dict[str, Any]) -> dict[str, Any]:
    return {"timestamp": ts, "kind": kind, "detail": detail}


def build_timeline(
    storage: HarborStorage,
    buoy_id: Optional[str] = None,
    warning_id: Optional[str] = None,
    log_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    """生成可追溯的时间线，按时间排序。

    参数名保持稳定（三者至少提供其一）：
      - buoy_id:    某个浮标的全量时间线
      - warning_id: 以某条预警为中心追溯
      - log_id:     以某条浮标日志为起点

    返回事件列表，每项: {timestamp, kind, detail}，老何按接班流程过一遍即可。
    """
    if not any([buoy_id, warning_id, log_id]):
        raise ValueError("build_timeline 至少提供 buoy_id / warning_id / log_id 其一")

    target_buoy_ids: set[str] = set()
    target_log_ids: set[str] = set()
    target_warning_ids: set[str] = set()

    if log_id:
        log = storage.get_buoy_log(log_id)
        if log and log.buoy_id:
            target_buoy_ids.add(log.buoy_id)
        target_log_ids.add(log_id)

    if warning_id:
        target_warning_ids.add(warning_id)
        for w in storage.list_warnings():
            if w.warning_id == warning_id:
                if w.buoy_id:
                    target_buoy_ids.add(w.buoy_id)
                target_log_ids.add(w.buoy_log_id)

    if buoy_id:
        target_buoy_ids.add(buoy_id)

    events: list[dict[str, Any]] = []

    # 1. 浮标日志
    for log in storage.list_buoy_logs():
        if log.buoy_id not in target_buoy_ids and log.log_id not in target_log_ids:
            continue
        detail = {
            "log_id": log.log_id,
            "buoy_id": log.buoy_id,
            "ship_id": log.ship_id,
            "source": log.source.value,
            "process_status": log.process_status.value,
            "water_depth": log.water_depth,
            "sediment_thickness": log.sediment_thickness,
            "flow_velocity": log.flow_velocity,
            "temperature": log.temperature,
            "fingerprint": log.fingerprint,
        }
        events.append(_evt(log.timestamp, f"log:{log.source.value}", detail))

    # 2. 对齐关系
    for p in storage.list_aligned_pairs():
        if p.buoy_id not in target_buoy_ids:
            continue
        detail = {
            "pair_id": p.pair_id,
            "sensor_log_id": p.sensor_log_id,
            "ship_log_id": p.ship_log_id,
            "aligned_on": p.aligned_on,
            "sensor_ts": p.sensor_ts,
            "ship_ts": p.ship_ts,
            "time_gap_seconds": p.time_gap_seconds,
            "merged_log_id": p.merged_log_id,
        }
        ts = min(p.sensor_ts, p.ship_ts)
        events.append(_evt(ts, "aligned_pair", detail))

    # 3. 漂移标记
    for d in storage.list_drift_marks():
        if d.buoy_id not in target_buoy_ids and d.buoy_log_id not in target_log_ids:
            continue
        detail = {
            "mark_id": d.mark_id,
            "buoy_log_id": d.buoy_log_id,
            "drift_type": d.drift_type,
            "drift_offset": d.drift_offset,
            "baseline_value": d.baseline_value,
            "drifted_value": d.drifted_value,
            "confidence": d.confidence,
            "description": d.description,
        }
        events.append(_evt(d.detected_at, "drift_mark", detail))

    # 4. 预警记录
    for w in storage.list_warnings():
        if w.warning_id not in target_warning_ids:
            if w.buoy_id not in target_buoy_ids and w.buoy_log_id not in target_log_ids:
                continue
        detail = {
            "warning_id": w.warning_id,
            "buoy_log_id": w.buoy_log_id,
            "buoy_id": w.buoy_id,
            "warning_level": w.warning_level.value,
            "source": w.source.value,
            "process_status": w.process_status.value,
            "sediment_thickness": w.sediment_thickness,
            "threshold_value": w.threshold_value,
            "actual_value": w.actual_value,
            "description": w.description,
        }
        events.append(_evt(w.timestamp, f"warning:{w.warning_level.value}", detail))

        notes = storage.list_notes(target_type="warning", target_id=w.warning_id)
        for n in notes:
            events.append(
                _evt(
                    n.created_at,
                    "manual_note",
                    {
                        "note_id": n.note_id,
                        "target_warning": w.warning_id,
                        "author": n.author,
                        "content": n.content,
                        "protected": n.protected,
                    },
                )
            )

        changes = storage.list_changes(target_type="warning", target_id=w.warning_id)
        for c in changes:
            events.append(
                _evt(
                    c.changed_at,
                    "manual_revise",
                    {
                        "change_id": c.change_id,
                        "warning_id": w.warning_id,
                        "field": c.field_name,
                        "old_value": c.old_value,
                        "new_value": c.new_value,
                        "reason": c.reason,
                        "operator": c.operator,
                    },
                )
            )

    events.sort(key=lambda e: e["timestamp"])
    return events


def format_timeline_for_handover(events: list[dict[str, Any]]) -> str:
    """把时间线格式化成老何接班时能照着念的版本。"""
    lines: list[str] = []
    lines.append("=== 港湾淤积异常预警 · 接班时间线 ===")
    lines.append(f"共 {len(events)} 条事件\n")
    for i, ev in enumerate(events, 1):
        ts = ev["timestamp"]
        kind = ev["kind"]
        d = ev["detail"]
        lines.append(f"[{i}] {ts}  {kind}")
        for k, v in d.items():
            if isinstance(v, float):
                lines.append(f"      - {k}: {v:.4g}")
            else:
                lines.append(f"      - {k}: {v}")
        lines.append("")
    return "\n".join(lines)
