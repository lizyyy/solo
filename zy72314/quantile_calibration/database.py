"""数据库操作层 - SQLite 持久化"""

import sqlite3
import json
import hashlib
from datetime import datetime
from typing import List, Optional, Dict, Any
from contextlib import contextmanager

from .models import (
    RatingWeightRecord, RecordHistory, ImportBatch, ReviewTask,
    BoundaryReport, WorkflowState, ProcessingStatus, BoundaryType, ChangeSource
)


def _dict_to_json(d: Dict[str, Any]) -> str:
    return json.dumps(d, ensure_ascii=False)


def _json_to_dict(s: str) -> Dict[str, Any]:
    return json.loads(s) if s else {}


class Database:
    def __init__(self, db_path: str = "quantile_calibration.db"):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self):
        with self._get_conn() as conn:
            c = conn.cursor()
            c.executescript("""
            CREATE TABLE IF NOT EXISTS import_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_hash TEXT UNIQUE,
                file_name TEXT,
                record_count INTEGER,
                imported_at TEXT,
                imported_by TEXT,
                is_deduplicated INTEGER DEFAULT 0,
                deduplication_note TEXT
            );

            CREATE TABLE IF NOT EXISTS rating_weight_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                import_batch_id INTEGER,
                original_row_number INTEGER,
                raw_data TEXT,
                current_data TEXT,
                position TEXT,
                weight_p10 REAL,
                weight_p25 REAL,
                weight_p50 REAL,
                weight_p75 REAL,
                weight_p90 REAL,
                sample_count INTEGER,
                boundary_type TEXT DEFAULT 'normal',
                status TEXT DEFAULT 'imported',
                remark TEXT,
                created_at TEXT,
                updated_at TEXT,
                created_by TEXT,
                updated_by TEXT,
                FOREIGN KEY (import_batch_id) REFERENCES import_batches(id)
            );

            CREATE TABLE IF NOT EXISTS record_histories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER,
                change_source TEXT,
                field_name TEXT,
                old_value TEXT,
                new_value TEXT,
                old_status TEXT,
                new_status TEXT,
                snapshot_before TEXT,
                snapshot_after TEXT,
                changed_by TEXT,
                change_reason TEXT,
                changed_at TEXT,
                FOREIGN KEY (record_id) REFERENCES rating_weight_records(id)
            );

            CREATE TABLE IF NOT EXISTS review_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER,
                boundary_type TEXT,
                assigned_to TEXT,
                review_note TEXT,
                review_result TEXT,
                reviewed_at TEXT,
                is_completed INTEGER DEFAULT 0,
                created_at TEXT,
                FOREIGN KEY (record_id) REFERENCES rating_weight_records(id)
            );

            CREATE TABLE IF NOT EXISTS boundary_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id INTEGER,
                generated_at TEXT,
                total_records INTEGER,
                boundary_records INTEGER,
                negative_values INTEGER,
                missing_values INTEGER,
                negative_as_missing INTEGER,
                pending_review_count INTEGER,
                report_content TEXT,
                FOREIGN KEY (batch_id) REFERENCES import_batches(id)
            );

            CREATE TABLE IF NOT EXISTS workflow_states (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id INTEGER UNIQUE,
                step_import_completed INTEGER DEFAULT 0,
                step_formula_review_completed INTEGER DEFAULT 0,
                step_boundary_report_completed INTEGER DEFAULT 0,
                current_step INTEGER DEFAULT 1,
                formula_screenshot_reviewed INTEGER DEFAULT 0,
                formula_review_note TEXT,
                last_updated_at TEXT,
                FOREIGN KEY (batch_id) REFERENCES import_batches(id)
            );

            CREATE INDEX IF NOT EXISTS idx_records_batch ON rating_weight_records(import_batch_id);
            CREATE INDEX IF NOT EXISTS idx_records_status ON rating_weight_records(status);
            CREATE INDEX IF NOT EXISTS idx_records_boundary ON rating_weight_records(boundary_type);
            CREATE INDEX IF NOT EXISTS idx_history_record ON record_histories(record_id);
            CREATE INDEX IF NOT EXISTS idx_review_record ON review_tasks(record_id);
            """)

    def compute_file_hash(self, file_content: bytes) -> str:
        return hashlib.sha256(file_content).hexdigest()

    def find_existing_batch(self, file_hash: str) -> Optional[ImportBatch]:
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM import_batches WHERE file_hash = ?", (file_hash,))
            row = c.fetchone()
            if row:
                return ImportBatch(
                    id=row["id"],
                    file_hash=row["file_hash"],
                    file_name=row["file_name"],
                    record_count=row["record_count"],
                    imported_at=datetime.fromisoformat(row["imported_at"]),
                    imported_by=row["imported_by"],
                    is_deduplicated=bool(row["is_deduplicated"]),
                    deduplication_note=row["deduplication_note"]
                )
            return None

    def create_import_batch(self, batch: ImportBatch) -> int:
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("""
                INSERT INTO import_batches
                (file_hash, file_name, record_count, imported_at, imported_by,
                 is_deduplicated, deduplication_note)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                batch.file_hash, batch.file_name, batch.record_count,
                batch.imported_at.isoformat(), batch.imported_by,
                batch.is_deduplicated, batch.deduplication_note
            ))
            return c.lastrowid

    def create_rating_record(self, record: RatingWeightRecord) -> int:
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("""
                INSERT INTO rating_weight_records
                (import_batch_id, original_row_number, raw_data, current_data,
                 position, weight_p10, weight_p25, weight_p50, weight_p75, weight_p90,
                 sample_count, boundary_type, status, remark,
                 created_at, updated_at, created_by, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record.import_batch_id, record.original_row_number,
                _dict_to_json(record.raw_data), _dict_to_json(record.current_data),
                record.position, record.weight_p10, record.weight_p25,
                record.weight_p50, record.weight_p75, record.weight_p90,
                record.sample_count, record.boundary_type.value,
                record.status.value, record.remark,
                record.created_at.isoformat(), record.updated_at.isoformat(),
                record.created_by, record.updated_by
            ))
            return c.lastrowid

    def update_rating_record(self, record: RatingWeightRecord):
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("""
                UPDATE rating_weight_records SET
                    current_data = ?, position = ?, weight_p10 = ?, weight_p25 = ?,
                    weight_p50 = ?, weight_p75 = ?, weight_p90 = ?, sample_count = ?,
                    boundary_type = ?, status = ?, remark = ?, updated_at = ?, updated_by = ?
                WHERE id = ?
            """, (
                _dict_to_json(record.current_data), record.position,
                record.weight_p10, record.weight_p25, record.weight_p50,
                record.weight_p75, record.weight_p90, record.sample_count,
                record.boundary_type.value, record.status.value, record.remark,
                record.updated_at.isoformat(), record.updated_by, record.id
            ))

    def get_rating_record(self, record_id: int) -> Optional[RatingWeightRecord]:
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM rating_weight_records WHERE id = ?", (record_id,))
            row = c.fetchone()
            if row:
                return self._row_to_record(row)
            return None

    def get_records_by_batch(self, batch_id: int) -> List[RatingWeightRecord]:
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM rating_weight_records WHERE import_batch_id = ? ORDER BY original_row_number",
                      (batch_id,))
            return [self._row_to_record(row) for row in c.fetchall()]

    def get_records_by_status(self, status: ProcessingStatus) -> List[RatingWeightRecord]:
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM rating_weight_records WHERE status = ? ORDER BY id",
                      (status.value,))
            return [self._row_to_record(row) for row in c.fetchall()]

    def get_records_by_boundary(self, boundary_type: BoundaryType) -> List[RatingWeightRecord]:
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM rating_weight_records WHERE boundary_type = ? ORDER BY id",
                      (boundary_type.value,))
            return [self._row_to_record(row) for row in c.fetchall()]

    def _row_to_record(self, row: sqlite3.Row) -> RatingWeightRecord:
        return RatingWeightRecord(
            id=row["id"],
            import_batch_id=row["import_batch_id"],
            original_row_number=row["original_row_number"],
            raw_data=_json_to_dict(row["raw_data"]),
            current_data=_json_to_dict(row["current_data"]),
            position=row["position"],
            weight_p10=row["weight_p10"],
            weight_p25=row["weight_p25"],
            weight_p50=row["weight_p50"],
            weight_p75=row["weight_p75"],
            weight_p90=row["weight_p90"],
            sample_count=row["sample_count"],
            boundary_type=BoundaryType(row["boundary_type"]),
            status=ProcessingStatus(row["status"]),
            remark=row["remark"] or "",
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            created_by=row["created_by"],
            updated_by=row["updated_by"]
        )

    def add_history(self, history: RecordHistory) -> int:
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("""
                INSERT INTO record_histories
                (record_id, change_source, field_name, old_value, new_value,
                 old_status, new_status, snapshot_before, snapshot_after,
                 changed_by, change_reason, changed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                history.record_id, history.change_source.value,
                history.field_name, history.old_value, history.new_value,
                history.old_status.value if history.old_status else None,
                history.new_status.value if history.new_status else None,
                _dict_to_json(history.snapshot_before),
                _dict_to_json(history.snapshot_after),
                history.changed_by, history.change_reason,
                history.changed_at.isoformat()
            ))
            return c.lastrowid

    def get_record_histories(self, record_id: int) -> List[RecordHistory]:
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM record_histories WHERE record_id = ? ORDER BY changed_at",
                      (record_id,))
            results = []
            for row in c.fetchall():
                results.append(RecordHistory(
                    id=row["id"],
                    record_id=row["record_id"],
                    change_source=ChangeSource(row["change_source"]),
                    field_name=row["field_name"],
                    old_value=row["old_value"],
                    new_value=row["new_value"],
                    old_status=ProcessingStatus(row["old_status"]) if row["old_status"] else None,
                    new_status=ProcessingStatus(row["new_status"]) if row["new_status"] else None,
                    snapshot_before=_json_to_dict(row["snapshot_before"]),
                    snapshot_after=_json_to_dict(row["snapshot_after"]),
                    changed_by=row["changed_by"],
                    change_reason=row["change_reason"],
                    changed_at=datetime.fromisoformat(row["changed_at"])
                ))
            return results

    def compare_versions(self, record_id: int, history_id_1: int, history_id_2: int) -> Dict[str, Any]:
        histories = self.get_record_histories(record_id)
        h1 = next((h for h in histories if h.id == history_id_1), None)
        h2 = next((h for h in histories if h.id == history_id_2), None)
        if not h1 or not h2:
            return {}
        differences = {}
        all_keys = set(h1.snapshot_after.keys()) | set(h2.snapshot_after.keys())
        for key in all_keys:
            v1 = h1.snapshot_after.get(key)
            v2 = h2.snapshot_after.get(key)
            if v1 != v2:
                differences[key] = {"before": v1, "after": v2}
        return {
            "record_id": record_id,
            "version_1": history_id_1,
            "version_2": history_id_2,
            "differences": differences,
            "status_before": h1.new_status.value if h1.new_status else None,
            "status_after": h2.new_status.value if h2.new_status else None
        }

    def create_review_task(self, task: ReviewTask) -> int:
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("""
                INSERT INTO review_tasks
                (record_id, boundary_type, assigned_to, review_note,
                 review_result, reviewed_at, is_completed, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                task.record_id, task.boundary_type.value, task.assigned_to,
                task.review_note, task.review_result,
                task.reviewed_at.isoformat() if task.reviewed_at else None,
                task.is_completed, task.created_at.isoformat()
            ))
            return c.lastrowid

    def update_review_task(self, task: ReviewTask):
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("""
                UPDATE review_tasks SET
                    review_result = ?, reviewed_at = ?, is_completed = ?,
                    review_note = ?, assigned_to = ?
                WHERE id = ?
            """, (
                task.review_result,
                task.reviewed_at.isoformat() if task.reviewed_at else None,
                task.is_completed, task.review_note, task.assigned_to, task.id
            ))

    def get_pending_review_tasks(self, assigned_to: Optional[str] = None) -> List[ReviewTask]:
        with self._get_conn() as conn:
            c = conn.cursor()
            if assigned_to:
                c.execute("""
                    SELECT * FROM review_tasks
                    WHERE is_completed = 0 AND assigned_to = ?
                    ORDER BY created_at
                """, (assigned_to,))
            else:
                c.execute("""
                    SELECT * FROM review_tasks WHERE is_completed = 0 ORDER BY created_at
                """)
            results = []
            for row in c.fetchall():
                results.append(ReviewTask(
                    id=row["id"],
                    record_id=row["record_id"],
                    boundary_type=BoundaryType(row["boundary_type"]),
                    assigned_to=row["assigned_to"],
                    review_note=row["review_note"] or "",
                    review_result=row["review_result"],
                    reviewed_at=datetime.fromisoformat(row["reviewed_at"]) if row["reviewed_at"] else None,
                    is_completed=bool(row["is_completed"]),
                    created_at=datetime.fromisoformat(row["created_at"])
                ))
            return results

    def create_boundary_report(self, report: BoundaryReport) -> int:
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("""
                INSERT INTO boundary_reports
                (batch_id, generated_at, total_records, boundary_records,
                 negative_values, missing_values, negative_as_missing,
                 pending_review_count, report_content)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                report.batch_id, report.generated_at.isoformat(),
                report.total_records, report.boundary_records,
                report.negative_values, report.missing_values,
                report.negative_as_missing, report.pending_review_count,
                _dict_to_json(report.report_content)
            ))
            return c.lastrowid

    def get_boundary_report(self, report_id: int) -> Optional[BoundaryReport]:
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM boundary_reports WHERE id = ?", (report_id,))
            row = c.fetchone()
            if row:
                return BoundaryReport(
                    id=row["id"],
                    batch_id=row["batch_id"],
                    generated_at=datetime.fromisoformat(row["generated_at"]),
                    total_records=row["total_records"],
                    boundary_records=row["boundary_records"],
                    negative_values=row["negative_values"],
                    missing_values=row["missing_values"],
                    negative_as_missing=row["negative_as_missing"],
                    pending_review_count=row["pending_review_count"],
                    report_content=_json_to_dict(row["report_content"])
                )
            return None

    def init_workflow(self, batch_id: int) -> int:
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("""
                INSERT INTO workflow_states
                (batch_id, step_import_completed, step_formula_review_completed,
                 step_boundary_report_completed, current_step,
                 formula_screenshot_reviewed, formula_review_note, last_updated_at)
                VALUES (?, 1, 0, 0, 1, 0, '', ?)
            """, (batch_id, datetime.now().isoformat()))
            return c.lastrowid

    def update_workflow(self, state: WorkflowState):
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("""
                UPDATE workflow_states SET
                    step_import_completed = ?, step_formula_review_completed = ?,
                    step_boundary_report_completed = ?, current_step = ?,
                    formula_screenshot_reviewed = ?, formula_review_note = ?,
                    last_updated_at = ?
                WHERE batch_id = ?
            """, (
                state.step_import_completed, state.step_formula_review_completed,
                state.step_boundary_report_completed, state.current_step,
                state.formula_screenshot_reviewed, state.formula_review_note,
                state.last_updated_at.isoformat(), state.batch_id
            ))

    def get_workflow(self, batch_id: int) -> Optional[WorkflowState]:
        with self._get_conn() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM workflow_states WHERE batch_id = ?", (batch_id,))
            row = c.fetchone()
            if row:
                return WorkflowState(
                    id=row["id"],
                    batch_id=row["batch_id"],
                    step_import_completed=bool(row["step_import_completed"]),
                    step_formula_review_completed=bool(row["step_formula_review_completed"]),
                    step_boundary_report_completed=bool(row["step_boundary_report_completed"]),
                    current_step=row["current_step"],
                    formula_screenshot_reviewed=bool(row["formula_screenshot_reviewed"]),
                    formula_review_note=row["formula_review_note"] or "",
                    last_updated_at=datetime.fromisoformat(row["last_updated_at"])
                )
            return None
