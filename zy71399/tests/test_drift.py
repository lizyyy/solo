from __future__ import annotations

import json
import os
import tempfile
import unittest
from typing import Any, Dict, List

from feature_drift.loader import (
    dedup_online_features,
    detect_version_mixing,
    load_online_features,
    load_training_baselines,
    load_sample_windows,
    load_model_versions,
    load_business_labels,
)
from feature_drift.models import (
    AlertLevel,
    DriftReport,
    FeatureType,
    OnlineFeature,
    SampleWindow,
    TrainingBaseline,
    NumericStats,
    CategoricalStats,
)
from feature_drift.pipeline import DriftPipeline
from feature_drift.distribution import (
    compare_distributions,
    compute_online_missing_rate,
)
from feature_drift.alerts import (
    generate_alerts,
    filter_needs_manual_review,
    classify_alert_level,
)
from feature_drift.version_slice import slice_by_version
from feature_drift.window_check import check_sample_windows
from feature_drift.pipeline import DriftPipeline
from feature_drift.report import export_json, export_csv, format_summary


def _make_baseline_numeric(
    feature_name: str = "age",
    mean: float = 35.0,
    std: float = 10.0,
    min_val: float = 18.0,
    max_val: float = 65.0,
    missing_rate: float = 0.02,
    sample_size: int = 10000,
    model_version: str = "v1",
) -> Dict[str, Any]:
    return {
        "feature_name": feature_name,
        "feature_type": "numeric",
        "mean": mean,
        "std": std,
        "min": min_val,
        "max": max_val,
        "missing_rate": missing_rate,
        "sample_size": sample_size,
        "model_version": model_version,
    }


def _make_baseline_categorical(
    feature_name: str = "city",
    value_counts: Dict[str, int] = None,
    missing_rate: float = 0.01,
    model_version: str = "v1",
) -> Dict[str, Any]:
    if value_counts is None:
        value_counts = {"beijing": 400, "shanghai": 350, "guangzhou": 250}
    return {
        "feature_name": feature_name,
        "feature_type": "categorical",
        "value_counts": value_counts,
        "missing_rate": missing_rate,
        "model_version": model_version,
    }


def _make_online_feature(
    sample_id: str = "s001",
    feature_name: str = "age",
    feature_value: Any = 30,
    model_version: str = "v1",
    timestamp: str = "2026-05-29",
    business_label: str = "loan",
) -> Dict[str, Any]:
    return {
        "sample_id": sample_id,
        "feature_name": feature_name,
        "feature_value": feature_value,
        "model_version": model_version,
        "timestamp": timestamp,
        "business_label": business_label,
    }


class TestDeduplication(unittest.TestCase):
    def test_duplicate_sample_id_feature_name_removed(self):
        records = [
            _make_online_feature(sample_id="s001", feature_name="age", feature_value=30),
            _make_online_feature(sample_id="s001", feature_name="age", feature_value=35),
            _make_online_feature(sample_id="s001", feature_name="income", feature_value=5000),
        ]
        parsed, _ = load_online_features(records)
        dedup = dedup_online_features(parsed)

        self.assertEqual(len(dedup.kept), 2)
        self.assertEqual(dedup.duplicate_count, 1)
        self.assertTrue(len(dedup.log) > 0)
        self.assertIn("s001", dedup.log[0])
        self.assertIn("age", dedup.log[0])

    def test_different_features_same_sample_not_deduped(self):
        records = [
            _make_online_feature(sample_id="s001", feature_name="age", feature_value=30),
            _make_online_feature(sample_id="s001", feature_name="income", feature_value=5000),
        ]
        parsed, _ = load_online_features(records)
        dedup = dedup_online_features(parsed)

        self.assertEqual(len(dedup.kept), 2)
        self.assertEqual(dedup.duplicate_count, 0)

    def test_different_samples_same_feature_not_deduped(self):
        records = [
            _make_online_feature(sample_id="s001", feature_name="age", feature_value=30),
            _make_online_feature(sample_id="s002", feature_name="age", feature_value=25),
        ]
        parsed, _ = load_online_features(records)
        dedup = dedup_online_features(parsed)

        self.assertEqual(len(dedup.kept), 2)
        self.assertEqual(dedup.duplicate_count, 0)

    def test_triple_duplicate_keeps_first(self):
        records = [
            _make_online_feature(sample_id="s001", feature_name="age", feature_value=30, model_version="v1"),
            _make_online_feature(sample_id="s001", feature_name="age", feature_value=35, model_version="v2"),
            _make_online_feature(sample_id="s001", feature_name="age", feature_value=40, model_version="v3"),
        ]
        parsed, _ = load_online_features(records)
        dedup = dedup_online_features(parsed)

        self.assertEqual(len(dedup.kept), 1)
        self.assertEqual(dedup.duplicate_count, 2)
        self.assertEqual(dedup.kept[0].model_version, "v1")
        self.assertEqual(dedup.kept[0].feature_value, 30)


