import json
from pathlib import Path

import pytest

from offline_eval_trace.engine.verifier import Verifier, VerifyResult
from offline_eval_trace.models import (
    DatasetVersion,
    EvaluationResult,
    Experiment,
    ExcludedSample,
    IssueSeverity,
    IssueType,
    SampleRange,
    ThresholdConfig,
    VerificationIssue,
)


def _make_exp(**kwargs) -> Experiment:
    defaults = {"name": "test"}
    defaults.update(kwargs)
    return Experiment(**defaults)


class TestVerifyResult:
    def test_passed_no_issues(self):
        r = VerifyResult([])
        assert r.passed
        assert not r.has_critical
        assert not r.has_warning

    def test_passed_with_warning(self):
        issues = [VerificationIssue(issue_type=IssueType.MISSING_LABEL, severity=IssueSeverity.WARNING, description="warn")]
        r = VerifyResult(issues)
        assert r.passed
        assert r.has_warning

    def test_failed_with_critical(self):
        issues = [VerificationIssue(issue_type=IssueType.TRAIN_LEAK, severity=IssueSeverity.CRITICAL, description="crit")]
        r = VerifyResult(issues)
        assert not r.passed
        assert r.has_critical

    def test_summary_output(self):
        issues = [
            VerificationIssue(issue_type=IssueType.TRAIN_LEAK, severity=IssueSeverity.CRITICAL, description="leak found", suggestion="fix it", affected_samples=["s1", "s2"]),
        ]
        r = VerifyResult(issues)
        s = r.summary()
        assert "1 个问题" in s
        assert "train_leak" in s
        assert "fix it" in s
        assert "s1" in s


class TestVerifierTrainLeak:
    def test_detect_train_leak(self, tmp_path: Path):
        ds_data = {"samples": [{"id": "t1"}, {"id": "t2"}, {"id": "t3"}]}
        ds_file = tmp_path / "ds.json"
        ds_file.write_text(json.dumps(ds_data))

        ds = DatasetVersion(dataset_name="d", version_hash="h", source_path=str(ds_file), sample_count=3)
        exp = _make_exp(dataset=ds)

        verifier = Verifier(train_sample_ids={"t1", "t2"})
        result = verifier.verify(exp)
        assert result.has_critical
        assert any(i.issue_type == IssueType.TRAIN_LEAK for i in result.issues)

    def test_no_leak_when_excluded(self, tmp_path: Path):
        ds_data = {"samples": [{"id": "t1"}, {"id": "t2"}, {"id": "t3"}]}
        ds_file = tmp_path / "ds.json"
        ds_file.write_text(json.dumps(ds_data))

        ds = DatasetVersion(dataset_name="d", version_hash="h", source_path=str(ds_file), sample_count=3)
        excluded = ExcludedSample(sample_ids=["t1", "t2"], reason="train overlap")
        exp = _make_exp(dataset=ds, excluded_samples=[excluded])

        verifier = Verifier(train_sample_ids={"t1", "t2"})
        result = verifier.verify(exp)
        assert not any(i.issue_type == IssueType.TRAIN_LEAK for i in result.issues)

    def test_no_train_ids_skips_check(self):
        exp = _make_exp()
        verifier = Verifier()
        result = verifier.verify(exp)
        assert not any(i.issue_type == IssueType.TRAIN_LEAK for i in result.issues)


class TestVerifierLabelMapping:
    def test_detect_missing_labels(self):
        label_schema = {"mapping": {"A": "a", "B": "b"}}
        ds = DatasetVersion(dataset_name="d", version_hash="h", source_path="/d", sample_count=10, label_schema=label_schema)
        exp = _make_exp(dataset=ds)

        verifier = Verifier(expected_labels={"A", "B", "C"})
        result = verifier.verify(exp)
        assert any(i.issue_type == IssueType.MISSING_LABEL for i in result.issues)

    def test_detect_extra_labels(self):
        label_schema = {"mapping": {"A": "a", "B": "b", "X": "x"}}
        ds = DatasetVersion(dataset_name="d", version_hash="h", source_path="/d", sample_count=10, label_schema=label_schema)
        exp = _make_exp(dataset=ds)

        verifier = Verifier(expected_labels={"A", "B"})
        result = verifier.verify(exp)
        assert any(i.issue_type == IssueType.LABEL_LEAK for i in result.issues)

    def test_no_label_schema_warns(self):
        ds = DatasetVersion(dataset_name="d", version_hash="h", source_path="/d", sample_count=10, label_schema={})
        exp = _make_exp(dataset=ds)

        verifier = Verifier(expected_labels={"A", "B"})
        result = verifier.verify(exp)
        assert any(i.issue_type == IssueType.MISSING_LABEL and i.severity == IssueSeverity.WARNING for i in result.issues)

    def test_all_labels_present(self):
        label_schema = {"mapping": {"A": "a", "B": "b"}}
        ds = DatasetVersion(dataset_name="d", version_hash="h", source_path="/d", sample_count=10, label_schema=label_schema)
        exp = _make_exp(dataset=ds)

        verifier = Verifier(expected_labels={"A", "B"})
        result = verifier.verify(exp)
        assert not any(i.issue_type == IssueType.MISSING_LABEL for i in result.issues)


class TestVerifierThreshold:
    def test_detect_threshold_mismatch(self):
        tc = ThresholdConfig(config_path="/c", config_hash="h", thresholds={"f1": 0.9})
        results = [EvaluationResult(metric_name="f1", metric_value=0.8)]
        exp = _make_exp(threshold_config=tc, results=results)

        verifier = Verifier(strict_threshold_check=True)
        result = verifier.verify(exp)
        assert any(i.issue_type == IssueType.THRESHOLD_MISMATCH for i in result.issues)

    def test_threshold_ok(self):
        tc = ThresholdConfig(config_path="/c", config_hash="h", thresholds={"f1": 0.7})
        results = [EvaluationResult(metric_name="f1", metric_value=0.85)]
        exp = _make_exp(threshold_config=tc, results=results)

        verifier = Verifier(strict_threshold_check=True)
        result = verifier.verify(exp)
        assert not any(i.issue_type == IssueType.THRESHOLD_MISMATCH for i in result.issues)


class TestVerifierExcludedOverlap:
    def test_detect_overlap(self):
        ex1 = ExcludedSample(sample_ids=["s1", "s2"], reason="r1")
        ex2 = ExcludedSample(sample_ids=["s2", "s3"], reason="r2")
        exp = _make_exp(excluded_samples=[ex1, ex2])

        verifier = Verifier()
        result = verifier.verify(exp)
        overlap_issues = [i for i in result.issues if "多次排除" in i.description]
        assert len(overlap_issues) > 0

    def test_no_overlap(self):
        ex1 = ExcludedSample(sample_ids=["s1", "s2"], reason="r1")
        ex2 = ExcludedSample(sample_ids=["s3", "s4"], reason="r2")
        exp = _make_exp(excluded_samples=[ex1, ex2])

        verifier = Verifier()
        result = verifier.verify(exp)
        assert not any("多次排除" in i.description for i in result.issues)
