import json
import tempfile
from pathlib import Path

import pytest

from offline_eval_trace.models import (
    DatasetVersion,
    EvaluationResult,
    Experiment,
    ExperimentStatus,
    ExcludedSample,
    MetricScript,
    SampleRange,
    ThresholdConfig,
)


class TestDatasetVersion:
    def test_from_file(self, tmp_path: Path):
        data = {"sample_count": 1000, "label_schema": {"label_a": 0, "label_b": 1}, "sample_range": {"split": "test", "start_idx": 0, "end_idx": 500}}
        f = tmp_path / "dataset.json"
        f.write_text(json.dumps(data))
        ds = DatasetVersion.from_file(f, name="my_dataset")
        assert ds.dataset_name == "my_dataset"
        assert ds.sample_count == 1000
        assert ds.label_schema == {"label_a": 0, "label_b": 1}
        assert ds.sample_range.split == "test"
        assert ds.sample_range.start_idx == 0
        assert ds.sample_range.end_idx == 500
        assert len(ds.version_hash) == 16

    def test_from_file_default_name(self, tmp_path: Path):
        f = tmp_path / "test_ds.json"
        f.write_text("{}")
        ds = DatasetVersion.from_file(f)
        assert ds.dataset_name == "test_ds"
        assert ds.sample_count == 0

    def test_from_file_empty(self, tmp_path: Path):
        f = tmp_path / "empty.json"
        f.write_text("")
        ds = DatasetVersion.from_file(f)
        assert ds.sample_count == 0


class TestMetricScript:
    def test_from_file(self, tmp_path: Path):
        f = tmp_path / "eval_script.py"
        f.write_text("print('hello')")
        ms = MetricScript.from_file(f, version_tag="v2.1", parameters={"top_k": 10})
        assert ms.script_path == str(f)
        assert ms.script_version_tag == "v2.1"
        assert ms.parameters == {"top_k": 10}
        assert len(ms.script_hash) == 16

    def test_parameters_json(self, tmp_path: Path):
        f = tmp_path / "script.py"
        f.write_text("pass")
        ms = MetricScript.from_file(f, parameters={"a": 1, "b": 2})
        assert json.loads(ms.parameters_json()) == {"a": 1, "b": 2}


class TestThresholdConfig:
    def test_from_file(self, tmp_path: Path):
        data = {"thresholds": {"f1": 0.85, "precision": 0.9}, "custom_rules": {"skip_low_confidence": True}}
        f = tmp_path / "config.json"
        f.write_text(json.dumps(data))
        tc = ThresholdConfig.from_file(f)
        assert tc.thresholds == {"f1": 0.85, "precision": 0.9}
        assert tc.custom_rules == {"skip_low_confidence": True}


class TestExperiment:
    def test_config_fingerprint_stable(self):
        ds = DatasetVersion(dataset_name="d", version_hash="abc", source_path="/d", sample_count=100)
        ms = MetricScript(script_path="/s", script_hash="def", parameters={"k": 1})
        tc = ThresholdConfig(config_path="/c", config_hash="ghi", thresholds={"f1": 0.8})

        exp1 = Experiment(name="exp1", dataset=ds, metric_script=ms, threshold_config=tc)
        exp2 = Experiment(name="exp2", dataset=ds, metric_script=ms, threshold_config=tc)

        assert exp1.config_fingerprint() == exp2.config_fingerprint()

    def test_config_fingerprint_differs_on_config_change(self):
        ds = DatasetVersion(dataset_name="d", version_hash="abc", source_path="/d", sample_count=100)
        ms = MetricScript(script_path="/s", script_hash="def")
        tc1 = ThresholdConfig(config_path="/c", config_hash="h1", thresholds={"f1": 0.8})
        tc2 = ThresholdConfig(config_path="/c", config_hash="h1", thresholds={"f1": 0.9})

        exp1 = Experiment(name="a", dataset=ds, metric_script=ms, threshold_config=tc1)
        exp2 = Experiment(name="b", dataset=ds, metric_script=ms, threshold_config=tc2)

        assert exp1.config_fingerprint() != exp2.config_fingerprint()

    def test_note_fingerprint(self):
        exp1 = Experiment(name="a", note="hello")
        exp2 = Experiment(name="b", note="world")
        assert exp1.note_fingerprint() != exp2.note_fingerprint()

    def test_fingerprint_delegates_to_config(self):
        exp = Experiment(name="a")
        assert exp.fingerprint() == exp.config_fingerprint()