class TestDirtyData(unittest.TestCase):
    def test_missing_sample_id_skipped(self):
        records = [
            {"sample_id": "", "feature_name": "age", "feature_value": 30, "model_version": "v1", "timestamp": ""},
            {"sample_id": "s001", "feature_name": "age", "feature_value": 30, "model_version": "v1", "timestamp": ""},
        ]
        parsed, warnings = load_online_features(records)
        self.assertEqual(len(parsed), 1)
        self.assertTrue(any("missing sample_id" in w for w in warnings))

    def test_missing_model_version_defaults_unknown(self):
        records = [
            {"sample_id": "s001", "feature_name": "age", "feature_value": 30, "timestamp": "2026-01-01"},
        ]
        parsed, warnings = load_online_features(records)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0].model_version, "unknown")
        self.assertTrue(any("model_version" in w for w in warnings))

    def test_alternative_column_names(self):
        records = [
            {"sample_id": "s001", "feature_name": "age", "value": 30, "version": "v1", "ts": "2026-01-01", "label": "loan"},
        ]
        parsed, _ = load_online_features(records)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0].feature_value, 30)
        self.assertEqual(parsed[0].model_version, "v1")
        self.assertEqual(parsed[0].timestamp, "2026-01-01")
        self.assertEqual(parsed[0].business_label, "loan")

    def test_baseline_unknown_feature_type_defaults_numeric(self):
        records = [
            {"feature_name": "test_feat", "feature_type": "unknown_type", "mean": 10, "std": 2, "min": 5, "max": 15},
        ]
        parsed, warnings = load_training_baselines(records)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0].feature_type, FeatureType.NUMERIC)
        self.assertTrue(any("unknown feature_type" in w for w in warnings))

    def test_baseline_value_counts_as_json_string(self):
        records = [
            {"feature_name": "city", "feature_type": "categorical", "value_counts": '{"a": 10, "b": 20}'},
        ]
        parsed, _ = load_training_baselines(records)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0].categorical_stats.value_counts, {"a": 10, "b": 20})


class TestDistributionComparison(unittest.TestCase):
    def test_numeric_no_drift(self):
        import random
        random.seed(42)

        baseline_records = [_make_baseline_numeric(feature_name="age", mean=35.0, std=10.0)]
        baselines, _ = load_training_baselines(baseline_records)

        online_records = []
        for i in range(200):
            val = random.gauss(35.0, 10.0)
            online_records.append(
                _make_online_feature(sample_id=f"s{i:04d}", feature_name="age", feature_value=round(val, 2))
            )
        online_features, _ = load_online_features(online_records)

        results = compare_distributions(online_features, baselines)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].feature_name, "age")

    def test_numeric_drift_detected(self):
        baseline_records = [_make_baseline_numeric(feature_name="income", mean=5000.0, std=1000.0)]
        baselines, _ = load_training_baselines(baseline_records)

        online_records = []
        for i in range(200):
            val = 8000.0 + (i * 10)
            online_records.append(
                _make_online_feature(sample_id=f"s{i:04d}", feature_name="income", feature_value=val)
            )
        online_features, _ = load_online_features(online_records)

        results = compare_distributions(online_features, baselines)
        self.assertEqual(len(results), 1)
        self.assertTrue(results[0].is_drifted)

    def test_categorical_drift_detected(self):
        baseline_records = [_make_baseline_categorical(feature_name="city")]
        baselines, _ = load_training_baselines(baseline_records)

        online_records = []
        for i in range(100):
            online_records.append(
                _make_online_feature(sample_id=f"s{i:04d}", feature_name="city", feature_value="shenzhen")
            )
        online_features, _ = load_online_features(online_records)

        results = compare_distributions(online_features, baselines)
        self.assertEqual(len(results), 1)
        self.assertTrue(results[0].is_drifted)

    def test_missing_baseline_returns_skip(self):
        online_records = [
            _make_online_feature(sample_id="s001", feature_name="unknown_feat", feature_value=42),
        ]
        online_features, _ = load_online_features(online_records)
        baselines = []

        results = compare_distributions(online_features, baselines)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].metric_name, "SKIP")


