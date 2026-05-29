from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

from .alerts import filter_needs_manual_review, generate_alerts
from .distribution import compare_distributions
from .loader import (
    DedupResult,
    dedup_online_features,
    detect_version_mixing,
    load_business_labels,
    load_model_versions,
    load_online_features,
    load_sample_windows,
    load_training_baselines,
)
from .models import (
    AlertLevel,
    BusinessLabel,
    DriftReport,
    DriftResult,
    ModelVersion,
    OnlineFeature,
    SampleWindow,
    TrainingBaseline,
    VersionSliceResult,
    WindowIssue,
)
from .report import export_csv, export_json, format_summary
from .version_slice import slice_by_version
from .window_check import check_sample_windows

logger = logging.getLogger(__name__)


class DriftPipeline:
    def __init__(self) -> None:
        self._raw_features: List[OnlineFeature] = []
        self._baselines: List[TrainingBaseline] = []
        self._model_versions: List[ModelVersion] = []
        self._sample_windows: List[SampleWindow] = []
        self._business_labels: List[BusinessLabel] = []

        self._dedup_result: Optional[DedupResult] = None
        self._features: List[OnlineFeature] = []
        self._load_warnings: List[str] = []

        self._report: Optional[DriftReport] = None

    def load_features(
        self,
        records: List[Dict[str, Any]],
    ) -> "DriftPipeline":
        parsed, warnings = load_online_features(records)
        self._raw_features.extend(parsed)
        self._load_warnings.extend(warnings)
        logger.info("Loaded %d raw feature records", len(parsed))
        return self

    def load_baselines(
        self,
        records: List[Dict[str, Any]],
    ) -> "DriftPipeline":
        baselines, warnings = load_training_baselines(records)
        self._baselines.extend(baselines)
        self._load_warnings.extend(warnings)
        logger.info("Loaded %d baselines", len(baselines))
        return self

    def load_model_versions(
        self,
        records: List[Dict[str, Any]],
    ) -> "DriftPipeline":
        versions, warnings = load_model_versions(records)
        self._model_versions.extend(versions)
        self._load_warnings.extend(warnings)
        logger.info("Loaded %d model versions", len(versions))
        return self

    def load_sample_windows(
        self,
        records: List[Dict[str, Any]],
    ) -> "DriftPipeline":
        windows, warnings = load_sample_windows(records)
        self._sample_windows.extend(windows)
        self._load_warnings.extend(warnings)
        logger.info("Loaded %d sample windows", len(windows))
        return self

    def load_business_labels(
        self,
        records: List[Dict[str, Any]],
    ) -> "DriftPipeline":
        labels, warnings = load_business_labels(records)
        self._business_labels.extend(labels)
        self._load_warnings.extend(warnings)
        logger.info("Loaded %d business labels", len(labels))
        return self

    def _dedup(self) -> None:
        self._dedup_result = dedup_online_features(self._raw_features)
        self._features = self._dedup_result.kept
        if self._dedup_result.duplicate_count > 0:
            logger.warning(
                "Dedup: %d duplicates removed from %d total",
                self._dedup_result.duplicate_count,
                len(self._raw_features),
            )

    def _ensure_dedup(self) -> None:
        if self._dedup_result is None:
            self._dedup()

    def run(self) -> DriftReport:
        self._dedup()

        feature_results = compare_distributions(self._features, self._baselines)

        alerts = generate_alerts(feature_results)

        needs_review = filter_needs_manual_review(alerts)

        version_slices, mixing_warnings = slice_by_version(
            self._features, self._baselines
        )

        window_issues = check_sample_windows(
            self._sample_windows, self._features
        )

        dedup_log = list(self._dedup_result.log) if self._dedup_result else []

        if mixing_warnings:
            for w in mixing_warnings:
                dedup_log.append(w)

        if self._load_warnings:
            for w in self._load_warnings:
                dedup_log.append(f"LOAD_WARNING: {w}")

        version_mix = detect_version_mixing(self._features)
        if version_mix:
            for sid, vers in version_mix.items():
                dedup_log.append(
                    f"VERSION_MIX: sample_id={sid} has versions {vers}"
                )

        total_features = len(feature_results)
        drifted_count = len([r for r in feature_results if r.is_drifted])
        critical_count = len([a for a in alerts if a.level == AlertLevel.CRITICAL])
        warning_count = len([a for a in alerts if a.level == AlertLevel.WARNING])

        summary = {
            "total_features": total_features,
            "drifted_features": drifted_count,
            "needs_manual_review": len(needs_review),
            "critical_alerts": critical_count,
            "warning_alerts": warning_count,
            "window_issues": len(window_issues),
            "version_count": len(version_slices),
            "duplicates_removed": self._dedup_result.duplicate_count if self._dedup_result else 0,
            "load_warnings": len(self._load_warnings),
        }

        self._report = DriftReport(
            report_id=DriftReport.make_report_id(),
            generated_at=datetime.now().isoformat(),
            feature_results=feature_results,
            alerts=alerts,
            version_slices=version_slices,
            window_issues=window_issues,
            needs_manual_review=needs_review,
            dedup_log=dedup_log,
            summary=summary,
        )

        return self._report

    def export_json(self, path: str) -> str:
        if self._report is None:
            raise RuntimeError("Must call run() before export")
        return export_json(self._report, path)

    def export_csv(self, path: str) -> str:
        if self._report is None:
            raise RuntimeError("Must call run() before export")
        return export_csv(self._report, path)

    def format_summary(self) -> str:
        if self._report is None:
            raise RuntimeError("Must call run() before formatting summary")
        return format_summary(self._report)

    @property
    def report(self) -> Optional[DriftReport]:
        return self._report

    @property
    def features(self) -> List[OnlineFeature]:
        self._ensure_dedup()
        return self._features

    @property
    def duplicates_removed(self) -> int:
        self._ensure_dedup()
        return self._dedup_result.duplicate_count if self._dedup_result else 0
