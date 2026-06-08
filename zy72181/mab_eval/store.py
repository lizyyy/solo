from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import (
    Annotation,
    ConflictCase,
    EvalLog,
    EvalResult,
    EvidenceLink,
    Judgement,
    RerunDiff,
    RunSummary,
    Stratum,
    ThresholdNote,
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS eval_logs (
    log_id TEXT PRIMARY KEY,
    creative_id TEXT NOT NULL,
    arm_name TEXT NOT NULL,
    impressions INTEGER,
    clicks INTEGER,
    conversions REAL,
    revenue REAL,
    ctr REAL,
    cvr REAL,
    source_file TEXT NOT NULL,
    log_timestamp TEXT,
    ingested_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS annotations (
    annotation_id TEXT PRIMARY KEY,
    creative_id TEXT NOT NULL,
    arm_name TEXT NOT NULL,
    label TEXT NOT NULL,
    annotator TEXT NOT NULL,
    note TEXT DEFAULT '',
    source_file TEXT DEFAULT '',
    annotated_at TEXT,
    ingested_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS threshold_notes (
    note_id TEXT PRIMARY KEY,
    metric TEXT NOT NULL,
    operator TEXT NOT NULL,
    threshold REAL NOT NULL,
    stratum TEXT NOT NULL,
    description TEXT DEFAULT '',
    source_file TEXT DEFAULT '',
    created_at TEXT,
    ingested_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conflict_cases (
    conflict_id TEXT PRIMARY KEY,
    creative_id TEXT NOT NULL,
    arm_name TEXT NOT NULL,
    eval_judgement TEXT NOT NULL,
    annotation_label TEXT NOT NULL,
    reason TEXT NOT NULL,
    resolution TEXT,
    source_file TEXT DEFAULT '',
    detected_at TEXT,
    ingested_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS eval_results (
    result_id TEXT PRIMARY KEY,
    creative_id TEXT NOT NULL,
    arm_name TEXT NOT NULL,
    judgement TEXT NOT NULL,
    stratum TEXT NOT NULL,
    metric_values TEXT NOT NULL,
    threshold_results TEXT NOT NULL,
    evidence_links TEXT NOT NULL,
    is_duplicate INTEGER NOT NULL DEFAULT 0,
    duplicate_of TEXT,
    is_exception INTEGER NOT NULL DEFAULT 0,
    exception_reason TEXT DEFAULT '',
    run_id TEXT NOT NULL,
    source_log_id TEXT NOT NULL,
    source_file TEXT NOT NULL,
    evaluated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS run_summaries (
    run_id TEXT PRIMARY KEY,
    total_samples INTEGER NOT NULL,
    unique_samples INTEGER NOT NULL,
    duplicate_count INTEGER NOT NULL,
    null_count INTEGER NOT NULL,
    exception_count INTEGER NOT NULL,
    stratum_counts TEXT NOT NULL,
    judgement_counts TEXT NOT NULL,
    conflict_count INTEGER NOT NULL,
    evaluated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eval_logs_creative_arm
    ON eval_logs(creative_id, arm_name);

CREATE INDEX IF NOT EXISTS idx_eval_results_creative_arm
    ON eval_results(creative_id, arm_name);

CREATE INDEX IF NOT EXISTS idx_eval_results_run_id
    ON eval_results(run_id);

CREATE INDEX IF NOT EXISTS idx_annotations_creative_arm
    ON annotations(creative_id, arm_name);

CREATE INDEX IF NOT EXISTS idx_conflict_creative_arm
    ON conflict_cases(creative_id, arm_name);

CREATE TABLE IF NOT EXISTS rerun_diffs (
    current_run_id TEXT NOT NULL,
    previous_run_id TEXT NOT NULL,
    metric_diffs TEXT NOT NULL,
    sample_added TEXT NOT NULL,
    sample_removed TEXT NOT NULL,
    sample_changed TEXT NOT NULL,
    metric_only_changes TEXT NOT NULL,
    sample_only_changes TEXT NOT NULL,
    summary TEXT NOT NULL,
    computed_at TEXT NOT NULL,
    PRIMARY KEY (current_run_id, previous_run_id)
);
"""


class Store:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn: Optional[sqlite3.Connection] = None

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.db_path))
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
        return self._conn

    def initialize(self) -> None:
        self.conn.executescript(_SCHEMA)

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    # --- EvalLog ---

    def upsert_eval_log(self, log: EvalLog) -> None:
        self.conn.execute(
            """INSERT OR REPLACE INTO eval_logs
            (log_id, creative_id, arm_name, impressions, clicks, conversions,
             revenue, ctr, cvr, source_file, log_timestamp, ingested_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                log.log_id,
                log.creative_id,
                log.arm_name,
                log.impressions,
                log.clicks,
                log.conversions,
                log.revenue,
                log.ctr,
                log.cvr,
                log.source_file,
                log.log_timestamp.isoformat() if log.log_timestamp else None,
                log.ingested_at.isoformat(),
            ),
        )
        self.conn.commit()

    def get_eval_log(self, log_id: str) -> Optional[EvalLog]:
        row = self.conn.execute(
            "SELECT * FROM eval_logs WHERE log_id = ?", (log_id,)
        ).fetchone()
        if row is None:
            return None
        return self._row_to_eval_log(row)

    def find_log_by_creative_arm(self, creative_id: str, arm_name: str) -> list[EvalLog]:
        rows = self.conn.execute(
            "SELECT * FROM eval_logs WHERE creative_id = ? AND arm_name = ? ORDER BY ingested_at",
            (creative_id, arm_name),
        ).fetchall()
        return [self._row_to_eval_log(r) for r in rows]

    def list_eval_logs(self) -> list[EvalLog]:
        rows = self.conn.execute(
            "SELECT * FROM eval_logs ORDER BY ingested_at"
        ).fetchall()
        return [self._row_to_eval_log(r) for r in rows]

    def find_duplicate_fingerprints(self) -> dict[str, list[str]]:
        rows = self.conn.execute(
            """SELECT creative_id, arm_name, GROUP_CONCAT(log_id) as log_ids, COUNT(*) as cnt
            FROM eval_logs GROUP BY creative_id, arm_name HAVING cnt > 1"""
        ).fetchall()
        result: dict[str, list[str]] = {}
        for r in rows:
            key = f"{r['creative_id']}:{r['arm_name']}"
            result[key] = r["log_ids"].split(",")
        return result

    # --- Annotation ---

    def upsert_annotation(self, ann: Annotation) -> None:
        self.conn.execute(
            """INSERT OR REPLACE INTO annotations
            (annotation_id, creative_id, arm_name, label, annotator, note,
             source_file, annotated_at, ingested_at)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                ann.annotation_id,
                ann.creative_id,
                ann.arm_name,
                ann.label,
                ann.annotator,
                ann.note,
                ann.source_file,
                ann.annotated_at.isoformat() if ann.annotated_at else None,
                ann.ingested_at.isoformat(),
            ),
        )
        self.conn.commit()

    def find_annotation(self, creative_id: str, arm_name: str) -> Optional[Annotation]:
        row = self.conn.execute(
            "SELECT * FROM annotations WHERE creative_id = ? AND arm_name = ?",
            (creative_id, arm_name),
        ).fetchone()
        if row is None:
            return None
        return self._row_to_annotation(row)

    def list_annotations(self) -> list[Annotation]:
        rows = self.conn.execute(
            "SELECT * FROM annotations ORDER BY ingested_at"
        ).fetchall()
        return [self._row_to_annotation(r) for r in rows]

    # --- ThresholdNote ---

    def upsert_threshold_note(self, note: ThresholdNote) -> None:
        self.conn.execute(
            """INSERT OR REPLACE INTO threshold_notes
            (note_id, metric, operator, threshold, stratum, description,
             source_file, created_at, ingested_at)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                note.note_id,
                note.metric,
                note.operator,
                note.threshold,
                note.stratum,
                note.description,
                note.source_file,
                note.created_at.isoformat() if note.created_at else None,
                note.ingested_at.isoformat(),
            ),
        )
        self.conn.commit()

    def list_threshold_notes(self, stratum: Optional[str] = None) -> list[ThresholdNote]:
        if stratum:
            rows = self.conn.execute(
                "SELECT * FROM threshold_notes WHERE stratum = ? ORDER BY ingested_at",
                (stratum,),
            ).fetchall()
        else:
            rows = self.conn.execute(
                "SELECT * FROM threshold_notes ORDER BY ingested_at"
            ).fetchall()
        return [self._row_to_threshold_note(r) for r in rows]

    # --- ConflictCase ---

    def upsert_conflict_case(self, cc: ConflictCase) -> None:
        self.conn.execute(
            """INSERT OR REPLACE INTO conflict_cases
            (conflict_id, creative_id, arm_name, eval_judgement, annotation_label,
             reason, resolution, source_file, detected_at, ingested_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                cc.conflict_id,
                cc.creative_id,
                cc.arm_name,
                cc.eval_judgement,
                cc.annotation_label,
                cc.reason,
                cc.resolution,
                cc.source_file,
                cc.detected_at.isoformat() if cc.detected_at else None,
                cc.ingested_at.isoformat(),
            ),
        )
        self.conn.commit()

    def find_conflict(self, creative_id: str, arm_name: str) -> Optional[ConflictCase]:
        row = self.conn.execute(
            "SELECT * FROM conflict_cases WHERE creative_id = ? AND arm_name = ?",
            (creative_id, arm_name),
        ).fetchone()
        if row is None:
            return None
        return self._row_to_conflict_case(row)

    def list_conflict_cases(self) -> list[ConflictCase]:
        rows = self.conn.execute(
            "SELECT * FROM conflict_cases ORDER BY ingested_at"
        ).fetchall()
        return [self._row_to_conflict_case(r) for r in rows]

    # --- EvalResult ---

    def insert_eval_result(self, result: EvalResult) -> None:
        self.conn.execute(
            """INSERT OR REPLACE INTO eval_results
            (result_id, creative_id, arm_name, judgement, stratum,
             metric_values, threshold_results, evidence_links,
             is_duplicate, duplicate_of, is_exception, exception_reason,
             run_id, source_log_id, source_file, evaluated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                result.result_id,
                result.creative_id,
                result.arm_name,
                result.judgement.value,
                result.stratum.value,
                json.dumps(result.metric_values, ensure_ascii=False),
                json.dumps(result.threshold_results, ensure_ascii=False),
                json.dumps(
                    [
                        {
                            "source_type": e.source_type,
                            "source_id": e.source_id,
                            "source_file": e.source_file,
                            "detail": e.detail,
                        }
                        for e in result.evidence_links
                    ],
                    ensure_ascii=False,
                ),
                1 if result.is_duplicate else 0,
                result.duplicate_of,
                1 if result.is_exception else 0,
                result.exception_reason,
                result.run_id,
                result.source_log_id,
                result.source_file,
                result.evaluated_at.isoformat(),
            ),
        )
        self.conn.commit()

    def get_eval_result(self, result_id: str) -> Optional[EvalResult]:
        row = self.conn.execute(
            "SELECT * FROM eval_results WHERE result_id = ?", (result_id,)
        ).fetchone()
        if row is None:
            return None
        return self._row_to_eval_result(row)

    def list_results_by_run(self, run_id: str) -> list[EvalResult]:
        rows = self.conn.execute(
            "SELECT * FROM eval_results WHERE run_id = ? ORDER BY creative_id, arm_name",
            (run_id,),
        ).fetchall()
        return [self._row_to_eval_result(r) for r in rows]

    def find_result_by_creative_arm(
        self, creative_id: str, arm_name: str, run_id: str
    ) -> Optional[EvalResult]:
        row = self.conn.execute(
            """SELECT * FROM eval_results
            WHERE creative_id = ? AND arm_name = ? AND run_id = ?
            ORDER BY is_duplicate ASC, evaluated_at DESC""",
            (creative_id, arm_name, run_id),
        ).fetchone()
        if row is None:
            return None
        return self._row_to_eval_result(row)

    def list_run_ids(self) -> list[str]:
        rows = self.conn.execute(
            "SELECT run_id FROM run_summaries ORDER BY evaluated_at DESC"
        ).fetchall()
        return [r["run_id"] for r in rows]

    def get_latest_run_id(self) -> Optional[str]:
        ids = self.list_run_ids()
        return ids[0] if ids else None

    # --- RunSummary ---

    def insert_run_summary(self, summary: RunSummary) -> None:
        self.conn.execute(
            """INSERT OR REPLACE INTO run_summaries
            (run_id, total_samples, unique_samples, duplicate_count,
             null_count, exception_count, stratum_counts, judgement_counts,
             conflict_count, evaluated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                summary.run_id,
                summary.total_samples,
                summary.unique_samples,
                summary.duplicate_count,
                summary.null_count,
                summary.exception_count,
                json.dumps(summary.stratum_counts, ensure_ascii=False),
                json.dumps(summary.judgement_counts, ensure_ascii=False),
                summary.conflict_count,
                summary.evaluated_at.isoformat(),
            ),
        )
        self.conn.commit()

    def get_run_summary(self, run_id: str) -> Optional[RunSummary]:
        row = self.conn.execute(
            "SELECT * FROM run_summaries WHERE run_id = ?", (run_id,)
        ).fetchone()
        if row is None:
            return None
        return self._row_to_run_summary(row)

    # --- RerunDiff ---

    def insert_rerun_diff(self, diff: RerunDiff) -> None:
        self.conn.execute(
            """INSERT OR REPLACE INTO rerun_diffs
            (current_run_id, previous_run_id, metric_diffs, sample_added,
             sample_removed, sample_changed, metric_only_changes,
             sample_only_changes, summary, computed_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                diff.current_run_id,
                diff.previous_run_id,
                json.dumps(diff.metric_diffs, ensure_ascii=False),
                json.dumps(diff.sample_added, ensure_ascii=False),
                json.dumps(diff.sample_removed, ensure_ascii=False),
                json.dumps(diff.sample_changed, ensure_ascii=False),
                json.dumps(diff.metric_only_changes, ensure_ascii=False),
                json.dumps(diff.sample_only_changes, ensure_ascii=False),
                json.dumps(diff.summary, ensure_ascii=False),
                datetime.now().isoformat(),
            ),
        )
        self.conn.commit()

    def get_rerun_diff(
        self, current_run_id: str, previous_run_id: str
    ) -> Optional[RerunDiff]:
        row = self.conn.execute(
            "SELECT * FROM rerun_diffs WHERE current_run_id = ? AND previous_run_id = ?",
            (current_run_id, previous_run_id),
        ).fetchone()
        if row is None:
            return None
        return self._row_to_rerun_diff(row)

    # --- Conversion helpers ---

    @staticmethod
    def _parse_dt(val: Optional[str]) -> Optional[datetime]:
        if val is None:
            return None
        return datetime.fromisoformat(val)

    def _row_to_eval_log(self, row: sqlite3.Row) -> EvalLog:
        return EvalLog(
            log_id=row["log_id"],
            creative_id=row["creative_id"],
            arm_name=row["arm_name"],
            impressions=row["impressions"],
            clicks=row["clicks"],
            conversions=row["conversions"],
            revenue=row["revenue"],
            ctr=row["ctr"],
            cvr=row["cvr"],
            source_file=row["source_file"],
            log_timestamp=self._parse_dt(row["log_timestamp"]),
            ingested_at=self._parse_dt(row["ingested_at"]) or datetime.now(),
        )

    def _row_to_annotation(self, row: sqlite3.Row) -> Annotation:
        return Annotation(
            annotation_id=row["annotation_id"],
            creative_id=row["creative_id"],
            arm_name=row["arm_name"],
            label=row["label"],
            annotator=row["annotator"],
            note=row["note"],
            source_file=row["source_file"],
            annotated_at=self._parse_dt(row["annotated_at"]),
            ingested_at=self._parse_dt(row["ingested_at"]) or datetime.now(),
        )

    def _row_to_threshold_note(self, row: sqlite3.Row) -> ThresholdNote:
        return ThresholdNote(
            note_id=row["note_id"],
            metric=row["metric"],
            operator=row["operator"],
            threshold=row["threshold"],
            stratum=row["stratum"],
            description=row["description"],
            source_file=row["source_file"],
            created_at=self._parse_dt(row["created_at"]),
            ingested_at=self._parse_dt(row["ingested_at"]) or datetime.now(),
        )

    def _row_to_conflict_case(self, row: sqlite3.Row) -> ConflictCase:
        return ConflictCase(
            conflict_id=row["conflict_id"],
            creative_id=row["creative_id"],
            arm_name=row["arm_name"],
            eval_judgement=row["eval_judgement"],
            annotation_label=row["annotation_label"],
            reason=row["reason"],
            resolution=row["resolution"],
            source_file=row["source_file"],
            detected_at=self._parse_dt(row["detected_at"]),
            ingested_at=self._parse_dt(row["ingested_at"]) or datetime.now(),
        )

    def _row_to_eval_result(self, row: sqlite3.Row) -> EvalResult:
        evidence_data = json.loads(row["evidence_links"])
        evidence_links = [
            EvidenceLink(
                source_type=e["source_type"],
                source_id=e["source_id"],
                source_file=e["source_file"],
                detail=e.get("detail", ""),
            )
            for e in evidence_data
        ]
        return EvalResult(
            result_id=row["result_id"],
            creative_id=row["creative_id"],
            arm_name=row["arm_name"],
            judgement=Judgement(row["judgement"]),
            stratum=Stratum(row["stratum"]),
            metric_values=json.loads(row["metric_values"]),
            threshold_results=json.loads(row["threshold_results"]),
            evidence_links=evidence_links,
            is_duplicate=bool(row["is_duplicate"]),
            duplicate_of=row["duplicate_of"],
            is_exception=bool(row["is_exception"]),
            exception_reason=row["exception_reason"],
            run_id=row["run_id"],
            source_log_id=row["source_log_id"],
            source_file=row["source_file"],
            evaluated_at=self._parse_dt(row["evaluated_at"]) or datetime.now(),
        )

    def _row_to_run_summary(self, row: sqlite3.Row) -> RunSummary:
        return RunSummary(
            run_id=row["run_id"],
            total_samples=row["total_samples"],
            unique_samples=row["unique_samples"],
            duplicate_count=row["duplicate_count"],
            null_count=row["null_count"],
            exception_count=row["exception_count"],
            stratum_counts=json.loads(row["stratum_counts"]),
            judgement_counts=json.loads(row["judgement_counts"]),
            conflict_count=row["conflict_count"],
            evaluated_at=self._parse_dt(row["evaluated_at"]) or datetime.now(),
        )

    def _row_to_rerun_diff(self, row: sqlite3.Row) -> RerunDiff:
        return RerunDiff(
            current_run_id=row["current_run_id"],
            previous_run_id=row["previous_run_id"],
            metric_diffs=json.loads(row["metric_diffs"]),
            sample_added=json.loads(row["sample_added"]),
            sample_removed=json.loads(row["sample_removed"]),
            sample_changed=json.loads(row["sample_changed"]),
            metric_only_changes=json.loads(row["metric_only_changes"]),
            sample_only_changes=json.loads(row["sample_only_changes"]),
            summary=json.loads(row["summary"]),
        )
