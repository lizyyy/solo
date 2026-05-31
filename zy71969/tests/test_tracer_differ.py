import pytest

from offline_eval_trace.engine.differ import Differ, DiffResult
from offline_eval_trace.engine.tracer import Tracer
from offline_eval_trace.models import (
    DatasetVersion,
    EvaluationResult,
    Experiment,
    MetricScript,
    SampleRange,
    ThresholdConfig,
)


def _make_exp(**kwargs) -> Experiment:
    defaults = {"name": "test"}
    defaults.update(kwargs)
    return Experiment(**defaults)


class TestDiffer:
    def test_diff_identical(self):
        exp = _make_exp(note="same")
        differ = Differ()
        result = differ.diff(exp, exp)
        assert len(result.changes) == 0
        assert not result.has_config_change

    def test_diff_note_change(self):
        a = _make_exp(note="old")
        b = _make_exp(note="new")
        differ = Differ()
        result = differ.diff(a, b)
        assert result.has_note_change
        assert not result.has_config_change

    def test_diff_dataset_change(self):
        ds1 = DatasetVersion(dataset_name="d", version_hash="h1", source_path="/d", sample_count=100)
        ds2 = DatasetVersion(dataset_name="d", version_hash="h2", source_path="/d", sample_count=200)
        a = _make_exp(dataset=ds1)
        b = _make_exp(dataset=ds2)
        differ = Differ()
        result = differ.diff(a, b)
        assert result.has_config_change

    def test_diff_threshold_change(self):
        tc1 = ThresholdConfig(config_path="/c", config_hash="h", thresholds={"f1": 0.8})
        tc2 = ThresholdConfig(config_path="/c", config_hash="h", thresholds={"f1": 0.9})
        a = _make_exp(threshold_config=tc1)
        b = _make_exp(threshold_config=tc2)
        differ = Differ()
        result = differ.diff(a, b)
        assert result.has_config_change

    def test_diff_render(self):
        a = _make_exp(note="a")
        b = _make_exp(note="b")
        differ = Differ()
        result = differ.diff(a, b)
        rendered = result.render()
        assert "note" in rendered

    def test_pinpoint_cause_with_metric(self):
        ds = DatasetVersion(dataset_name="d", version_hash="h", source_path="/d", sample_count=100)
        tc1 = ThresholdConfig(config_path="/c", config_hash="h1", thresholds={"f1": 0.8})
        tc2 = ThresholdConfig(config_path="/c", config_hash="h2", thresholds={"f1": 0.9})
        r1 = [EvaluationResult(metric_name="f1", metric_value=0.85)]
        r2 = [EvaluationResult(metric_name="f1", metric_value=0.78)]

        a = _make_exp(name="a", dataset=ds, threshold_config=tc1, results=r1)
        b = _make_exp(name="b", dataset=ds, threshold_config=tc2, results=r2)

        differ = Differ()
        result = differ.pinpoint_cause("f1", a, b)
        assert "0.85" in result
        assert "0.78" in result
        assert "阈值" in result

    def test_pinpoint_cause_no_diff(self):
        exp = _make_exp(results=[EvaluationResult(metric_name="f1", metric_value=0.85)])
        differ = Differ()
        result = differ.pinpoint_cause("f1", exp, exp)
        assert "完全相同" in result

    def test_pinpoint_cause_missing_metric(self):
        a = _make_exp()
        b = _make_exp()
        differ = Differ()
        result = differ.pinpoint_cause("f1", a, b)
        assert "未记录" in result


class TestTracer:
    def test_trace_score(self):
        ds = DatasetVersion(dataset_name="test_ds", version_hash="h1", source_path="/ds", sample_count=500,
                            sample_range=SampleRange(split="test", start_idx=0, end_idx=500))
        ms = MetricScript(script_path="/eval.py", script_hash="sh1", parameters={"top_k": 5})
        tc = ThresholdConfig(config_path="/conf.json", config_hash="ch1", thresholds={"f1": 0.8})
        results = [EvaluationResult(metric_name="f1", metric_value=0.87)]

        exp = _make_exp(dataset=ds, metric_script=ms, threshold_config=tc, results=results)

        tracer = Tracer()
        chain = tracer.trace_score(exp, "f1")
        assert chain is not None
        assert len(chain.nodes) >= 4

        rendered = chain.render()
        assert "0.87" in rendered
        assert "test_ds" in rendered

    def test_trace_score_not_found(self):
        exp = _make_exp()
        tracer = Tracer()
        chain = tracer.trace_score(exp, "nonexistent")
        assert chain is None

    def test_trace_sample_range(self):
        ds = DatasetVersion(dataset_name="d", version_hash="h", source_path="/d", sample_count=100,
                            sample_range=SampleRange(split="test", start_idx=10, end_idx=90))
        exp = _make_exp(dataset=ds)

        tracer = Tracer()
        chain = tracer.trace_sample_range(exp)
        rendered = chain.render()
        assert "test" in rendered

    def test_trace_with_excluded(self):
        ds = DatasetVersion(dataset_name="d", version_hash="h", source_path="/d", sample_count=100)
        excluded = [__import__("offline_eval_trace.models", fromlist=["ExcludedSample"]).ExcludedSample(
            sample_ids=["s1", "s2"], reason="标注返工"
        )]
        results = [EvaluationResult(metric_name="f1", metric_value=0.9)]
        exp = _make_exp(dataset=ds, excluded_samples=excluded, results=results)

        tracer = Tracer()
        chain = tracer.trace_score(exp, "f1")
        rendered = chain.render()
        assert "排除" in rendered

    def test_chain_render_format(self):
        ds = DatasetVersion(dataset_name="d", version_hash="h", source_path="/d", sample_count=100)
        results = [EvaluationResult(metric_name="acc", metric_value=0.95)]
        exp = _make_exp(dataset=ds, results=results)

        tracer = Tracer()
        chain = tracer.trace_score(exp, "acc")
        rendered = chain.render()
        assert "[评估结果]" in rendered
        assert "[数据集]" in rendered
