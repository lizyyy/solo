import math
from collections import Counter
from typing import Any

from models import (
    AuditAction,
    EntropyResult,
    PathBucket,
    VisitorTrajectory,
)


class EntropyError(Exception):
    def __init__(self, message: str, diagnostics: dict[str, Any]):
        super().__init__(message)
        self.diagnostics = diagnostics


def compute_path_distribution(trajectories: list[VisitorTrajectory]) -> dict[str, int]:
    counter: Counter[str] = Counter()
    for t in trajectories:
        key = "->".join(t.path_sequence)
        counter[key] += 1
    return dict(counter)


def compute_entropy(
    trajectories: list[VisitorTrajectory],
    actor: str = "entropy_engine",
) -> EntropyResult:
    if not trajectories:
        raise EntropyError(
            "无有效轨迹数据，无法计算熵值",
            {
                "step": "entropy_computation",
                "reason": "trajectories_empty",
                "suggestion": "请确认已录入至少一条访客轨迹",
                "input_count": 0,
            },
        )

    path_counts = compute_path_distribution(trajectories)
    total = len(trajectories)
    unique = len(path_counts)

    probabilities: dict[str, float] = {}
    for path_key, count in path_counts.items():
        probabilities[path_key] = count / total

    raw_entropy = 0.0
    p_log_contributions: dict[str, float] = {}
    for path_key, p in probabilities.items():
        if p > 0:
            contrib = -p * math.log2(p)
            raw_entropy += contrib
            p_log_contributions[path_key] = contrib

    max_entropy = math.log2(unique) if unique > 1 else 0.0
    normalized = raw_entropy / max_entropy if max_entropy > 0 else 0.0

    buckets: list[PathBucket] = []
    for i, (path_key, count) in enumerate(path_counts.items()):
        pattern = tuple(path_key.split("->"))
        bucket = PathBucket(
            bucket_id=f"bucket_{i}",
            path_pattern=pattern,
            trajectory_ids=[],
            count=count,
            probability=probabilities[path_key],
        )
        bucket.audit.record(AuditAction.BUCKETED, actor, f"路径分桶: {path_key}, 频次={count}, 概率={probabilities[path_key]:.4f}")
        buckets.append(bucket)

    concentration_ratio = max(probabilities.values()) if probabilities else 0.0

    intermediate = {
        "path_counts": path_counts,
        "probabilities": probabilities,
        "p_log_contributions": p_log_contributions,
        "concentration_ratio": concentration_ratio,
        "unique_paths": unique,
        "total_trajectories": total,
        "max_possible_entropy": max_entropy,
    }

    result = EntropyResult(
        raw_entropy=raw_entropy,
        normalized_entropy=normalized,
        max_entropy=max_entropy,
        unique_paths=unique,
        total_trajectories=total,
        path_distribution=probabilities,
        intermediate=intermediate,
    )
    result.audit.record(
        AuditAction.ENTROPY_COMPUTED,
        actor,
        f"熵值计算完成: H={raw_entropy:.4f}, H_norm={normalized:.4f}, 集中度={concentration_ratio:.4f}",
        snapshot={"raw_entropy": raw_entropy, "normalized": normalized},
    )

    return result
