from __future__ import annotations

import csv
import json
import logging
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .models import (
    BusinessLabel,
    FeatureType,
    ModelVersion,
    OnlineFeature,
    SampleWindow,
    TrainingBaseline,
    NumericStats,
    CategoricalStats,
)

logger = logging.getLogger(__name__)


class DedupResult:
    def __init__(self) -> None:
        self.kept: List[OnlineFeature] = []
        self.duplicates: List[OnlineFeature] = []
        self.log: List[str] = []

    @property
    def duplicate_count(self) -> int:
        return len(self.duplicates)


def _coerce_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if s in ("", "nan", "NaN", "None", "null", "NA", "N/A", "-"):
        return None
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def _coerce_str(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def load_online_features(
    records: List[Dict[str, Any]],
) -> Tuple[List[OnlineFeature], List[str]]:
    parsed: List[OnlineFeature] = []
    parse_warnings: List[str] = []

    for i, row in enumerate(records):
        sample_id = _coerce_str(row.get("sample_id", ""))
        feature_name = _coerce_str(row.get("feature_name", ""))
        feature_value = row.get("feature_value", row.get("value", None))
        model_version = _coerce_str(row.get("model_version", row.get("version", "")))
        timestamp = _coerce_str(row.get("timestamp", row.get("ts", "")))
        business_label = _coerce_str(row.get("business_label", row.get("label", "")))

        if not sample_id or not feature_name:
            parse_warnings.append(
                f"Row {i}: missing sample_id or feature_name, skipping"
            )
            continue

        if not model_version:
            parse_warnings.append(
                f"Row {i} (sample_id={sample_id}, feature={feature_name}): "
                f"empty model_version, defaulting to 'unknown'"
            )
            model_version = "unknown"

        feat = OnlineFeature(
            sample_id=sample_id,
            feature_name=feature_name,
            feature_value=feature_value,
            model_version=model_version,
            timestamp=timestamp,
            business_label=business_label,
            _raw_row=row,
        )
        parsed.append(feat)

    return parsed, parse_warnings


def dedup_online_features(features: List[OnlineFeature]) -> DedupResult:
    result = DedupResult()
    seen: Dict[str, OnlineFeature] = {}

    for feat in features:
        key = feat.identity_key()
        if key in seen:
            result.duplicates.append(feat)
            existing = seen[key]
            msg = (
                f"Dedup: sample_id={feat.sample_id} feature={feat.feature_name} "
                f"kept version={existing.model_version} "
                f"dropped version={feat.model_version}"
            )
            result.log.append(msg)
            logger.warning(msg)
        else:
            seen[key] = feat
            result.kept.append(feat)

    return result


def load_training_baselines(
    records: List[Dict[str, Any]],
) -> Tuple[List[TrainingBaseline], List[str]]:
    baselines: List[TrainingBaseline] = []
    warnings: List[str] = []

    for i, row in enumerate(records):
        feature_name = _coerce_str(row.get("feature_name", ""))
        if not feature_name:
            warnings.append(f"Baseline row {i}: missing feature_name, skipping")
            continue

        ft_str = _coerce_str(row.get("feature_type", "numeric")).lower()
        try:
            feature_type = FeatureType(ft_str)
        except ValueError:
            feature_type = FeatureType.NUMERIC
            warnings.append(
                f"Baseline row {i}: unknown feature_type '{ft_str}', defaulting to numeric"
            )

        numeric_stats = None
        categorical_stats = None

        if feature_type == FeatureType.NUMERIC:
            mean = _coerce_float(row.get("mean", 0))
            std = _coerce_float(row.get("std", 0))
            min_val = _coerce_float(row.get("min", row.get("min_val", 0)))
            max_val = _coerce_float(row.get("max", row.get("max_val", 0)))
            missing_rate = _coerce_float(row.get("missing_rate", 0)) or 0.0
            sample_size = int(_coerce_float(row.get("sample_size", 0)) or 0)

            percentiles: Dict[str, float] = {}
            for p_key in ("p1", "p5", "p10", "p25", "p50", "p75", "p90", "p95", "p99"):
                p_val = _coerce_float(row.get(p_key))
                if p_val is not None:
                    percentiles[p_key] = p_val

            if mean is None:
                mean = 0.0
                warnings.append(
                    f"Baseline '{feature_name}': mean is unparseable, defaulting to 0"
                )
            if std is None:
                std = 0.0
            if min_val is None:
                min_val = 0.0
            if max_val is None:
                max_val = 0.0

            numeric_stats = NumericStats(
                mean=mean,
                std=std,
                min_val=min_val,
                max_val=max_val,
                percentiles=percentiles,
                missing_rate=missing_rate,
            )
        else:
            vc_raw = row.get("value_counts", row.get("counts", {}))
            if isinstance(vc_raw, str):
                try:
                    vc_raw = json.loads(vc_raw)
                except json.JSONDecodeError:
                    vc_raw = {}
                    warnings.append(
                        f"Baseline '{feature_name}': value_counts JSON parse failed, defaulting empty"
                    )
            if not isinstance(vc_raw, dict):
                vc_raw = {}
                warnings.append(
                    f"Baseline '{feature_name}': value_counts not dict, defaulting empty"
                )

            value_counts = {str(k): int(v) for k, v in vc_raw.items()}
            total_count = int(_coerce_float(row.get("total_count", sum(value_counts.values()))) or 0)
            missing_rate = _coerce_float(row.get("missing_rate", 0)) or 0.0
            sample_size = int(_coerce_float(row.get("sample_size", total_count)) or 0)

            categorical_stats = CategoricalStats(
                value_counts=value_counts,
                total_count=total_count,
                missing_rate=missing_rate,
            )

        baseline = TrainingBaseline(
            feature_name=feature_name,
            feature_type=feature_type,
            numeric_stats=numeric_stats,
            categorical_stats=categorical_stats,
            sample_size=sample_size or 0,
            model_version=_coerce_str(row.get("model_version", "")),
        )
        baselines.append(baseline)

    return baselines, warnings


def load_model_versions(
    records: List[Dict[str, Any]],
) -> Tuple[List[ModelVersion], List[str]]:
    versions: List[ModelVersion] = []
    warnings: List[str] = []

    for i, row in enumerate(records):
        version = _coerce_str(row.get("version", row.get("model_version", "")))
        if not version:
            warnings.append(f"Version row {i}: missing version, skipping")
            continue
        versions.append(
            ModelVersion(
                version=version,
                description=_coerce_str(row.get("description", "")),
                deploy_date=_coerce_str(row.get("deploy_date", "")),
            )
        )

    return versions, warnings


def load_sample_windows(
    records: List[Dict[str, Any]],
) -> Tuple[List[SampleWindow], List[str]]:
    windows: List[SampleWindow] = []
    warnings: List[str] = []

    for i, row in enumerate(records):
        window_id = _coerce_str(row.get("window_id", row.get("id", "")))
        if not window_id:
            window_id = f"window-{i}"
            warnings.append(f"Window row {i}: missing window_id, auto-assigned '{window_id}'")

        sample_count = int(_coerce_float(row.get("sample_count", row.get("count", 0))) or 0)
        min_rec = int(_coerce_float(row.get("min_recommended", 200)) or 200)

        windows.append(
            SampleWindow(
                window_id=window_id,
                start_date=_coerce_str(row.get("start_date", "")),
                end_date=_coerce_str(row.get("end_date", "")),
                sample_count=sample_count,
                min_recommended=min_rec,
            )
        )

    return windows, warnings


def load_business_labels(
    records: List[Dict[str, Any]],
) -> Tuple[List[BusinessLabel], List[str]]:
    labels: List[BusinessLabel] = []
    warnings: List[str] = []

    for i, row in enumerate(records):
        label_name = _coerce_str(row.get("label_name", row.get("name", "")))
        if not label_name:
            warnings.append(f"Label row {i}: missing label_name, skipping")
            continue
        labels.append(
            BusinessLabel(
                label_name=label_name,
                description=_coerce_str(row.get("description", "")),
            )
        )

    return labels, warnings


def load_csv(path: str) -> List[Dict[str, Any]]:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"CSV file not found: {path}")
    with open(p, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        return [dict(row) for row in reader]


def load_json(path: str) -> List[Dict[str, Any]]:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"JSON file not found: {path}")
    with open(p, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("records", "data", "items", "rows"):
            if key in data and isinstance(data[key], list):
                return data[key]
        return [data]
    return []


def detect_version_mixing(features: List[OnlineFeature]) -> Dict[str, List[str]]:
    from collections import defaultdict

    sample_versions: Dict[str, set] = defaultdict(set)
    for feat in features:
        sample_versions[feat.sample_id].add(feat.model_version)

    mixed: Dict[str, List[str]] = {}
    for sid, vers in sample_versions.items():
        if len(vers) > 1:
            mixed[sid] = sorted(vers)

    return mixed
