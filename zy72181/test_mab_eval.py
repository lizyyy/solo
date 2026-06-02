from __future__ import annotations

import tempfile
from datetime import datetime
from pathlib import Path

import pytest

from mab_eval.engine import Engine, classify_stratum
from mab_eval.models import (
    Annotation,
    ConflictCase,
    EvalLog,
    Judgement,
    Stratum,
    ThresholdNote,
)
from mab_eval.store import Store


@pytest.fixture
def tmp_db(tmp_path):
    db_path = tmp_path / "test.db"
    store = Store(db_path)
    store.initialize()
    yield store
    store.close()


@pytest.fixture
def engine(tmp_db):
    return Engine(tmp_db)


def _make_log(
    log_id="l1",
    creative_id="c1",
    arm_name="arm_a",
    impressions=50000,
    clicks=1000,
    conversions=50.0,
    revenue=500.0,
    ctr=0.02,
    cvr=0.05,
    source_file="test.csv",
) -> EvalLog:
    return EvalLog(
        log_id=log_id,
        creative_id=creative_id,
        arm_name=arm_name,
        impressions=impressions,
        clicks=clicks,
        conversions=conversions,
        revenue=revenue,
        ctr=ctr,
        cvr=cvr,
        source_file=source_file,
        log_timestamp=datetime(2025, 1, 1, 12, 0, 0),
    )


def _make_threshold(
    note_id="t1",
    metric="ctr",
    operator=">=",
    threshold=0.01,
    stratum="mid_volume",
) -> ThresholdNote:
    return ThresholdNote(
        note_id=note_id,
        metric=metric,
        operator=operator,
        threshold=threshold,
        stratum=stratum,
        description="test threshold",
        source_file="thresholds.csv",
    )


class TestStratification:
    def test_high_volume(self):
        log = _make_log(impressions=200000)
        assert classify_stratum(log) == Stratum.HIGH_VOLUME

    def test_mid_volume(self):
        log = _make_log(impressions=50000)
        assert classify_stratum(log) == Stratum.MID_VOLUME

    def test_low_volume(self):
        log = _make_log(impressions=100)
        assert classify_stratum(log) == Stratum.LOW_VOLUME

    def test_new_creative_zero_impressions(self):
        log = _make_log(impressions=0)
        assert classify_stratum(log) == Stratum.NEW_CREATIVE

    def test_new_creative_null_impressions(self):
        log = _make_log(impressions=None)
        assert classify_stratum(log) == Stratum.NEW_CREATIVE


class TestNullHandling:
    def test_null_metrics_flagged(self, engine, tmp_db):
        log = _make_log(impressions=None, clicks=None, ctr=None, cvr=None)
        assert log.has_nulls is True

        engine.ingest_eval_log(log)
        engine.ingest_threshold_note(_make_threshold())

        summary = engine.evaluate(run_id="test_null")
        assert summary.null_count >= 1

        results = tmp_db.list_results_by_run("test_null")
        null_result = [r for r in results if r.creative_id == "c1"][0]
        assert null_result.is_exception is True
        assert "空值" in null_result.exception_reason

    def test_null_metric_threshold_unjudgeable(self, engine, tmp_db):
        log = _make_log(ctr=None)
        engine.ingest_eval_log(log)
        engine.ingest_threshold_note(_make_threshold(metric="ctr"))

        summary = engine.evaluate(run_id="test_null_threshold")
        results = tmp_db.list_results_by_run("test_null_threshold")
        r = results[0]

        assert any(tr["passed"] is None for tr in r.threshold_results)
        assert r.judgement == Judgement.BORDERLINE

    def test_partial_null_still_evaluable(self, engine, tmp_db):
        log = _make_log(ctr=0.02, cvr=None)
        engine.ingest_eval_log(log)
        engine.ingest_threshold_note(_make_threshold(metric="ctr"))
        engine.ingest_threshold_note(
            _make_threshold(note_id="t2", metric="cvr", threshold=0.01, stratum="mid_volume")
        )

        summary = engine.evaluate(run_id="test_partial_null")
        results = tmp_db.list_results_by_run("test_partial_null")
        r = results[0]

        ctr_check = [tr for tr in r.threshold_results if tr["metric"] == "ctr"][0]
        cvr_check = [tr for tr in r.threshold_results if tr["metric"] == "cvr"][0]

        assert ctr_check["passed"] is True
        assert cvr_check["passed"] is None
        assert r.is_exception is True


