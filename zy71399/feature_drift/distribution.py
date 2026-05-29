from __future__ import annotations

import math
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from .loader import _coerce_float
from .models import (
    DriftResult,
    FeatureType,
    OnlineFeature,
    TrainingBaseline,
)


PSI_BINS = 10
KS_THRESHOLD = 0.05
PSI_THRESHOLD_WARNING = 0.1
PSI_THRESHOLD_CRITICAL = 0.25


def _ks_statistic(sample1: List[float], sample2: List[float]) -> float:
    if not sample1 or not sample2:
        return 0.0

    all_vals = sorted(set(sample1 + sample2))
    n1 = len(sample1)
    n2 = len(sample2)

    sorted1 = sorted(sample1)
    sorted2 = sorted(sample2)

    max_diff = 0.0
    i1 = 0
    i2 = 0

    for val in all_vals:
        while i1 < n1 and sorted1[i1] <= val:
            i1 += 1
        while i2 < n2 and sorted2[i2] <= val:
            i2 += 1
        cdf1 = i1 / n1
        cdf2 = i2 / n2
        diff = abs(cdf1 - cdf2)
        if diff > max_diff:
            max_diff = diff

    return max_diff


def _compute_ks(
    online_values: List[float],
    baseline: TrainingBaseline,
) -> Tuple[float, bool]:
    if not online_values or not baseline.numeric_stats:
        return 0.0, False

    from .models import NumericStats

    stats = baseline.numeric_stats
    if stats.std == 0:
        mean_val = stats.mean
        same_count = sum(1 for v in online_values if abs(v - mean_val) < 1e-9)
        if same_count == len(online_values):
            return 0.0, False
        return 1.0, True

    import random

    random.seed(42)
    baseline_samples = []
    for _ in range(min(len(online_values) * 3, 10000)):
        z = random.gauss(0, 1)
        baseline_samples.append(stats.mean + z * stats.std)

    ks_val = _ks_statistic(online_values, baseline_samples)

    n = len(online_values)
    m = len(baseline_samples)
    if n == 0 or m == 0:
        return ks_val, False

    en = math.sqrt(n * m / (n + m))
    threshold = 1.36 / en if en > 0 else KS_THRESHOLD

    is_drifted = ks_val > threshold
    return round(ks_val, 6), is_drifted


def _compute_psi_numeric(
    online_values: List[float],
    baseline: TrainingBaseline,
    bins: int = PSI_BINS,
) -> Tuple[float, bool]:
    if not online_values or not baseline.numeric_stats:
        return 0.0, False

    stats = baseline.numeric_stats
    min_val = stats.min_val
    max_val = stats.max_val

    if max_val == min_val:
        all_same = all(abs(v - max_val) < 1e-9 for v in online_values)
        if all_same:
            return 0.0, False
        return float("inf"), True

    bin_edges = []
    for i in range(bins + 1):
        edge = min_val + (max_val - min_val) * i / bins
        bin_edges.append(edge)

    bin_counts_base = [0] * bins
    for i in range(bins):
        lo = bin_edges[i]
        hi = bin_edges[i + 1]
        if stats.std > 0:
            from math import erf

            z_lo = (lo - stats.mean) / (stats.std * math.sqrt(2))
            z_hi = (hi - stats.mean) / (stats.std * math.sqrt(2))
            p_lo = (1 + erf(z_lo)) / 2
            p_hi = (1 + erf(z_hi)) / 2
            bin_counts_base[i] = max(p_hi - p_lo, 1e-6)
        else:
            bin_counts_base[i] = 1.0 / bins

    total_base = sum(bin_counts_base)
    base_probs = [c / total_base for c in bin_counts_base]

    online_counts = [0] * bins
    for v in online_values:
        idx = int((v - min_val) / (max_val - min_val) * bins)
        idx = max(0, min(bins - 1, idx))
        online_counts[idx] += 1

    total_online = sum(online_counts)
    if total_online == 0:
        return 0.0, False

    online_probs = [c / total_online for c in online_counts]

    psi = 0.0
    for bp, op in zip(base_probs, online_probs):
        if bp > 0 and op > 0:
            psi += (op - bp) * math.log(op / bp)
        elif op > 0 and bp <= 0:
            psi += op * 20.0

    is_drifted = psi > PSI_THRESHOLD_WARNING
    return round(psi, 6), is_drifted


