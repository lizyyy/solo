from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import Annotation, ChangeRecord, ImportBatch
from .rules import ReviewStatus, AnnotationSource


DEFAULT_DB_PATH = Path.home() / ".rxtj" / "rxtj.db"

_LATEST_ANNOTATION_COLUMNS = [
    ("review_reason", "TEXT NOT NULL DEFAULT ''"),
    ("next_contact", "TEXT NOT NULL DEFAULT ''"),
    ("reviewed_by", "TEXT NOT NULL DEFAULT ''"),
    ("reviewed_at", "TEXT NOT NULL DEFAULT ''"),
]


class Store:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = Path(db_path) if db_path else DEFAULT_DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn: Optional[sqlite3.Connection] = None
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.db_path))
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def _init_db(self):
        conn = self._get_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS annotations (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                original_line_number INTEGER NOT NULL,
                original_value TEXT NOT NULL DEFAULT '',
                current_value TEXT NOT NULL DEFAULT '',
                item_name TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT '',
                denominator_raw TEXT NOT NULL DEFAULT '',
                numerator_raw TEXT NOT NULL DEFAULT '',
                is_edge_case INTEGER NOT NULL DEFAULT 0,
                edge_case_type TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                import_batch_id TEXT,
                review_reason TEXT NOT NULL DEFAULT '',
                next_contact TEXT NOT NULL DEFAULT '',
                reviewed_by TEXT NOT NULL DEFAULT '',
                reviewed_at TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS change_records (
                id TEXT PRIMARY KEY,
                annotation_id TEXT NOT NULL,
                field_name TEXT NOT NULL,
                old_value TEXT NOT NULL DEFAULT '',
                new_value TEXT NOT NULL DEFAULT '',
                changed_by TEXT NOT NULL DEFAULT '',
                reason TEXT NOT NULL DEFAULT '',
                import_batch_id TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY (annotation_id) REFERENCES annotations(id)
            );

            CREATE TABLE IF NOT EXISTS import_batches (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                total_rows INTEGER NOT NULL DEFAULT 0,
                new_count INTEGER NOT NULL DEFAULT 0,
                unchanged_count INTEGER NOT NULL DEFAULT 0,
                changed_count INTEGER NOT NULL DEFAULT 0,
                skipped_duplicate_count INTEGER NOT NULL DEFAULT 0,
                flagged_count INTEGER NOT NULL DEFAULT 0,
                rolled_back INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_annotations_source ON annotations(source);
            CREATE INDEX IF NOT EXISTS idx_annotations_status ON annotations(status);
            CREATE INDEX IF NOT EXISTS idx_annotations_item ON annotations(item_name);
            CREATE INDEX IF NOT EXISTS idx_changes_annotation ON change_records(annotation_id);
            CREATE INDEX IF NOT EXISTS idx_changes_batch ON change_records(import_batch_id);
        """)
        self._migrate_annotations_schema(conn)
        conn.commit()

    def _migrate_annotations_schema(self, conn: sqlite3.Connection) -> None:
        cur = conn.execute("PRAGMA table_info(annotations)")
        existing = {row[1] for row in cur.fetchall()}
        for col_name, col_def in _LATEST_ANNOTATION_COLUMNS:
            if col_name not in existing:
                conn.execute(f"ALTER TABLE annotations ADD COLUMN {col_name} {col_def}")

    def save_annotation(self, ann: Annotation, batch_id: str = "") -> None:
        conn = self._get_conn()
        ann.updated_at = datetime.now().isoformat()
        conn.execute(
            """INSERT OR REPLACE INTO annotations
               (id, source, original_line_number, original_value, current_value,
                item_name, category, denominator_raw, numerator_raw,
                is_edge_case, edge_case_type, status, import_batch_id,
                review_reason, next_contact, reviewed_by, reviewed_at,
                created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (ann.id, ann.source.value, ann.original_line_number, ann.original_value,
             ann.current_value, ann.item_name, ann.category,
             ann.denominator_raw, ann.numerator_raw,
             int(ann.is_edge_case), ann.edge_case_type, ann.status.value,
             batch_id or ann.import_batch_id,
             ann.review_reason, ann.next_contact, ann.reviewed_by, ann.reviewed_at,
             ann.created_at, ann.updated_at),
        )
        conn.commit()

    def get_annotation(self, ann_id: str) -> Optional[Annotation]:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM annotations WHERE id = ?", (ann_id,)).fetchone()
        if row is None:
            return None
        return self._row_to_annotation(row)

    def find_annotation_by_line(self, line_number: int, source: AnnotationSource) -> Optional[Annotation]:
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM annotations WHERE original_line_number = ? AND source = ?",
            (line_number, source.value),
        ).fetchone()
        if row is None:
            return None
        return self._row_to_annotation(row)

    def list_annotations(self, status: Optional[ReviewStatus] = None,
                         source: Optional[AnnotationSource] = None) -> list[Annotation]:
        conn = self._get_conn()
        query = "SELECT * FROM annotations WHERE 1=1"
        params: list = []
        if status:
            query += " AND status = ?"
            params.append(status.value)
        if source:
            query += " AND source = ?"
            params.append(source.value)
        query += " ORDER BY original_line_number"
        rows = conn.execute(query, params).fetchall()
        return [self._row_to_annotation(r) for r in rows]

    def save_change(self, change: ChangeRecord) -> None:
        conn = self._get_conn()
        conn.execute(
            """INSERT OR REPLACE INTO change_records
               (id, annotation_id, field_name, old_value, new_value,
                changed_by, reason, import_batch_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (change.id, change.annotation_id, change.field_name,
             change.old_value, change.new_value, change.changed_by,
             change.reason, change.import_batch_id, change.created_at),
        )
        conn.commit()

    def get_changes_for_annotation(self, ann_id: str) -> list[ChangeRecord]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM change_records WHERE annotation_id = ? ORDER BY created_at",
            (ann_id,),
        ).fetchall()
        return [self._row_to_change(r) for r in rows]

    def save_batch(self, batch: ImportBatch) -> None:
        conn = self._get_conn()
        conn.execute(
            """INSERT OR REPLACE INTO import_batches
               (id, source, total_rows, new_count, unchanged_count,
                changed_count, skipped_duplicate_count, flagged_count,
                rolled_back, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (batch.id, batch.source.value, batch.total_rows, batch.new_count,
             batch.unchanged_count, batch.changed_count, batch.skipped_duplicate_count,
             batch.flagged_count, int(batch.rolled_back), batch.created_at),
        )
        conn.commit()

    def get_batch(self, batch_id: str) -> Optional[ImportBatch]:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM import_batches WHERE id = ?", (batch_id,)).fetchone()
        if row is None:
            return None
        return self._row_to_batch(row)

    def get_latest_batch(self) -> Optional[ImportBatch]:
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM import_batches ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
        if row is None:
            return None
        return self._row_to_batch(row)

    def rollback_batch(self, batch_id: str, changed_by: str = "system") -> tuple[int, list[ChangeRecord]]:
        conn = self._get_conn()
        changes = conn.execute(
            "SELECT * FROM change_records WHERE import_batch_id = ? ORDER BY created_at DESC",
            (batch_id,),
        ).fetchall()

        rolled = 0
        rollback_changes: list[ChangeRecord] = []
        now = datetime.now().isoformat()

        annotation_ids_affected: set[str] = set()
        for ch_row in changes:
            annotation_ids_affected.add(ch_row["annotation_id"])

        for ch_row in changes:
            ann_row = conn.execute(
                "SELECT * FROM annotations WHERE id = ?", (ch_row["annotation_id"],)
            ).fetchone()
            if ann_row:
                field = ch_row["field_name"]
                old_val = ch_row["old_value"]
                new_val = ch_row["new_value"]

                conn.execute(
                    f"UPDATE annotations SET {field} = ?, updated_at = ? WHERE id = ?",
                    (old_val, now, ch_row["annotation_id"]),
                )
                rolled += 1

                rb_ch = ChangeRecord(
                    annotation_id=ch_row["annotation_id"],
                    field_name=field,
                    old_value=str(new_val),
                    new_value=str(old_val),
                    changed_by=changed_by,
                    reason=f"rollback_batch:{batch_id}: 回滚到改前值",
                    import_batch_id=batch_id,
                    created_at=now,
                )
                self.save_change(rb_ch)
                rollback_changes.append(rb_ch)

        batch_ann_rows = conn.execute(
            "SELECT * FROM annotations WHERE import_batch_id = ? AND source = ?",
            (batch_id, AnnotationSource.TEACHER_ANNOTATION.value),
        ).fetchall()
        for ann_row in batch_ann_rows:
            prior_status = conn.execute(
                """SELECT new_value FROM change_records
                   WHERE annotation_id = ? AND field_name = 'status'
                   AND import_batch_id != ?
                   ORDER BY created_at DESC LIMIT 1""",
                (ann_row["id"], batch_id),
            ).fetchone()
            old_status = ann_row["status"]
            new_status = prior_status["new_value"] if prior_status else ReviewStatus.PENDING.value
            if old_status != new_status:
                conn.execute(
                    "UPDATE annotations SET status = ?, updated_at = ? WHERE id = ?",
                    (new_status, now, ann_row["id"]),
                )
                rb_ch = ChangeRecord(
                    annotation_id=ann_row["id"],
                    field_name="status",
                    old_value=str(old_status),
                    new_value=str(new_status),
                    changed_by=changed_by,
                    reason=f"rollback_batch:{batch_id}: 同步回滚状态",
                    import_batch_id=batch_id,
                    created_at=now,
                )
                self.save_change(rb_ch)
                rollback_changes.append(rb_ch)

        conn.execute(
            "UPDATE import_batches SET rolled_back = 1 WHERE id = ?", (batch_id,)
        )
        conn.commit()
        return rolled, rollback_changes

    def _row_to_annotation(self, row: sqlite3.Row) -> Annotation:
        keys = set(row.keys())
        return Annotation(
            id=row["id"],
            source=AnnotationSource(row["source"]),
            original_line_number=row["original_line_number"],
            original_value=row["original_value"],
            current_value=row["current_value"],
            item_name=row["item_name"],
            category=row["category"],
            denominator_raw=row["denominator_raw"],
            numerator_raw=row["numerator_raw"],
            is_edge_case=bool(row["is_edge_case"]),
            edge_case_type=row["edge_case_type"],
            status=ReviewStatus(row["status"]),
            import_batch_id=row["import_batch_id"] if "import_batch_id" in keys and row["import_batch_id"] else "",
            review_reason=row["review_reason"] if "review_reason" in keys else "",
            next_contact=row["next_contact"] if "next_contact" in keys else "",
            reviewed_by=row["reviewed_by"] if "reviewed_by" in keys else "",
            reviewed_at=row["reviewed_at"] if "reviewed_at" in keys else "",
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _row_to_change(self, row: sqlite3.Row) -> ChangeRecord:
        return ChangeRecord(
            id=row["id"],
            annotation_id=row["annotation_id"],
            field_name=row["field_name"],
            old_value=row["old_value"],
            new_value=row["new_value"],
            changed_by=row["changed_by"],
            reason=row["reason"],
            import_batch_id=row["import_batch_id"],
            created_at=row["created_at"],
        )

    def _row_to_batch(self, row: sqlite3.Row) -> ImportBatch:
        return ImportBatch(
            id=row["id"],
            source=AnnotationSource(row["source"]),
            total_rows=row["total_rows"],
            new_count=row["new_count"],
            unchanged_count=row["unchanged_count"],
            changed_count=row["changed_count"],
            skipped_duplicate_count=row["skipped_duplicate_count"],
            flagged_count=row["flagged_count"],
            rolled_back=bool(row["rolled_back"]),
            created_at=row["created_at"],
        )