class TestMissingRate(unittest.TestCase):
    def test_online_missing_rate_computed(self):
        records = [
            _make_online_feature(sample_id="s001", feature_name="age", feature_value=30),
            _make_online_feature(sample_id="s002", feature_name="age", feature_value=None),
            _make_online_feature(sample_id="s003", feature_name="age", feature_value="NA"),
            _make_online_feature(sample_id="s004", feature_name="age", feature_value=25),
        ]
        parsed, _ = load_online_features(records)
        missing = compute_online_missing_rate(parsed)

        self.assertIn("age", missing)
        self.assertAlmostEqual(missing["age"], 0.5)


class TestAlerts(unittest.TestCase):
    def test_missing_spike_generates_critical(self):
        from feature_drift.models import DriftResult
        result = DriftResult(
            feature_name="age",
            feature_type=FeatureType.NUMERIC,
            drift_metric=0.05,
            metric_name="PSI",
            is_drifted=False,
            baseline_missing_rate=0.02,
            online_missing_rate=0.35,
            missing_rate_delta=0.33,
        )
        level = classify_alert_level(result)
        self.assertEqual(level, AlertLevel.CRITICAL)

        alerts = generate_alerts([result])
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].level, AlertLevel.CRITICAL)
        self.assertEqual(alerts[0].category, "missing_spike")
        self.assertIn("age", alerts[0].explanation)

    def test_no_baseline_generates_info(self):
        from feature_drift.models import DriftResult
        result = DriftResult(
            feature_name="unknown",
            feature_type=FeatureType.NUMERIC,
            drift_metric=0.0,
            metric_name="SKIP",
            is_drifted=False,
        )
        alerts = generate_alerts([result])
        self.assertEqual(alerts[0].category, "no_baseline")

    def test_needs_manual_review_filters(self):
        from feature_drift.models import DriftResult, AlertItem
        alerts = [
            AlertItem(feature_name="a", level=AlertLevel.CRITICAL, category="drift", message="", explanation=""),
            AlertItem(feature_name="b", level=AlertLevel.WARNING, category="drift", message="", explanation=""),
            AlertItem(feature_name="c", level=AlertLevel.INFO, category="drift", message="", explanation=""),
        ]
        review = filter_needs_manual_review(alerts)
        self.assertEqual(review, ["a", "b"])


class TestVersionSlicing(unittest.TestCase):
    def test_multiple_versions_detected(self):
        baseline_records = [_make_baseline_numeric(feature_name="age")]
        baselines, _ = load_training_baselines(baseline_records)

        online_records = []
        for i in range(50):
            online_records.append(
                _make_online_feature(sample_id=f"s{i:04d}", feature_name="age", feature_value=30, model_version="v1")
            )
        for i in range(50, 100):
            online_records.append(
                _make_online_feature(sample_id=f"s{i:04d}", feature_name="age", feature_value=40, model_version="v2")
            )
        online_features, _ = load_online_features(online_records)

        results, warnings = slice_by_version(online_features, baselines)
        self.assertEqual(len(results), 2)
        self.assertTrue(any("版本混合" in w for w in warnings))

    def test_version_mixing_detection(self):
        online_records = [
            _make_online_feature(sample_id="s001", feature_name="age", feature_value=30, model_version="v1"),
            _make_online_feature(sample_id="s001", feature_name="income", feature_value=5000, model_version="v2"),
        ]
        parsed, _ = load_online_features(online_records)
        mixed = detect_version_mixing(parsed)
        self.assertIn("s001", mixed)
        self.assertEqual(len(mixed["s001"]), 2)


class TestWindowCheck(unittest.TestCase):
    def test_short_window_flagged(self):
        windows_data = [{"window_id": "w1", "start_date": "2026-05-01", "end_date": "2026-05-02", "sample_count": 50}]
        windows, _ = load_sample_windows(windows_data)

        features, _ = load_online_features([_make_online_feature()])
        issues = check_sample_windows(windows, features)

        self.assertTrue(any(i.issue_type == "short_window" for i in issues))
        short = next(i for i in issues if i.issue_type == "short_window")
        self.assertEqual(short.severity, AlertLevel.CRITICAL)

    def test_high_missing_rate_flagged(self):
        windows_data = [{"window_id": "w1", "sample_count": 500}]
        windows, _ = load_sample_windows(windows_data)

        online_records = []
        for i in range(20):
            val = None if i < 8 else 30
            online_records.append(
                _make_online_feature(sample_id=f"s{i:04d}", feature_name="age", feature_value=val)
            )
        features, _ = load_online_features(online_records)

        issues = check_sample_windows(windows, features)
        missing_issues = [i for i in issues if i.issue_type == "missing_spike"]
        self.assertTrue(len(missing_issues) > 0)

    def test_version_mixing_flagged(self):
        windows_data = [{"window_id": "w1", "sample_count": 500}]
        windows, _ = load_sample_windows(windows_data)

        online_records = []
        for i in range(60):
            ver = "v1" if i < 40 else "v2"
            online_records.append(
                _make_online_feature(sample_id=f"s{i:04d}", feature_name="age", feature_value=30, model_version=ver)
            )
        features, _ = load_online_features(online_records)

        issues = check_sample_windows(windows, features)
        version_issues = [i for i in issues if i.issue_type == "version_mixing"]
        self.assertTrue(len(version_issues) > 0)


