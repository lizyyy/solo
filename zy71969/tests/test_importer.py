import json
from pathlib import Path

import pytest

from offline_eval_trace.engine.importer import Importer, ImportResult
from offline_eval_trace.models import (
    DatasetVersion,
    EvaluationResult,
    Experiment,
    ImportType,
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


@pytest.fixture
def importer(store: Store) -> Importer:
    return Importer(store)


def _write_json(path: Path, data: dict) -> Path:
    path.write_text(json.dumps(data))
    return path


class TestImporterNew:
    def test_import_new_experiment(self, importer: Importer, tmp_path: Path):
        ds_path = _write_json(tmp_path / "ds.json", {"sample_count": 500})
        result = importer.import_from_files(
            name="exp_new",
            round_tag="W23",
            dataset_path=ds_path,
        )
        assert result.is_new
        assert result.exp_id > 0

    def test_import_with_all_components(self, importer: Importer, tmp_path: Path):
        ds_path = _write_json(tmp_path / "ds.json", {"sample_count": 100, "label_schema": {"a": 0}, "sample_range": {"split": "test"}})
        script_path = tmp_path / "eval.py"
        script_path.write_text("def evaluate(): pass")
        config_path = _write_json(tmp_path / "config.json", {"thresholds": {"f1": 0.8}})
        results_path = _write_json(tmp_path / "results.json", [{"metric_name": "f1", "metric_value": 0.85}])
        excluded_path = _write_json(tmp_path / "excluded.json", [{"sample_ids": ["s1", "s2"], "reason": "标注返工"}])

        result = importer.import_from_files(
            name="full_exp",
            dataset_path=ds_path,
            script_path=script_path,
            script_version_tag="v1",
            config_path=config_path,
            results_path=results_path,
            excluded_path=excluded_path,
        )

        assert result.is_new
        exp = importer.store.load_experiment("full_exp")
        assert exp is not None
        assert exp.dataset.sample_count == 100
        assert exp.metric_script.script_version_tag == "v1"
        assert exp.threshold_config.thresholds == {"f1": 0.8}
        assert len(exp.results) == 1
        assert exp.results[0].metric_value == 0.85
        assert len(exp.excluded_samples) == 1
        assert exp.excluded_samples[0].reason == "标注返工"


class TestImporterDuplicate:
    def test_reimport_note_only(self, importer: Importer):
        exp1 = Experiment(name="dup_exp", note="first note")
        importer.import_experiment(exp1)

        exp2 = Experiment(name="dup_exp", note="updated note")
        result = importer.import_experiment(exp2)

        assert result.is_note_only
        assert result.import_type == ImportType.RE_IMPORT_NOTE

    def test_reimport_config_change(self, importer: Importer):
        ds1 = DatasetVersion(dataset_name="d", version_hash="h1", source_path="/d", sample_count=100)
        exp1 = Experiment(name="cfg_exp", dataset=ds1)
        importer.import_experiment(exp1)

        ds2 = DatasetVersion(dataset_name="d", version_hash="h2", source_path="/d", sample_count=200)
        exp2 = Experiment(name="cfg_exp", dataset=ds2)
        result = importer.import_experiment(exp2)

        assert result.is_config_change
        assert any(c.field.startswith("dataset") for c in result.changes)

    def test_reimport_identifies_config_vs_note(self, importer: Importer):
        tc1 = ThresholdConfig(config_path="/c", config_hash="h1", thresholds={"f1": 0.8})
        exp1 = Experiment(name="mixed_exp", note="v1", threshold_config=tc1)
        importer.import_experiment(exp1)

        tc2 = ThresholdConfig(config_path="/c", config_hash="h1", thresholds={"f1": 0.9})
        exp2 = Experiment(name="mixed_exp", note="v2", threshold_config=tc2)
        result = importer.import_experiment(exp2)

        assert result.is_config_change

    def test_import_result_summary(self, importer: Importer):
        exp = Experiment(name="summary_exp")
        result = importer.import_experiment(exp)
        assert "新建实验" in result.summary()

    def test_reimport_no_change(self, importer: Importer):
        exp = Experiment(name="same_exp", note="same")
        r1 = importer.import_experiment(exp)
        r2 = importer.import_experiment(exp)
        assert r1.is_new
        assert not r2.is_new


class TestImporterFromFiles:
    def test_missing_files_ok(self, importer: Importer):
        result = importer.import_from_files(name="empty_exp")
        assert result.is_new

    def test_nonexistent_results_returns_empty(self, importer: Importer, tmp_path: Path):
        result = importer.import_from_files(
            name="exp_no_results",
            results_path=tmp_path / "nonexistent.json",
        )
        assert result.is_new
        exp = importer.store.load_experiment("exp_no_results")
        assert exp.results == []
