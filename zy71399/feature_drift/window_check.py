from __future__ import annotations

from typing import Dict, List, Tuple

from .distribution import compute_online_missing_rate
from .loader import _coerce_float
from .models import AlertLevel, OnlineFeature, SampleWindow, WindowIssue


SHORT_WINDOW_THRESHOLD_RATIO = 0.5
MISSING_SPIKE_THRESHOLD = 0.1
OVERALL_MISSING_THRESHOLD = 0.3


def check_sample_windows(
    windows: List[SampleWindow],
    features: List[OnlineFeature],
) -> List[WindowIssue]:
    issues: List[WindowIssue] = []

    for window in windows:
        if window.is_too_short():
            severity = AlertLevel.CRITICAL
            ratio = window.sample_count / window.min_recommended if window.min_recommended > 0 else 0
            issues.append(
                WindowIssue(
                    window_id=window.window_id,
                    issue_type="short_window",
                    severity=severity,
                    message=(
                        f"样本窗口过短: {window.sample_count} < 最低建议 {window.min_recommended} "
                        f"(仅{ratio:.0%}), 统计指标不可靠"
                    ),
                    details={
                        "sample_count": window.sample_count,
                        "min_recommended": window.min_recommended,
                        "ratio": ratio,
                        "start_date": window.start_date,
                        "end_date": window.end_date,
                    },
                )
            )

    online_missing = compute_online_missing_rate(features)
    for feat_name, miss_rate in online_missing.items():
        if miss_rate > OVERALL_MISSING_THRESHOLD:
            issues.append(
                WindowIssue(
                    window_id="overall",
                    issue_type="missing_spike",
                    severity=AlertLevel.CRITICAL,
                    message=(
                        f"缺失值飙升: 特征 '{feat_name}' 线上缺失率 {miss_rate:.1%} "
                        f"超过阈值 {OVERALL_MISSING_THRESHOLD:.0%}, 优先排查"
                    ),
                    details={
                        "feature_name": feat_name,
                        "missing_rate": miss_rate,
                        "threshold": OVERALL_MISSING_THRESHOLD,
                    },
                )
            )
        elif miss_rate > MISSING_SPIKE_THRESHOLD:
            issues.append(
                WindowIssue(
                    window_id="overall",
                    issue_type="missing_elevated",
                    severity=AlertLevel.WARNING,
                    message=(
                        f"缺失值偏高: 特征 '{feat_name}' 线上缺失率 {miss_rate:.1%}, "
                        f"超过预警线 {MISSING_SPIKE_THRESHOLD:.0%}"
                    ),
                    details={
                        "feature_name": feat_name,
                        "missing_rate": miss_rate,
                        "threshold": MISSING_SPIKE_THRESHOLD,
                    },
                )
            )

    version_counts: Dict[str, int] = {}
    for feat in features:
        version_counts[feat.model_version] = version_counts.get(feat.model_version, 0) + 1

    if len(version_counts) > 1:
        total = sum(version_counts.values())
        dominant = max(version_counts.values())
        dominant_ratio = dominant / total if total > 0 else 0

        if dominant_ratio < 0.8:
            issues.append(
                WindowIssue(
                    window_id="overall",
                    issue_type="version_mixing",
                    severity=AlertLevel.WARNING,
                    message=(
                        f"版本混合: 多个版本共存 "
                        f"({', '.join(f'{v}({c})' for v, c in sorted(version_counts.items()))}), "
                        f"最大版本占比仅{dominant_ratio:.0%}, 建议隔离分析"
                    ),
                    details={
                        "version_counts": version_counts,
                        "dominant_ratio": dominant_ratio,
                    },
                )
            )

    return issues