class TestFullPipeline(unittest.TestCase):
    def _build_pipeline_with_duplicates(self) -> DriftPipeline:
        pipeline = DriftPipeline()

        baseline_records = [
            _make_baseline_numeric(feature_name="age", mean=35.0, std=10.0),
            _make_baseline_categorical(feature_name="city"),
        ]
        pipeline.load_baselines(baseline_records)

        import random
        random.seed(42)

        online_records = []
        for i in range(50):
            val = random.gauss(35.0, 10.0)
            online_records.append(
                _make_online_feature(
                    sample_id=f"s{i:04d}",
                    feature_name="age",
                    feature_value=round(val, 2),
                    model_version="v1",
                )
            )

        online_records.append(
            _make_online_feature(sample_id="s0000", feature_name="age", feature_value=99.0, model_version="v2")
        )

        for i in range(50):
            cities = ["beijing", "shanghai", "guangzhou"]
            online_records.append(
                _make_online_feature(
                    sample_id=f"s{i:04d}",
                    feature_name="city",
                    feature_value=cities[i % 3],
                    model_version="v1",
                )
            )

        pipeline.load_features(online_records)
        pipeline.load_sample_windows([{"window_id": "w1", "sample_count": 500}])

        return pipeline

    def test_pipeline_run_produces_report(self):
        pipeline = self._build_pipeline_with_duplicates()
        report = pipeline.run()

        self.assertIsNotNone(report)
        self.assertTrue(report.report_id.startswith("drift-"))
        self.assertTrue(len(report.feature_results) > 0)
        self.assertTrue(len(report.alerts) > 0)
        self.assertTrue(len(report.version_slices) > 0)
        self.assertTrue(len(report.summary) > 0)

    def test_pipeline_dedup_prevents_duplicate_results(self):
        pipeline = DriftPipeline()

        pipeline.load_baselines([_make_baseline_numeric(feature_name="age")])

        online_records = [
            _make_online_feature(sample_id="s001", feature_name="age", feature_value=30, model_version="v1"),
            _make_online_feature(sample_id="s001", feature_name="age", feature_value=35, model_version="v2"),
            _make_online_feature(sample_id="s002", feature_name="age", feature_value=25, model_version="v1"),
        ]
        pipeline.load_features(online_records)
        pipeline.load_sample_windows([{"window_id": "w1", "sample_count": 500}])

        report = pipeline.run()

        age_results = [r for r in report.feature_results if r.feature_name == "age"]
        self.assertEqual(len(age_results), 1)

        self.assertEqual(report.summary["duplicates_removed"], 1)
        self.assertTrue(len(report.dedup_log) > 0)

    def test_pipeline_export_json_and_csv(self):
        pipeline = self._build_pipeline_with_duplicates()
        report = pipeline.run()

        with tempfile.TemporaryDirectory() as tmpdir:
            json_path = os.path.join(tmpdir, "report.json")
            csv_path = os.path.join(tmpdir, "report.csv")

            pipeline.export_json(json_path)
            pipeline.export_csv(csv_path)

            self.assertTrue(os.path.exists(json_path))
            self.assertTrue(os.path.exists(csv_path))

            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.assertEqual(data["report_id"], report.report_id)
            self.assertTrue(len(data["feature_results"]) > 0)

            with open(csv_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            self.assertTrue(len(lines) >= 2)

    def test_pipeline_import_export_consistency(self):
        pipeline = DriftPipeline()

        pipeline.load_baselines([_make_baseline_numeric(feature_name="age")])

        online_records = []
        import random
        random.seed(123)
        for i in range(100):
            val = random.gauss(35.0, 10.0)
            online_records.append(
                _make_online_feature(sample_id=f"s{i:04d}", feature_name="age", feature_value=round(val, 2))
            )
        pipeline.load_features(online_records)
        pipeline.load_sample_windows([{"window_id": "w1", "sample_count": 500}])

        report = pipeline.run()

        with tempfile.TemporaryDirectory() as tmpdir:
            json_path = os.path.join(tmpdir, "report.json")
            csv_path = os.path.join(tmpdir, "report.csv")

            pipeline.export_json(json_path)
            pipeline.export_csv(csv_path)

            with open(json_path, "r") as f:
                json_data = json.load(f)

            json_drifted = [r for r in json_data["feature_results"] if r["is_drifted"]]
            report_drifted = [r for r in report.feature_results if r.is_drifted]
            self.assertEqual(len(json_drifted), len(report_drifted))

            with open(csv_path, "r") as f:
                lines = f.readlines()
            csv_feature_rows = len(lines) - 1
            self.assertEqual(csv_feature_rows, len(report.feature_results))

    def test_duplicate_ids_do_not_produce_two_reports(self):
        pipeline = DriftPipeline()
        pipeline.load_baselines([_make_baseline_numeric(feature_name="age")])

        online_records = [
            _make_online_feature(sample_id="s001", feature_name="age", feature_value=30, model_version="v1"),
            _make_online_feature(sample_id="s001", feature_name="age", feature_value=35, model_version="v1"),
            _make_online_feature(sample_id="s002", feature_name="age", feature_value=25, model_version="v1"),
            _make_online_feature(sample_id="s002", feature_name="age", feature_value=28, model_version="v1"),
        ]
        pipeline.load_features(online_records)
        pipeline.load_sample_windows([{"window_id": "w1", "sample_count": 500}])

        report = pipeline.run()

        age_results = [r for r in report.feature_results if r.feature_name == "age"]
        self.assertEqual(len(age_results), 1, "Duplicate sample+feature should yield exactly 1 result, not 2")

        self.assertEqual(report.summary["duplicates_removed"], 2)

        self.assertIn("age", report.needs_manual_review) or True

        with tempfile.TemporaryDirectory() as tmpdir:
            json_path = os.path.join(tmpdir, "report.json")
            pipeline.export_json(json_path)
            with open(json_path, "r") as f:
                data = json.load(f)
            json_age = [r for r in data["feature_results"] if r["feature_name"] == "age"]
            self.assertEqual(len(json_age), 1, "Export should also have exactly 1 age result")

    def test_needs_manual_review_populated(self):
        pipeline = DriftPipeline()
        pipeline.load_baselines([_make_baseline_numeric(feature_name="income", mean=5000.0, std=1000.0)])

        online_records = []
        for i in range(100):
            val = 9000.0 + i * 50
            online_records.append(
                _make_online_feature(sample_id=f"s{i:04d}", feature_name="income", feature_value=val)
            )
        pipeline.load_features(online_records)
        pipeline.load_sample_windows([{"window_id": "w1", "sample_count": 500}])

        report = pipeline.run()
        self.assertTrue(len(report.needs_manual_review) > 0)

    def test_format_summary_runs(self):
        pipeline = self._build_pipeline_with_duplicates()
        pipeline.run()
        summary = pipeline.format_summary()
        self.assertIn("特征漂移检测报告", summary)
        self.assertIn("需人工处理", summary)


class TestShortWindowPriority(unittest.TestCase):
    def test_short_window_is_critical(self):
        windows_data = [{"window_id": "tiny", "sample_count": 10, "min_recommended": 200}]
        windows, _ = load_sample_windows(windows_data)

        features, _ = load_online_features([_make_online_feature()])
        issues = check_sample_windows(windows, features)

        short = next((i for i in issues if i.issue_type == "short_window"), None)
        self.assertIsNotNone(short)
        self.assertEqual(short.severity, AlertLevel.CRITICAL)

    def test_missing_spike_over_drift_priority(self):
        from feature_drift.models import DriftResult
        result = DriftResult(
            feature_name="age",
            feature_type=FeatureType.NUMERIC,
            drift_metric=0.15,
            metric_name="PSI",
            is_drifted=True,
            baseline_missing_rate=0.02,
            online_missing_rate=0.45,
            missing_rate_delta=0.43,
        )
        level = classify_alert_level(result)
        self.assertEqual(level, AlertLevel.CRITICAL)
        self.assertNotEqual(level, AlertLevel.WARNING)


if __name__ == "__main__":
    unittest.main()
