from collections import Counter
from typing import Any

from models import (
    AuditAction,
    PathBucket,
    VisitorTrajectory,
)


class BucketError(Exception):
    def __init__(self, message: str, diagnostics: dict[str, Any]):
        super().__init__(message)
        self.diagnostics = diagnostics


def deduplicate_trajectories(
    trajectories: list[VisitorTrajectory],
    actor: str = "bucket_engine",
) -> tuple[list[VisitorTrajectory], dict[str, Any]]:
    seen: dict[str, VisitorTrajectory] = {}
    duplicates: list[dict[str, Any]] = []

    for t in trajectories:
        vid = t.visitor_id
        if vid in seen:
            duplicates.append({
                "visitor_id": vid,
                "existing_trajectory": seen[vid].trajectory_id,
                "duplicate_trajectory": t.trajectory_id,
                "action": "kept_first",
            })
            seen[vid].audit.record(
                AuditAction.DEDUPLICATED,
                actor,
                f"重复访客 {vid}: 保留轨迹 {seen[vid].trajectory_id}, 忽略 {t.trajectory_id}",
            )
        else:
            seen[vid] = t

    deduped = list(seen.values())
    diag = {
        "step": "deduplication",
        "original_count": len(trajectories),
        "deduplicated_count": len(deduped),
        "duplicates_found": len(duplicates),
        "duplicate_details": duplicates,
    }

    if duplicates:
        diag["warning"] = (
            f"发现 {len(duplicates)} 条重复访客轨迹，已保留每个访客的首条轨迹"
        )

    return deduped, diag


def bucket_trajectories(
    trajectories: list[VisitorTrajectory],
    deduplicate: bool = True,
    actor: str = "bucket_engine",
) -> tuple[list[PathBucket], dict[str, Any]]:
    if not trajectories:
        raise BucketError(
            "无轨迹数据可分桶",
            {
                "step": "path_bucketing",
                "reason": "trajectories_empty",
                "suggestion": "请先录入访客轨迹数据",
            },
        )

    dedup_diag: dict[str, Any] = {}
    if deduplicate:
        trajectories, dedup_diag = deduplicate_trajectories(trajectories, actor)

    pattern_map: dict[tuple[str, ...], list[str]] = {}
    for t in trajectories:
        pattern = tuple(t.path_sequence)
        if pattern not in pattern_map:
            pattern_map[pattern] = []
        pattern_map[pattern].append(t.trajectory_id)

    total = len(trajectories)
    buckets: list[PathBucket] = []

    for i, (pattern, tids) in enumerate(
        sorted(pattern_map.items(), key=lambda x: -len(x[1]))
    ):
        count = len(tids)
        prob = count / total if total > 0 else 0.0
        bucket = PathBucket(
            bucket_id=f"bucket_{i}",
            path_pattern=pattern,
            trajectory_ids=tids,
            count=count,
            probability=prob,
        )
        bucket.audit.record(
            AuditAction.BUCKETED,
            actor,
            f"分桶完成: 路径={'->'.join(pattern)}, 数量={count}, 概率={prob:.4f}",
        )
        buckets.append(bucket)

    intermediate = {
        "deduplication": dedup_diag if deduplicate else None,
        "total_trajectories": total,
        "unique_patterns": len(buckets),
        "top3_patterns": [
            {
                "pattern": "->".join(b.path_pattern),
                "count": b.count,
                "probability": b.probability,
            }
            for b in buckets[:3]
        ],
        "bucket_distribution": [
            {"bucket_id": b.bucket_id, "count": b.count, "probability": b.probability}
            for b in buckets
        ],
    }

    return buckets, intermediate
