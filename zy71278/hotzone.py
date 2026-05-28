from collections import defaultdict
from typing import Any

from models import (
    AuditAction,
    DwellRecord,
    HotZone,
    VisitorTrajectory,
    Zone,
)


class HotZoneError(Exception):
    def __init__(self, message: str, diagnostics: dict[str, Any]):
        super().__init__(message)
        self.diagnostics = diagnostics


DEFAULT_NOISE_THRESHOLD_SECONDS = 30.0


def filter_noise_dwells(
    dwells: list[DwellRecord],
    threshold_seconds: float = DEFAULT_NOISE_THRESHOLD_SECONDS,
    actor: str = "hotzone_engine",
) -> tuple[list[DwellRecord], dict[str, Any]]:
    kept: list[DwellRecord] = []
    filtered: list[dict[str, Any]] = []

    for d in dwells:
        if d.duration_seconds < threshold_seconds:
            filtered.append({
                "visitor_id": d.visitor_id,
                "zone_id": d.zone_id,
                "duration_seconds": d.duration_seconds,
                "reason": f"停留时长 {d.duration_seconds}s 低于阈值 {threshold_seconds}s",
            })
            d.audit.record(
                AuditAction.NOISE_FILTERED,
                actor,
                f"短暂停留噪声: 访客 {d.visitor_id} 在区域 {d.zone_id} 仅停留 {d.duration_seconds}s",
            )
        else:
            kept.append(d)

    diag = {
        "step": "noise_filtering",
        "threshold_seconds": threshold_seconds,
        "original_count": len(dwells),
        "kept_count": len(kept),
        "filtered_count": len(filtered),
        "filtered_details": filtered,
    }

    if filtered:
        diag["warning"] = (
            f"已过滤 {len(filtered)} 条短暂停留记录 (阈值 {threshold_seconds}s)"
        )

    return kept, diag


def compute_hot_zones(
    trajectories: list[VisitorTrajectory],
    zones: list[Zone],
    noise_threshold_seconds: float = DEFAULT_NOISE_THRESHOLD_SECONDS,
    actor: str = "hotzone_engine",
) -> tuple[list[HotZone], dict[str, Any]]:
    if not trajectories:
        raise HotZoneError(
            "无轨迹数据，无法识别热区",
            {
                "step": "hotzone_identification",
                "reason": "trajectories_empty",
                "suggestion": "请先录入访客轨迹数据",
            },
        )

    zone_map: dict[str, Zone] = {z.zone_id: z for z in zones}

    all_dwells: list[DwellRecord] = []
    for t in trajectories:
        all_dwells.extend(t.dwells)

    if not all_dwells:
        hot_zones = []
        for z in zones:
            hot_zones.append(HotZone(
                zone_id=z.zone_id,
                zone_name=z.name,
                total_dwell_seconds=0.0,
                visit_count=0,
                avg_dwell_seconds=0.0,
                heat_rank=0,
                interpretation="无停留数据，无法评估热度",
            ))
        intermediate = {
            "noise_filtering": {"step": "noise_filtering", "kept_count": 0, "filtered_count": 0},
            "zone_summary": [],
            "warning": "轨迹中无停留记录，热区数据为空",
        }
        return hot_zones, intermediate

    filtered_dwells, noise_diag = filter_noise_dwells(
        all_dwells, noise_threshold_seconds, actor
    )

    if not filtered_dwells:
        raise HotZoneError(
            f"所有停留记录均低于噪声阈值 {noise_threshold_seconds}s，无有效数据",
            {
                "step": "hotzone_identification",
                "reason": "all_filtered_as_noise",
                "suggestion": "考虑降低噪声阈值或确认停留时长数据的正确性",
                "noise_threshold": noise_threshold_seconds,
                "total_dwells": len(all_dwells),
                **noise_diag,
            },
        )

    zone_dwell: dict[str, list[DwellRecord]] = defaultdict(list)
    for d in filtered_dwells:
        zone_dwell[d.zone_id].append(d)

    hot_zones: list[HotZone] = []
    for zone_id, dwell_list in zone_dwell.items():
        total = sum(d.duration_seconds for d in dwell_list)
        count = len(dwell_list)
        avg = total / count if count > 0 else 0.0
        zone_name = zone_map[zone_id].name if zone_id in zone_map else zone_id

        if total > 3600:
            interpretation = "极高热度：该区域停留总时长超过1小时，可能存在拥堵或内容吸引力极强"
        elif total > 1800:
            interpretation = "高热度：该区域停留总时长超过30分钟，观众关注度较高"
        elif total > 600:
            interpretation = "中等热度：该区域有一定停留，属于正常观展范围"
        else:
            interpretation = "低热度：该区域停留较少，观众快速通过"

        hot_zones.append(HotZone(
            zone_id=zone_id,
            zone_name=zone_name,
            total_dwell_seconds=total,
            visit_count=count,
            avg_dwell_seconds=avg,
            heat_rank=0,
            interpretation=interpretation,
        ))

    hot_zones.sort(key=lambda h: h.total_dwell_seconds, reverse=True)
    for rank, hz in enumerate(hot_zones, 1):
        hz.heat_rank = rank
        hz.audit.record(
            AuditAction.HOTZONE_IDENTIFIED,
            actor,
            f"热区识别: {hz.zone_name} 排名#{rank}, 总停留{hz.total_dwell_seconds:.0f}s, 均停留{hz.avg_dwell_seconds:.1f}s",
        )

    intermediate = {
        "noise_filtering": noise_diag,
        "zone_summary": [
            {
                "zone_id": hz.zone_id,
                "zone_name": hz.zone_name,
                "total_dwell_seconds": hz.total_dwell_seconds,
                "visit_count": hz.visit_count,
                "avg_dwell_seconds": hz.avg_dwell_seconds,
                "heat_rank": hz.heat_rank,
            }
            for hz in hot_zones
        ],
    }

    return hot_zones, intermediate
