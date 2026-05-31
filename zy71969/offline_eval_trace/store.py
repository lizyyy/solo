from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from .models import (
    DatasetVersion,
    EvaluationResult,
    ExcludedSample,
    Experiment,
    ExperimentStatus,
    ImportChange,
    ImportType,
    MetricScript,
    SampleRange,
    ThresholdConfig,
    VerificationIssue,
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS experiments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    round_tag TEXT DEFAULT '',
    note TEXT DEFAULT '',
    status TEXT DEFAULT 'draft',
    config_fingerprint TEXT NOT NULL,
    note_fingerprint TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL,
    import_type TEXT NOT NULL,
    import_time TEXT NOT NULL,
    changes_json TEXT DEFAULT '[]',
    FOREIGN KEY (experiment_id) REFERENCES experiments(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exp_name ON experiments(name);
CREATE INDEX IF NOT EXISTS idx_exp_fingerprint ON experiments(config_fingerprint);
CREATE INDEX IF NOT EXISTS idx_exp_round ON experiments(round_tag);
"""


class Store:
    def __init__(self, db_path: Union[str, Path] = "eval_trace.db") -> None:
        self.db_path = Path(db_path)
        self._conn: Optional[sqlite3.Connection] = None

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.db_path))
            self._conn.row_factory = sqlite3.Row
            self._conn.executescript(_SCHEMA)
        return self._conn

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    def save_experiment(self, exp: Experiment) -> int:
        data_json = exp.model_dump_json()
        config_fp = exp.config_fingerprint()
        note_fp = exp.note_fingerprint()
        now = datetime.now().isoformat()

        row = self.conn.execute(
            "SELECT id, data_json FROM experiments WHERE name = ?",
            (exp.name,),
        ).fetchone()

        if row is None:
            cur = self.conn.execute(
                "INSERT INTO experiments (name, round_tag, note, status, config_fingerprint, note_fingerprint, created_at, updated_at, data_json) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (exp.name, exp.round_tag, exp.note, exp.status.value, config_fp, note_fp, now, now, data_json),
            )
            exp_id = cur.lastrowid
            self._log_import(exp_id, ImportType.NEW, [])
            self.conn.commit()
            return exp_id

        existing = Experiment.model_validate_json(row["data_json"])
        existing_id = row["id"]

        config_changed = existing.config_fingerprint() != config_fp
        note_changed = existing.note_fingerprint() != note_fp

        changes: List[ImportChange] = self._diff_experiments(existing, exp)

        if not changes:
            self.conn.commit()
            return existing_id

        if config_changed:
            import_type = ImportType.RE_IMPORT_CONFIG
        elif note_changed:
            import_type = ImportType.RE_IMPORT_NOTE
        else:
            import_type = ImportType.RE_IMPORT_NOTE

        self.conn.execute(
            "UPDATE experiments SET round_tag=?, note=?, status=?, config_fingerprint=?, note_fingerprint=?, "
            "updated_at=?, data_json=? WHERE id=?",
            (exp.round_tag, exp.note, exp.status.value, config_fp, note_fp, now, data_json, existing_id),
        )
        self._log_import(existing_id, import_type, changes)
        self.conn.commit()
        return existing_id

    def load_experiment(self, name: str) -> Optional[Experiment]:
        row = self.conn.execute(
            "SELECT data_json FROM experiments WHERE name = ?",
            (name,),
        ).fetchone()
        if row is None:
            return None
        return Experiment.model_validate_json(row["data_json"])

    def load_experiment_by_id(self, exp_id: int) -> Optional[Experiment]:
        row = self.conn.execute(
            "SELECT data_json FROM experiments WHERE id = ?",
            (exp_id,),
        ).fetchone()
        if row is None:
            return None
        return Experiment.model_validate_json(row["data_json"])

    def list_experiments(self, round_tag: Optional[str] = None) -> List[Experiment]:
        if round_tag:
            rows = self.conn.execute(
                "SELECT data_json FROM experiments WHERE round_tag = ? ORDER BY updated_at DESC",
                (round_tag,),
            ).fetchall()
        else:
            rows = self.conn.execute(
                "SELECT data_json FROM experiments ORDER BY updated_at DESC"
            ).fetchall()
        return [Experiment.model_validate_json(r["data_json"]) for r in rows]

    def get_import_history(self, name: str) -> List[Dict[str, Any]]:
        row = self.conn.execute(
            "SELECT id FROM experiments WHERE name = ?", (name,)
        ).fetchone()
        if row is None:
            return []
        rows = self.conn.execute(
            "SELECT import_type, import_time, changes_json FROM import_logs "
            "WHERE experiment_id = ? ORDER BY import_time DESC",
            (row["id"],),
        ).fetchall()
        result = []
        for r in rows:
            result.append({
                "import_type": r["import_type"],
                "import_time": r["import_time"],
                "changes": json.loads(r["changes_json"]),
            })
        return result

    def _log_import(self, exp_id: int, import_type: ImportType, changes: List[ImportChange]) -> None:
        changes_json = json.dumps([c.model_dump() for c in changes], default=str)
        self.conn.execute(
            "INSERT INTO import_logs (experiment_id, import_type, import_time, changes_json) VALUES (?, ?, ?, ?)",
            (exp_id, import_type.value, datetime.now().isoformat(), changes_json),
        )

    def _diff_experiments(self, old: Experiment, new: Experiment) -> List[ImportChange]:
        changes: List[ImportChange] = []

        if old.note != new.note:
            changes.append(ImportChange(field="note", old_value=old.note, new_value=new.note))
        if old.round_tag != new.round_tag:
            changes.append(ImportChange(field="round_tag", old_value=old.round_tag, new_value=new.round_tag))

        if old.dataset and new.dataset:
            if old.dataset.version_hash != new.dataset.version_hash:
                changes.append(ImportChange(field="dataset.version_hash", old_value=old.dataset.version_hash, new_value=new.dataset.version_hash))
            if old.dataset.sample_count != new.dataset.sample_count:
                changes.append(ImportChange(field="dataset.sample_count", old_value=old.dataset.sample_count, new_value=new.dataset.sample_count))
            if old.dataset.label_schema != new.dataset.label_schema:
                changes.append(ImportChange(field="dataset.label_schema", old_value=old.dataset.label_schema, new_value=new.dataset.label_schema))
            if old.dataset.sample_range != new.dataset.sample_range:
                changes.append(ImportChange(field="dataset.sample_range", old_value=old.dataset.sample_range.model_dump(), new_value=new.dataset.sample_range.model_dump()))
        elif not old.dataset and new.dataset:
            changes.append(ImportChange(field="dataset", old_value=None, new_value=new.dataset.model_dump()))
        elif old.dataset and not new.dataset:
            changes.append(ImportChange(field="dataset", old_value=old.dataset.model_dump(), new_value=None))

        if old.metric_script and new.metric_script:
            if old.metric_script.script_hash != new.metric_script.script_hash:
                changes.append(ImportChange(field="metric_script.script_hash", old_value=old.metric_script.script_hash, new_value=new.metric_script.script_hash))
            if old.metric_script.parameters != new.metric_script.parameters:
                changes.append(ImportChange(field="metric_script.parameters", old_value=old.metric_script.parameters, new_value=new.metric_script.parameters))
        elif not old.metric_script and new.metric_script:
            changes.append(ImportChange(field="metric_script", old_value=None, new_value=new.metric_script.model_dump()))
        elif old.metric_script and not new.metric_script:
            changes.append(ImportChange(field="metric_script", old_value=old.metric_script.model_dump(), new_value=None))

        if old.threshold_config and new.threshold_config:
            if old.threshold_config.config_hash != new.threshold_config.config_hash:
                changes.append(ImportChange(field="threshold_config.config_hash", old_value=old.threshold_config.config_hash, new_value=new.threshold_config.config_hash))
            if old.threshold_config.thresholds != new.threshold_config.thresholds:
                changes.append(ImportChange(field="threshold_config.thresholds", old_value=old.threshold_config.thresholds, new_value=new.threshold_config.thresholds))
            if old.threshold_config.custom_rules != new.threshold_config.custom_rules:
                changes.append(ImportChange(field="threshold_config.custom_rules", old_value=old.threshold_config.custom_rules, new_value=new.threshold_config.custom_rules))
        elif not old.threshold_config and new.threshold_config:
            changes.append(ImportChange(field="threshold_config", old_value=None, new_value=new.threshold_config.model_dump()))
        elif old.threshold_config and not new.threshold_config:
            changes.append(ImportChange(field="threshold_config", old_value=old.threshold_config.model_dump(), new_value=None))

        return changes
