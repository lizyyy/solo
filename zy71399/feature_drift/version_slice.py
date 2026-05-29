from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Tuple

from .distribution import compare_distributions
from .loader import _coerce_float
from .models import (
    DriftResult,
    FeatureType,
    OnlineFeature,
    TrainingBaseline,
    VersionSliceResult,
)


def slice_by_version(
    features: List[OnlineFeature],
    baselines: List[TrainingBaseline],
) -> Tuple[List[VersionSliceResult], List[str]]:
    version_groups: Dict[str, List[OnlineFeature]] = defaultdict(list)
    for feat in features:
        version_groups[feat.model_version].append(feat)

    baseline_map: Dict[str, TrainingBaseline] = {b.feature_name: b for b in baselines}

    version_results: List[VersionSliceResult] = []
    mixing_warnings: List[str] = []

    for version, v_feats in sorted(version_groups.items()):
        sample_ids = set(f.sample_id for f in v_feats)
        sample_count = len(sample_ids)

        version_baselines: List[TrainingBaseline] = []
        for bl in baselines:
            if not bl.model_version or bl.model_version == version:
                version_baselines.append(bl)
            else:
                from .models import TrainingBaseline as TB

                version_baselines.append(
                    TB(
                        feature_name=bl.feature_name,
                        feature_type=bl.feature_type,
                        numeric_stats=bl.numeric_stats,
                        categorical_stats=bl.categorical_stats,
                        sample_size=bl.sample_size,
                        model_version=version,
                    )
                )

        drift_results = compare_distributions(v_feats, version_baselines)

        for r in drift_results:
            r.model_version = version

        has_drift = any(r.is_drifted for r in drift_results)

        vsr = VersionSliceResult(
            version=version,
            feature_results=drift_results,
            sample_count=sample_count,
            has_drift=has_drift,
        )
        version_results.append(vsr)

    if len(version_groups) > 1:
        mixing_warnings.append(
            f"版本混合: 发现 {len(version_groups)} 个版本 "
            f"({', '.join(sorted(version_groups.keys()))}), "
            f"建议按版本分别分析"
        )

    return version_results, mixing_warnings