class TestDeduplication:
    def test_superseded_detected(self, engine, tmp_db):
        log1 = _make_log(log_id="l1", creative_id="c1", arm_name="arm_a")
        log2 = _make_log(log_id="l2", creative_id="c1", arm_name="arm_a")

        engine.ingest_eval_log(log1)
        engine.ingest_eval_log(log2)

        summary = engine.evaluate(run_id="test_dup")
        assert summary.duplicate_count >= 1

        results = tmp_db.list_results_by_run("test_dup")
        superseded_results = [r for r in results if r.is_duplicate]
        assert len(superseded_results) >= 1

        dup = superseded_results[0]
        assert dup.judgement == Judgement.SKIPPED
        assert dup.duplicate_of is not None
        assert "替代" in dup.exception_reason

    def test_different_arms_not_deduplicated(self, engine, tmp_db):
        log1 = _make_log(log_id="l1", creative_id="c1", arm_name="arm_a")
        log2 = _make_log(log_id="l2", creative_id="c1", arm_name="arm_b")

        engine.ingest_eval_log(log1)
        engine.ingest_eval_log(log2)

        summary = engine.evaluate(run_id="test_no_dup")
        assert summary.duplicate_count == 0


class TestBoundaryRecord:
    def test_exact_threshold_is_pass(self, engine, tmp_db):
        log = _make_log(ctr=0.01)
        engine.ingest_eval_log(log)
        engine.ingest_threshold_note(_make_threshold(threshold=0.01, operator=">="))

        summary = engine.evaluate(run_id="test_boundary_eq")
        results = tmp_db.list_results_by_run("test_boundary_eq")
        r = results[0]

        assert r.judgement == Judgement.PASS

    def test_just_below_threshold_is_fail(self, engine, tmp_db):
        log = _make_log(ctr=0.0099)
        engine.ingest_eval_log(log)
        engine.ingest_threshold_note(_make_threshold(threshold=0.01, operator=">="))

        summary = engine.evaluate(run_id="test_boundary_below")
        results = tmp_db.list_results_by_run("test_boundary_below")
        r = results[0]

        assert r.judgement == Judgement.FAIL

    def test_zero_metric_with_gt_threshold(self, engine, tmp_db):
        log = _make_log(ctr=0.0)
        engine.ingest_eval_log(log)
        engine.ingest_threshold_note(_make_threshold(threshold=0.0, operator=">"))

        summary = engine.evaluate(run_id="test_zero_metric")
        results = tmp_db.list_results_by_run("test_zero_metric")
        r = results[0]

        assert r.judgement == Judgement.FAIL


class TestConflictDetection:
    def test_eval_annotation_mismatch_is_conflict(self, engine, tmp_db):
        log = _make_log(ctr=0.005)
        ann = Annotation(
            annotation_id="a1",
            creative_id="c1",
            arm_name="arm_a",
            label="pass",
            annotator="tester",
            source_file="ann.csv",
        )

        engine.ingest_eval_log(log)
        engine.ingest_annotation(ann)
        engine.ingest_threshold_note(_make_threshold(threshold=0.01, operator=">="))

        summary = engine.evaluate(run_id="test_conflict")
        results = tmp_db.list_results_by_run("test_conflict")
        r = results[0]

        assert r.judgement == Judgement.CONFLICT
        assert r.is_exception is True
        assert "不一致" in r.exception_reason

    def test_preloaded_conflict_case_preserved(self, engine, tmp_db):
        log = _make_log(ctr=0.03)
        cc = ConflictCase(
            conflict_id="cc1",
            creative_id="c1",
            arm_name="arm_a",
            eval_judgement="pass",
            annotation_label="fail",
            reason="已知边界争议",
            source_file="conflicts.csv",
        )

        engine.ingest_eval_log(log)
        engine.ingest_conflict_case(cc)
        engine.ingest_threshold_note(_make_threshold(threshold=0.01, operator=">="))

        summary = engine.evaluate(run_id="test_preloaded_conflict")
        results = tmp_db.list_results_by_run("test_preloaded_conflict")
        r = results[0]

        assert r.judgement == Judgement.CONFLICT
        assert r.is_exception is True
        assert "冲突案例" in r.exception_reason


