from __future__ import annotations

from typing import List

from .distribution import PSI_THRESHOLD_WARNING, PSI_THRESHOLD_CRITICAL, KS_THRESHOLD
from .models import AlertItem, AlertLevel, DriftResult


MISSING_RATE_SPIKE_THRESHOLD = 0.1
MISSING_RATE_ABS_THRESHOLD = 0.3


def classify_alert_level(result: DriftResult) -> AlertLevel:
    if result.metric_name == "SKIP":
        return AlertLevel.INFO

    if result.missing_rate_delta > MISSING_RATE_SPIKE_THRESHOLD:
        return AlertLevel.CRITICAL

    if result.online_missing_rate > MISSING_RATE_ABS_THRESHOLD:
        return AlertLevel.CRITICAL

    if result.metric_name == "PSI":
        if result.drift_metric > PSI_THRESHOLD_CRITICAL:
            return AlertLevel.CRITICAL
        if result.drift_metric > PSI_THRESHOLD_WARNING:
            return AlertLevel.WARNING

    if result.metric_name == "KS":
        if result.is_drifted:
            return AlertLevel.WARNING

    if result.is_drifted:
        return AlertLevel.WARNING

    return AlertLevel.INFO


def generate_alert_explanation(result: DriftResult) -> str:
    parts: List[str] = []
    fn = result.feature_name

    if result.missing_rate_delta > MISSING_RATE_SPIKE_THRESHOLD:
        parts.append(
            f"缺失率飙升: 基线{result.baseline_missing_rate:.1%} → 线上{result.online_missing_rate:.1%} "
            f"(涨幅{result.missing_rate_delta:.1%}), 需优先排查数据采集链路"
        )

    if result.online_missing_rate > MISSING_RATE_ABS_THRESHOLD:
        parts.append(
            f"缺失率绝对值过高({result.online_missing_rate:.1%}), 可能影响模型推理质量"
        )

    if result.metric_name == "PSI" and result.drift_metric > PSI_THRESHOLD_WARNING:
        parts.append(
            f"PSI={result.drift_metric:.4f} 超过阈值{PSI_THRESHOLD_WARNING}, "
            f"分布偏移{'严重' if result.drift_metric > PSI_THRESHOLD_CRITICAL else '明显'}"
        )

    if result.metric_name == "KS" and result.is_drifted:
        ks_val = result.details.get("ks", result.drift_metric)
        parts.append(
            f"KS={ks_val:.4f} 超过显著性阈值, 两样本分布存在显著差异"
        )

    if result.metric_name == "SKIP":
        parts.append(f"无训练基线, 无法计算漂移指标, 请补充基线数据")

    if not parts:
        parts.append(f"指标正常, 未检测到明显漂移")

    return f"[{fn}] " + "; ".join(parts)


def generate_alerts(results: List[DriftResult]) -> List[AlertItem]:
    alerts: List[AlertItem] = []

    for result in results:
        level = classify_alert_level(result)
        explanation = generate_alert_explanation(result)

        category = "drift"
        if result.missing_rate_delta > MISSING_RATE_SPIKE_THRESHOLD:
            category = "missing_spike"
        elif result.online_missing_rate > MISSING_RATE_ABS_THRESHOLD:
            category = "missing_high"
        elif result.metric_name == "SKIP":
            category = "no_baseline"

        alert = AlertItem(
            feature_name=result.feature_name,
            level=level,
            category=category,
            message=f"{level.value.upper()}: {result.feature_name}",
            explanation=explanation,
            drift_metric=result.drift_metric,
            model_version=result.model_version,
        )
        alerts.append(alert)

    return alerts


def filter_needs_manual_review(alerts: List[AlertItem]) -> List[str]:
    return [
        a.feature_name
        for a in alerts
        if a.level in (AlertLevel.CRITICAL, AlertLevel.WARNING)
    ]
