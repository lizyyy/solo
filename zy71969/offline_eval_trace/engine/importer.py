from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from ..models import (
    DatasetVersion,
    EvaluationResult,
    Experiment,
    ExcludedSample,
    ImportChange,
    ImportType,
    MetricScript,
    ThresholdConfig,
)
from ..store import Store


class ImportResult:
    def __init__(
        self,
        exp_id: int,
        import_type: ImportType,
        changes: Optional[List[ImportChange]] = None,
    ) -> None:
        self.exp_id = exp_id
        self.import_type = import_type
        self.changes = changes or []

    @property
    def is_new(self) -> bool:
        return self.import_type == ImportType.NEW

    @property
    def is_config_change(self) -> bool:
        return self.import_type == ImportType.RE_IMPORT_CONFIG

    @property
    def is_note_only(self) -> bool:
        return self.import_type == ImportType.RE_IMPORT_NOTE

    def summary(self) -> str:
        if self.is_new:
            return f"新建实验 (id={self.exp_id})"
        if self.is_config_change:
            fields = ", ".join(c.field for c in self.changes)
            return f"重复导入 - 配置变更 ({fields})"
        if self.is_note_only:
            return f"重复导入 - 仅备注更新"
        return f"重复导入 (id={self.exp_id})"


class Importer:
    def __init__(self, store: Store) -> None:
        self.store = store

    def import_from_files(
        self,
        name: str,
        round_tag: str = "",
        note: str = "",
        dataset_path: Optional[Union[Path, str]] = None,
        dataset_name: Optional[str] = None,
        script_path: Optional[Union[Path, str]] = None,
        script_version_tag: str = "",
        script_parameters: Optional[Dict] = None,
        config_path: Optional[Union[Path, str]] = None,
        results_path: Optional[Union[Path, str]] = None,
        excluded_path: Optional[Union[Path, str]] = None,
    ) -> ImportResult:
        dataset = None
        if dataset_path:
            dataset = DatasetVersion.from_file(Path(dataset_path), name=dataset_name)

        metric_script = None
        if script_path:
            metric_script = MetricScript.from_file(
                Path(script_path), version_tag=script_version_tag, parameters=script_parameters
            )

        threshold_config = None
        if config_path:
            threshold_config = ThresholdConfig.from_file(Path(config_path))

        excluded_samples: List[ExcludedSample] = []
        if excluded_path:
            excluded_samples = self._load_excluded(Path(excluded_path))

        results: List[EvaluationResult] = []
        if results_path:
            results = self._load_results(Path(results_path))

        exp = Experiment(
            name=name,
            round_tag=round_tag,
            note=note,
            dataset=dataset,
            metric_script=metric_script,
            threshold_config=threshold_config,
            excluded_samples=excluded_samples,
            results=results,
        )

        existing = self.store.load_experiment(name)
        if existing is None:
            exp_id = self.store.save_experiment(exp)
            return ImportResult(exp_id, ImportType.NEW)

        changes = self.store._diff_experiments(existing, exp)
        config_changed = existing.config_fingerprint() != exp.config_fingerprint()
        note_changed = existing.note_fingerprint() != exp.note_fingerprint()

        if not changes:
            return ImportResult(
                self.store.save_experiment(existing),
                ImportType.RE_IMPORT_NOTE,
                [],
            )

        if config_changed:
            import_type = ImportType.RE_IMPORT_CONFIG
        else:
            import_type = ImportType.RE_IMPORT_NOTE

        exp_id = self.store.save_experiment(exp)
        return ImportResult(exp_id, import_type, changes)

    def import_experiment(self, exp: Experiment) -> ImportResult:
        existing = self.store.load_experiment(exp.name)
        if existing is None:
            exp_id = self.store.save_experiment(exp)
            return ImportResult(exp_id, ImportType.NEW)

        changes = self.store._diff_experiments(existing, exp)
        config_changed = existing.config_fingerprint() != exp.config_fingerprint()
        note_changed = existing.note_fingerprint() != exp.note_fingerprint()

        if not changes:
            return ImportResult(
                self.store.save_experiment(existing),
                ImportType.RE_IMPORT_NOTE,
                [],
            )

        if config_changed:
            import_type = ImportType.RE_IMPORT_CONFIG
        else:
            import_type = ImportType.RE_IMPORT_NOTE

        exp_id = self.store.save_experiment(exp)
        return ImportResult(exp_id, import_type, changes)

    @staticmethod
    def _load_excluded(path: Path) -> List[ExcludedSample]:
        if not path.exists():
            return []
        data = json.loads(path.read_text())
        if isinstance(data, list):
            return [ExcludedSample(**item) for item in data]
        return [ExcludedSample(**data)]

    @staticmethod
    def _load_results(path: Path) -> List[EvaluationResult]:
        if not path.exists():
            return []
        data = json.loads(path.read_text())
        if isinstance(data, list):
            return [EvaluationResult(**item) for item in data]
        return [EvaluationResult(**data)]