class TestEvidenceTraceability:
    def test_every_result_has_log_evidence(self, engine, tmp_db):
        log = _make_log()
        engine.ingest_eval_log(log)
        engine.ingest_threshold_note(_make_threshold())

        summary = engine.evaluate(run_id="test_trace")
        results = tmp_db.list_results_by_run("test_trace")
        r = results[0]

        log_evidence = [e for e in r.evidence_links if e.source_type == "eval_log"]
        assert len(log_evidence) >= 1
        assert log_evidence[0].source_id == "l1"
        assert log_evidence[0].source_file == "test.csv"

    def test_threshold_evidence_linked(self, engine, tmp_db):
        log = _make_log()
        engine.ingest_eval_log(log)
        engine.ingest_threshold_note(_make_threshold())

        summary = engine.evaluate(run_id="test_thresh_evidence")
        results = tmp_db.list_results_by_run("test_thresh_evidence")
        r = results[0]

        thresh_evidence = [e for e in r.evidence_links if e.source_type == "threshold_note"]
        assert len(thresh_evidence) >= 1

    def test_trace_command(self, engine, tmp_db):
        log = _make_log()
        ann = Annotation(
            annotation_id="a1",
            creative_id="c1",
            arm_name="arm_a",
            label="pass",
            annotator="tester",
            source_file="ann.csv",
        )
        engine.ingest_eval_log(log)
        engine.ingest_annotation(ann)
        engine.ingest_threshold_note(_make_threshold())

        engine.evaluate(run_id="test_trace_cmd")
        trace_data = engine.trace("c1", "arm_a", run_id="test_trace_cmd")

        assert trace_data is not None
        assert trace_data["result"] is not None
        assert trace_data["source_log"] is not None
        assert trace_data["annotation"] is not None


class TestExceptionNotDisappearing:
    def test_exceptions_in_summary(self, engine, tmp_db):
        log1 = _make_log(log_id="l1", creative_id="c1", arm_name="arm_a", ctr=None)
        log2 = _make_log(log_id="l2", creative_id="c2", arm_name="arm_a", ctr=0.03)

        engine.ingest_eval_log(log1)
        engine.ingest_eval_log(log2)
        engine.ingest_threshold_note(_make_threshold())

        summary = engine.evaluate(run_id="test_exception_count")
        assert summary.exception_count >= 1

        results = tmp_db.list_results_by_run("test_exception_count")
        exceptions = [r for r in results if r.is_exception]
        assert len(exceptions) >= 1

        for exc in exceptions:
            assert exc.exception_reason != ""

    def test_conflict_count_in_summary(self, engine, tmp_db):
        cc = ConflictCase(
            conflict_id="cc1",
            creative_id="c1",
            arm_name="arm_a",
            eval_judgement="pass",
            annotation_label="fail",
            reason="test",
        )
        log = _make_log()
        engine.ingest_eval_log(log)
        engine.ingest_conflict_case(cc)
        engine.ingest_threshold_note(_make_threshold())

        summary = engine.evaluate(run_id="test_conflict_count")
        assert summary.conflict_count >= 1


class TestRerunDiff:
    def test_rerun_separates_metric_and_sample_changes(self, engine, tmp_db):
        log1 = _make_log(log_id="l1", creative_id="c1", arm_name="arm_a", ctr=0.02)
        engine.ingest_eval_log(log1)
        engine.ingest_threshold_note(_make_threshold())
        engine.evaluate(run_id="run_1")

        tmp_db.upsert_eval_log(
            EvalLog(
                log_id="l1",
                creative_id="c1",
                arm_name="arm_a",
                impressions=50000,
                clicks=1000,
                conversions=50.0,
                revenue=500.0,
                ctr=0.015,
                cvr=0.05,
                source_file="test_v2.csv",
                log_timestamp=datetime(2025, 1, 2, 12, 0, 0),
            )
        )

        engine.evaluate(run_id="run_2")

        diff = engine.rerun_diff(current_run_id="run_2", previous_run_id="run_1")
        assert diff.summary["metric_diff_count"] >= 1

    def test_rerun_new_sample(self, engine, tmp_db):
        log1 = _make_log(log_id="l1", creative_id="c1", arm_name="arm_a")
        engine.ingest_eval_log(log1)
        engine.ingest_threshold_note(_make_threshold())
        engine.evaluate(run_id="run_1")

        log2 = _make_log(log_id="l2", creative_id="c2", arm_name="arm_a")
        engine.ingest_eval_log(log2)
        engine.evaluate(run_id="run_2")

        diff = engine.rerun_diff(current_run_id="run_2", previous_run_id="run_1")
        assert diff.summary["samples_added_count"] >= 1
        assert "c2:arm_a" in diff.sample_added


class TestSourceAndTimestampPreserved:
    def test_source_file_preserved(self, engine, tmp_db):
        log = _make_log(source_file="original_eval_log.csv")
        engine.ingest_eval_log(log)
        engine.ingest_threshold_note(_make_threshold())

        engine.evaluate(run_id="test_source")
        results = tmp_db.list_results_by_run("test_source")
        r = results[0]

        assert r.source_file == "original_eval_log.csv"

    def test_ingested_at_preserved(self, engine, tmp_db):
        log = _make_log()
        engine.ingest_eval_log(log)

        stored = tmp_db.get_eval_log("l1")
        assert stored is not None
        assert stored.ingested_at is not None
        assert stored.source_file == "test.csv"
