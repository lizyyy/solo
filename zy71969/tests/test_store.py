import json
from pathlib import Path

import pytest

from offline_eval_trace.models import (
    DatasetVersion,
    EvaluationResult,
    Experiment,
    ExcludedSample,
    MetricScript,
    ThresholdConfig,
)
from offline_eval_trace.store import Store


@pytest.fixture
def store(tmp_path: Path) -> Store:
    db = tmp_path / "test.db"
    s = Store(db)
    yield s
    s.close()


def _make_exp(name: str = "test_exp", **kwargs) -> Experiment:
    defaults = {
        "round_tag": "2024-W23",
        "note": "initial",
    }
    defaults.update(kwargs)
    return Experiment(name=name, **defaults)


class TestStoreSaveAndLoad:
    def test_save_new_and_load(self, store: Store):
        exp = _make_exp()
        exp_id = store.save_experiment(exp)
        assert exp_id > 0

        loaded = store.load_experiment("test_exp")
        assert loaded is not None
        assert loaded.name == "test_exp"
        assert loaded.round_tag == "2024-W23"

    def test_load_nonexistent(self, store: Store):
        assert store.load_experiment("no_such") is None

    def test_load_by_id(self, store: Store):
        exp = _make_exp()
        exp_id = store.save_experiment(exp)
        loaded = store.load_experiment_by_id(exp_id)
        assert loaded is not None
        assert loaded.name == "test_exp"

    def test_load_by_id_nonexistent(self, store: Store):
        assert store.load_experiment_by_id(9999) is None


class TestStoreDuplicateImport:
    def test_reimport_no_change(self, store: Store):
        exp = _make_exp()
        id1 = store.save_experiment(exp)
        id2 = store.save_experiment(exp)
        assert id1 == id2

    def test_reimport_note_only(self, store: Store):
        exp1 = _make_exp(note="old note")
        id1 = store.save_experiment(exp1)

        exp2 = _make_exp(note="new note")
        id2 = store.save_experiment(exp2)
        assert id1 == id2

        loaded = store.load_experiment("test_exp")
        assert loaded.note == "new note"

    def test_reimport_config_change(self, store: Store):
        ds1 = DatasetVersion(dataset_name="d", version_hash="h1", source_path="/d", sample_count=100)
        exp1 = _make_exp(dataset=ds1)
        id1 = store.save_experiment(exp1)

        ds2 = DatasetVersion(dataset_name="d", version_hash="h2", source_path="/d", sample_count=200)
        exp2 = _make_exp(dataset=ds2)
        id2 = store.save_experiment(exp2)
        assert id1 == id2

        loaded = store.load_experiment("test_exp")
        assert loaded.dataset.version_hash == "h2"
        assert loaded.dataset.sample_count == 200


class TestStoreListExperiments:
    def test_list_all(self, store: Store):
        store.save_experiment(_make_exp("exp_a"))
        store.save_experiment(_make_exp("exp_b"))
        exps = store.list_experiments()
        assert len(exps) == 2

    def test_list_by_round_tag(self, store: Store):
        store.save_experiment(_make_exp("exp_a", round_tag="W23"))
        store.save_experiment(_make_exp("exp_b", round_tag="W24"))
        exps = store.list_experiments(round_tag="W23")
        assert len(exps) == 1
        assert exps[0].name == "exp_a"


class TestStoreImportHistory:
    def test_import_history_records_new(self, store: Store):
        store.save_experiment(_make_exp())
        history = store.get_import_history("test_exp")
        assert len(history) == 1
        assert history[0]["import_type"] == "new"

    def test_import_history_records_changes(self, store: Store):
        store.save_experiment(_make_exp(note="v1"))
        store.save_experiment(_make_exp(note="v2"))
        history = store.get_import_history("test_exp")
        assert len(history) == 2
        assert history[0]["import_type"] == "re_import_note"

    def test_import_history_nonexistent(self, store: Store):
        assert store.get_import_history("no_such") == []


class TestStoreDiffExperiments:
    def test_diff_note_change(self, store: Store):
        old = _make_exp(note="old")
        new = _make_exp(note="new")
        changes = store._diff_experiments(old, new)
        assert len(changes) == 1
        assert changes[0].field == "note"

    def test_diff_dataset_change(self, store: Store):
        ds1 = DatasetVersion(dataset_name="d", version_hash="h1", source_path="/d", sample_count=100)
        ds2 = DatasetVersion(dataset_name="d", version_hash="h2", source_path="/d", sample_count=200)
        old = _make_exp(dataset=ds1)
        new = _make_exp(dataset=ds2)
        changes = store._diff_experiments(old, new)
        assert any(c.field == "dataset.version_hash" for c in changes)
        assert any(c.field == "dataset.sample_count" for c in changes)

    def test_diff_no_change(self, store: Store):
        exp = _make_exp()
        changes = store._diff_experiments(exp, exp)
        assert len(changes) == 0

    def test_diff_threshold_change(self, store: Store):
        tc1 = ThresholdConfig(config_path="/c", config_hash="h1", thresholds={"f1": 0.8})
        tc2 = ThresholdConfig(config_path="/c", config_hash="h1", thresholds={"f1": 0.9})
        old = _make_exp(threshold_config=tc1)
        new = _make_exp(threshold_config=tc2)
        changes = store._diff_experiments(old, new)
        assert any(c.field == "threshold_config.thresholds" for c in changes)

    def test_diff_script_added(self, store: Store):
        old = _make_exp()
        ms = MetricScript(script_path="/s", script_hash="h1")
        new = _make_exp(metric_script=ms)
        changes = store._diff_experiments(old, new)
        assert any(c.field == "metric_script" for c in changes)
