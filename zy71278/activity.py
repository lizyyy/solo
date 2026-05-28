import math
from collections import Counter
from typing import Any, Optional

from models import (
    ActivityComparison,
    ActivityLabel,
    AuditAction,
    VisitorTrajectory,
)


class ActivityError(Exception):
    def __init__(self, message: str, diagnostics: dict[str, Any]):
        super().__init__(message)
        self.diagnostics = diagnostics


def _compute_group_entropy(trajectories: list[VisitorTrajectory]) -> tuple[float, float, Optional[str]]:
    if not trajectories:
        return 0.0, 0.0, None

    counter: Counter[str] = Counter()
    for t in trajectories:
        key = "->".join(t.path_sequence)
        counter[key] += 1

    total = len(trajectories)
    probabilities = {k: v / total for k, v in counter.items()}
    raw = -sum(p * math.log2(p) for p in probabilities.values() if p > 0)

    unique = len(counter)
    max_e = math.log2(unique) if unique > 1 else 0.0
    norm = raw / max_e if max_e > 0 else 0.0

    dominant = counter.most_common(1)[0][0] if counter else None

    return raw, norm, dominant


def compare_activities(
    trajectories: list[VisitorTrajectory],
    activities: list[ActivityLabel],
    baseline_entropy: Optional[float] = None,
    actor: str = "activity_engine",
) -> tuple[list[ActivityComparison], dict[str, Any]]:
    if not trajectories:
        raise ActivityError(
            "无轨迹数据，无法进行活动对比",
            {
                "step": "activity_comparison",
                "reason": "trajectories_empty",
                "suggestion": "请先录入访客轨迹数据",
            },
        )

    if not activities:
        raise ActivityError(
            "无活动标签数据，无法进行活动对比",
            {
                "step": "activity_comparison",
                "reason": "activities_empty",
                "suggestion": "请先定义活动标签",
            },
        )

    activity_map: dict[str, ActivityLabel] = {a.label_id: a for a in activities}

    label_trajectories: dict[str, list[VisitorTrajectory]] = {}
    unlabeled: list[VisitorTrajectory] = []

    for t in trajectories:
        matched = False
        for label in t.activity_labels:
            if label in activity_map:
                if label not in label_trajectories:
                    label_trajectories[label] = []
                label_trajectories[label].append(t)
                matched = True
        if not matched:
            unlabeled.append(t)

    comparisons: list[ActivityComparison] = []
    interference_details: list[dict[str, Any]] = []

    for label_id, group in label_trajectories.items():
        act = activity_map[label_id]
        raw_e, norm_e, dominant = _compute_group_entropy(group)
        act_name = act.name

        interference = False
        reason = ""

        if baseline_entropy is not None:
            delta = abs(norm_e - baseline_entropy)
            if delta > 0.3:
                interference = True
                reason = (
                    f"活动「{act_name}」期间归一化熵值 {norm_e:.4f} "
                    f"与基线 {baseline_entropy:.4f} 偏差 {delta:.4f}，"
                    f"超过0.3阈值，可能存在活动干扰导致动线异常集中或分散"
                )
            elif delta > 0.15:
                reason = (
                    f"活动「{act_name}」期间熵值偏差 {delta:.4f}，"
                    f"存在轻度干扰可能，建议持续观察"
                )
            else:
                reason = f"活动「{act_name}」对动线分布无明显干扰"
        else:
            reason = f"活动「{act_name}」无基线对比，仅记录熵值"

        if interference:
            interference_details.append({
                "activity": act_name,
                "label_id": label_id,
                "normalized_entropy": norm_e,
                "baseline_entropy": baseline_entropy,
                "deviation": abs(norm_e - baseline_entropy) if baseline_entropy else None,
                "affected_zones": act.affected_zones,
            })

        comp = ActivityComparison(
            label=act_name,
            entropy=raw_e,
            normalized_entropy=norm_e,
            trajectory_count=len(group),
            dominant_path=dominant,
            interference_flag=interference,
            interference_reason=reason,
        )
        comp.audit.record(
            AuditAction.ACTIVITY_COMPARED,
            actor,
            f"活动对比: {act_name}, H_norm={norm_e:.4f}, 干扰={'是' if interference else '否'}",
        )
        comparisons.append(comp)

    intermediate = {
        "activity_groups": {
            label_id: len(group) for label_id, group in label_trajectories.items()
        },
        "unlabeled_count": len(unlabeled),
        "interference_count": len(interference_details),
        "interference_details": interference_details,
        "baseline_entropy": baseline_entropy,
        "per_activity_entropy": [
            {
                "activity": c.label,
                "raw_entropy": c.entropy,
                "normalized_entropy": c.normalized_entropy,
                "trajectory_count": c.trajectory_count,
                "dominant_path": c.dominant_path,
                "interference": c.interference_flag,
            }
            for c in comparisons
        ],
    }

    return comparisons, intermediate