def _compute_psi_categorical(
    online_values: List[str],
    baseline: TrainingBaseline,
) -> Tuple[float, bool]:
    if not online_values or not baseline.categorical_stats:
        return 0.0, False

    cat_stats = baseline.categorical_stats
    total_base = cat_stats.total_count if cat_stats.total_count > 0 else sum(
        cat_stats.value_counts.values()
    )
    if total_base == 0:
        return 0.0, False

    all_categories = set(cat_stats.value_counts.keys()) | set(online_values)

    base_probs: Dict[str, float] = {}
    for cat in all_categories:
        count = cat_stats.value_counts.get(cat, 0)
        base_probs[cat] = max(count / total_base, 1e-6)

    online_counter = Counter(online_values)
    total_online = len(online_values)

    psi = 0.0
    for cat in all_categories:
        bp = base_probs.get(cat, 1e-6)
        op = online_counter.get(cat, 0) / total_online
        if op > 0 and bp > 0:
            psi += (op - bp) * math.log(op / bp)
        elif op > 0 and bp <= 0:
            psi += op * 20.0

    is_drifted = psi > PSI_THRESHOLD_WARNING
    return round(psi, 6), is_drifted


def compute_online_missing_rate(
    features: List[OnlineFeature],
) -> Dict[str, float]:
    total: Dict[str, int] = {}
    missing: Dict[str, int] = {}

    for feat in features:
        fn = feat.feature_name
        total[fn] = total.get(fn, 0) + 1
        val = feat.feature_value
        if val is None or (isinstance(val, str) and val.strip() in ("", "NA", "N/A", "null", "None", "nan", "-")):
            missing[fn] = missing.get(fn, 0) + 1

    return {
        fn: (missing.get(fn, 0) / total[fn] if total[fn] > 0 else 0.0)
        for fn in total
    }


def compare_distributions(
    features: List[OnlineFeature],
    baselines: List[TrainingBaseline],
) -> List[DriftResult]:
    baseline_map: Dict[str, TrainingBaseline] = {}
    for b in baselines:
        baseline_map[b.feature_name] = b

    feature_groups: Dict[str, List[OnlineFeature]] = {}
    for feat in features:
        feature_groups.setdefault(feat.feature_name, []).append(feat)

    online_missing = compute_online_missing_rate(features)

    results: List[DriftResult] = []

    for feat_name, online_feats in feature_groups.items():
        baseline = baseline_map.get(feat_name)
        if baseline is None:
            results.append(
                DriftResult(
                    feature_name=feat_name,
                    feature_type=FeatureType.NUMERIC,
                    drift_metric=0.0,
                    metric_name="SKIP",
                    is_drifted=False,
                    online_missing_rate=online_missing.get(feat_name, 0.0),
                    details={"reason": "no baseline found"},
                )
            )
            continue

        bl_missing = baseline.get_missing_rate()
        on_missing = online_missing.get(feat_name, 0.0)

        if baseline.feature_type == FeatureType.NUMERIC:
            numeric_vals: List[float] = []
            for f in online_feats:
                v = _coerce_float(f.feature_value)
                if v is not None:
                    numeric_vals.append(v)

            ks_val, ks_drifted = _compute_ks(numeric_vals, baseline)
            psi_val, psi_drifted = _compute_psi_numeric(numeric_vals, baseline)

            is_drifted = ks_drifted or psi_drifted
            primary_metric = psi_val
            metric_name = "PSI"

            if psi_val <= PSI_THRESHOLD_WARNING and ks_drifted:
                primary_metric = ks_val
                metric_name = "KS"

            results.append(
                DriftResult(
                    feature_name=feat_name,
                    feature_type=FeatureType.NUMERIC,
                    drift_metric=primary_metric,
                    metric_name=metric_name,
                    is_drifted=is_drifted,
                    baseline_missing_rate=bl_missing,
                    online_missing_rate=on_missing,
                    missing_rate_delta=round(on_missing - bl_missing, 6),
                    details={"ks": ks_val, "psi": psi_val, "valid_count": len(numeric_vals)},
                )
            )
        else:
            cat_vals: List[str] = []
            for f in online_feats:
                v = f.feature_value
                if v is not None and str(v).strip() not in ("", "NA", "N/A", "null", "None", "nan", "-"):
                    cat_vals.append(str(v).strip())

            psi_val, psi_drifted = _compute_psi_categorical(cat_vals, baseline)

            results.append(
                DriftResult(
                    feature_name=feat_name,
                    feature_type=FeatureType.CATEGORICAL,
                    drift_metric=psi_val,
                    metric_name="PSI",
                    is_drifted=psi_drifted,
                    baseline_missing_rate=bl_missing,
                    online_missing_rate=on_missing,
                    missing_rate_delta=round(on_missing - bl_missing, 6),
                    details={"valid_count": len(cat_vals)},
                )
            )

    return results
