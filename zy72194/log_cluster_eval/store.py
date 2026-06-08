import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import (
    Conflict,
    ConflictResolution,
    Correction,
    EvalStatus,
    Evaluation,
    OnlineFeedback,
    Sample,
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS samples (
    sample_id TEXT PRIMARY KEY,
    raw_log TEXT NOT NULL,
    source TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    fingerprint TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluations (
    eval_id TEXT PRIMARY KEY,
    sample_id TEXT NOT NULL,
    cluster_label TEXT NOT NULL,
    root_cause TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.0,
    evidence TEXT NOT NULL DEFAULT '[]',
    model_version TEXT NOT NULL DEFAULT '',
    evaluated_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'auto',
    source TEXT NOT NULL DEFAULT 'model',
    FOREIGN KEY (sample_id) REFERENCES samples(sample_id),
    UNIQUE(sample_id, source, model_version)
);

CREATE TABLE IF NOT EXISTS corrections (
    correction_id TEXT PRIMARY KEY,
    eval_id TEXT NOT NULL,
    field_corrected TEXT NOT NULL,
    old_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    corrector TEXT NOT NULL,
    reason TEXT NOT NULL,
    corrected_at TEXT NOT NULL,
    FOREIGN KEY (eval_id) REFERENCES evaluations(eval_id)
);

CREATE TABLE IF NOT EXISTS conflicts (
    conflict_id TEXT PRIMARY KEY,
    sample_id TEXT NOT NULL,
    model_claim TEXT NOT NULL,
    imported_claim TEXT NOT NULL,
    model_evidence TEXT NOT NULL DEFAULT '[]',
    imported_evidence TEXT NOT NULL DEFAULT '[]',
    suggested_action TEXT NOT NULL DEFAULT '',
    detected_at TEXT NOT NULL,
    resolution TEXT NOT NULL DEFAULT 'pending',
    resolution_detail TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (sample_id) REFERENCES samples(sample_id)
);

CREATE TABLE IF NOT EXISTS online_feedback (
    feedback_id TEXT PRIMARY KEY,
    sample_id TEXT NOT NULL,
    feedback_type TEXT NOT NULL,
    feedback_content TEXT NOT NULL,
    reporter TEXT NOT NULL,
    reported_at TEXT NOT NULL,
    FOREIGN KEY (sample_id) REFERENCES samples(sample_id)
);

CREATE INDEX IF NOT EXISTS idx_eval_sample ON evaluations(sample_id);
CREATE INDEX IF NOT EXISTS idx_corr_eval ON corrections(eval_id);
CREATE INDEX IF NOT EXISTS idx_conflict_sample ON conflicts(sample_id);
CREATE INDEX IF NOT EXISTS idx_feedback_sample ON online_feedback(sample_id);
CREATE INDEX IF NOT EXISTS idx_fingerprint ON samples(fingerprint);
"""


class Store:
    def __init__(self, db_path: str = "log_cluster_eval.db"):
        self.db_path = Path(db_path)
        self._conn: Optional[sqlite3.Connection] = None

    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.db_path))
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
            self._conn.executescript(_SCHEMA)
        return self._conn

    def close(self):
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    def upsert_sample(self, s: Sample) -> None:
        conn = self._get_conn()
        conn.execute(
            """INSERT INTO samples (sample_id, raw_log, source, imported_at, metadata, fingerprint)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(sample_id) DO UPDATE SET
                 raw_log=excluded.raw_log, source=excluded.source,
                 imported_at=excluded.imported_at, metadata=excluded.metadata,
                 fingerprint=excluded.fingerprint""",
            (s.sample_id, s.raw_log, s.source, s.imported_at,
             json.dumps(s.metadata, ensure_ascii=False), s.fingerprint),
        )
        conn.commit()

    def get_sample(self, sample_id: str) -> Optional[Sample]:
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM samples WHERE sample_id=?", (sample_id,)
        ).fetchone()
        if row is None:
            return None
        return Sample(
            sample_id=row["sample_id"],
            raw_log=row["raw_log"],
            source=row["source"],
            imported_at=row["imported_at"],
            metadata=json.loads(row["metadata"]),
            fingerprint=row["fingerprint"],
        )

    def find_by_fingerprint(self, fingerprint: str) -> List[Sample]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM samples WHERE fingerprint=?", (fingerprint,)
        ).fetchall()
        return [
            Sample(
                sample_id=r["sample_id"],
                raw_log=r["raw_log"],
                source=r["source"],
                imported_at=r["imported_at"],
                metadata=json.loads(r["metadata"]),
                fingerprint=r["fingerprint"],
            )
            for r in rows
        ]

    def list_samples(self, source: Optional[str] = None) -> List[Sample]:
        conn = self._get_conn()
        if source:
            rows = conn.execute(
                "SELECT * FROM samples WHERE source=? ORDER BY imported_at",
                (source,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM samples ORDER BY imported_at"
            ).fetchall()
        return [
            Sample(
                sample_id=r["sample_id"],
                raw_log=r["raw_log"],
                source=r["source"],
                imported_at=r["imported_at"],
                metadata=json.loads(r["metadata"]),
                fingerprint=r["fingerprint"],
            )
            for r in rows
        ]

    def save_evaluation(self, ev: Evaluation) -> None:
        conn = self._get_conn()
        conn.execute(
            """INSERT INTO evaluations
               (eval_id, sample_id, cluster_label, root_cause, confidence,
                evidence, model_version, evaluated_at, status, source)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(sample_id, source, model_version) DO UPDATE SET
                 cluster_label=excluded.cluster_label, root_cause=excluded.root_cause,
                 confidence=excluded.confidence, evidence=excluded.evidence,
                 evaluated_at=excluded.evaluated_at,
                 status=excluded.status""",
            (ev.eval_id, ev.sample_id, ev.cluster_label, ev.root_cause,
             ev.confidence, json.dumps([e.to_dict() for e in ev.evidence], ensure_ascii=False),
             ev.model_version, ev.evaluated_at, ev.status.value, ev.source),
        )
        conn.commit()

    @staticmethod
    def _row_to_eval_dict(row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        if isinstance(d.get("evidence"), str):
            d["evidence"] = json.loads(d["evidence"])
        return d

    def get_evaluation(self, eval_id: str) -> Optional[Evaluation]:
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM evaluations WHERE eval_id=?", (eval_id,)
        ).fetchone()
        if row is None:
            return None
        return Evaluation.from_dict(self._row_to_eval_dict(row))

    def get_evaluations_for_sample(self, sample_id: str) -> List[Evaluation]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM evaluations WHERE sample_id=? ORDER BY evaluated_at",
            (sample_id,),
        ).fetchall()
        return [Evaluation.from_dict(self._row_to_eval_dict(r)) for r in rows]

    def get_latest_evaluation(self, sample_id: str) -> Optional[Evaluation]:
        evs = self.get_evaluations_for_sample(sample_id)
        return evs[-1] if evs else None

    def find_evaluation(self, sample_id: str, source: str, model_version: str) -> Optional[Evaluation]:
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM evaluations WHERE sample_id=? AND source=? AND model_version=?",
            (sample_id, source, model_version),
        ).fetchone()
        if row is None:
            return None
        return Evaluation.from_dict(self._row_to_eval_dict(row))

    def list_evaluations(self, status: Optional[str] = None) -> List[Evaluation]:
        conn = self._get_conn()
        if status:
            rows = conn.execute(
                "SELECT * FROM evaluations WHERE status=? ORDER BY evaluated_at",
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM evaluations ORDER BY evaluated_at"
            ).fetchall()
        return [Evaluation.from_dict(self._row_to_eval_dict(r)) for r in rows]

    def save_correction(self, c: Correction) -> None:
        conn = self._get_conn()
        conn.execute(
            """INSERT INTO corrections
               (correction_id, eval_id, field_corrected, old_value, new_value,
                corrector, reason, corrected_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (c.correction_id, c.eval_id, c.field_corrected,
             c.old_value, c.new_value, c.corrector, c.reason, c.corrected_at),
        )
        conn.commit()

    def get_corrections_for_eval(self, eval_id: str) -> List[Correction]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM corrections WHERE eval_id=? ORDER BY corrected_at",
            (eval_id,),
        ).fetchall()
        return [Correction.from_dict(dict(r)) for r in rows]

    def save_conflict(self, cf: Conflict) -> None:
        conn = self._get_conn()
        conn.execute(
            """INSERT INTO conflicts
               (conflict_id, sample_id, model_claim, imported_claim,
                model_evidence, imported_evidence, suggested_action,
                detected_at, resolution, resolution_detail)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(conflict_id) DO UPDATE SET
                 resolution=excluded.resolution,
                 resolution_detail=excluded.resolution_detail""",
            (cf.conflict_id, cf.sample_id, cf.model_claim, cf.imported_claim,
             json.dumps([e.to_dict() for e in cf.model_evidence], ensure_ascii=False),
             json.dumps([e.to_dict() for e in cf.imported_evidence], ensure_ascii=False),
             cf.suggested_action, cf.detected_at, cf.resolution.value,
             cf.resolution_detail),
        )
        conn.commit()

    @staticmethod
    def _row_to_conflict_dict(row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        if isinstance(d.get("model_evidence"), str):
            d["model_evidence"] = json.loads(d["model_evidence"])
        if isinstance(d.get("imported_evidence"), str):
            d["imported_evidence"] = json.loads(d["imported_evidence"])
        return d

    def get_conflict(self, conflict_id: str) -> Optional[Conflict]:
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM conflicts WHERE conflict_id=?", (conflict_id,)
        ).fetchone()
        if row is None:
            return None
        return Conflict.from_dict(self._row_to_conflict_dict(row))

    def list_conflicts(self, resolution: Optional[str] = None) -> List[Conflict]:
        conn = self._get_conn()
        if resolution:
            rows = conn.execute(
                "SELECT * FROM conflicts WHERE resolution=? ORDER BY detected_at",
                (resolution,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM conflicts ORDER BY detected_at"
            ).fetchall()
        return [Conflict.from_dict(self._row_to_conflict_dict(r)) for r in rows]

    def save_feedback(self, fb: OnlineFeedback) -> None:
        conn = self._get_conn()
        conn.execute(
            """INSERT INTO online_feedback
               (feedback_id, sample_id, feedback_type, feedback_content,
                reporter, reported_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (fb.feedback_id, fb.sample_id, fb.feedback_type,
             fb.feedback_content, fb.reporter, fb.reported_at),
        )
        conn.commit()

    def get_feedback_for_sample(self, sample_id: str) -> List[OnlineFeedback]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM online_feedback WHERE sample_id=? ORDER BY reported_at",
            (sample_id,),
        ).fetchall()
        return [OnlineFeedback.from_dict(dict(r)) for r in rows]

    def list_feedback(self) -> List[OnlineFeedback]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM online_feedback ORDER BY reported_at"
        ).fetchall()
        return [OnlineFeedback.from_dict(dict(r)) for r in rows]
