import sqlite3
import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from contextlib import contextmanager

from models import (
    DropConfig,
    LeaderboardRecord,
    VersionHistory,
    ImportBatch,
    ReviewStatus,
    AnomalyType,
    SourceType,
)


class Database:
    def __init__(self, db_path: str = "island_supply.db"):
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
            cursor = conn.cursor()

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS drop_configs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    stage TEXT NOT NULL,
                    item_name TEXT NOT NULL,
                    drop_rate REAL NOT NULL DEFAULT 0,
                    source_file TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    note TEXT
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS leaderboard_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id TEXT NOT NULL,
                    player_name TEXT NOT NULL,
                    score INTEGER NOT NULL DEFAULT 0,
                    rank INTEGER NOT NULL DEFAULT 0,
                    stage_progress INTEGER NOT NULL DEFAULT 0,
                    source_type TEXT NOT NULL,
                    source_file TEXT NOT NULL,
                    source_ref TEXT,
                    review_status TEXT NOT NULL,
                    anomaly_type TEXT NOT NULL,
                    anomaly_note TEXT,
                    version INTEGER NOT NULL DEFAULT 1,
                    import_batch_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS version_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    batch_id TEXT NOT NULL,
                    record_type TEXT NOT NULL,
                    record_id INTEGER NOT NULL,
                    old_version INTEGER NOT NULL,
                    new_version INTEGER NOT NULL,
                    change_summary TEXT,
                    changed_fields TEXT,
                    old_values TEXT,
                    new_values TEXT,
                    operator TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS import_batches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    batch_id TEXT NOT NULL UNIQUE,
                    source_file TEXT NOT NULL,
                    record_type TEXT NOT NULL,
                    record_count INTEGER NOT NULL DEFAULT 0,
                    is_revoked BOOLEAN NOT NULL DEFAULT 0,
                    revoke_reason TEXT,
                    operator TEXT,
                    created_at TEXT NOT NULL,
                    revoked_at TEXT
                )
                """
            )

            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_leaderboard_player ON leaderboard_records(player_id)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_leaderboard_batch ON leaderboard_records(import_batch_id)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_leaderboard_status ON leaderboard_records(review_status)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_version_record ON version_history(record_type, record_id)"
            )

    def generate_batch_id(self) -> str:
        return f"BATCH-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8].upper()}"

    def create_import_batch(
        self, source_file: str, record_type: str, record_count: int, operator: str = ""
    ) -> ImportBatch:
        batch = ImportBatch(
            batch_id=self.generate_batch_id(),
            source_file=source_file,
            record_type=record_type,
            record_count=record_count,
            operator=operator,
            created_at=datetime.now(),
        )

        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO import_batches (
                    batch_id, source_file, record_type, record_count,
                    is_revoked, operator, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    batch.batch_id,
                    batch.source_file,
                    batch.record_type,
                    batch.record_count,
                    batch.is_revoked,
                    batch.operator,
                    batch.created_at.isoformat(),
                ),
            )
            batch.id = cursor.lastrowid

        return batch

    def get_import_batch(self, batch_id: str) -> Optional[ImportBatch]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM import_batches WHERE batch_id = ?", (batch_id,)
            )
            row = cursor.fetchone()
            return self._row_to_import_batch(row) if row else None

    def revoke_import_batch(self, batch_id: str, reason: str, operator: str = "") -> bool:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE import_batches
                SET is_revoked = 1, revoke_reason = ?, revoked_at = ?
                WHERE batch_id = ? AND is_revoked = 0
                """,
                (reason, datetime.now().isoformat(), batch_id),
            )

            if cursor.rowcount == 0:
                return False

            cursor.execute(
                """
                UPDATE leaderboard_records
                SET review_status = ?, anomaly_type = ?, anomaly_note = ?, updated_at = ?
                WHERE import_batch_id = ?
                """,
                (
                    ReviewStatus.REJECTED.value,
                    AnomalyType.NONE.value,
                    f"批次已撤回: {reason}",
                    datetime.now().isoformat(),
                    batch_id,
                ),
            )

            return True

    def list_import_batches(self, record_type: str = None) -> List[ImportBatch]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            if record_type:
                cursor.execute(
                    "SELECT * FROM import_batches WHERE record_type = ? ORDER BY created_at DESC",
                    (record_type,),
                )
            else:
                cursor.execute(
                    "SELECT * FROM import_batches ORDER BY created_at DESC"
                )
            return [self._row_to_import_batch(row) for row in cursor.fetchall()]

    def insert_drop_config(self, config: DropConfig) -> DropConfig:
        config.created_at = datetime.now()
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO drop_configs (
                    stage, item_name, drop_rate, source_file,
                    version, is_active, created_at, note
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    config.stage,
                    config.item_name,
                    config.drop_rate,
                    config.source_file,
                    config.version,
                    config.is_active,
                    config.created_at.isoformat(),
                    config.note,
                ),
            )
            config.id = cursor.lastrowid
        return config

    def insert_leaderboard_record(
        self, record: LeaderboardRecord
    ) -> LeaderboardRecord:
        now = datetime.now()
        record.created_at = now
        record.updated_at = now

        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO leaderboard_records (
                    player_id, player_name, score, rank, stage_progress,
                    source_type, source_file, source_ref, review_status,
                    anomaly_type, anomaly_note, version, import_batch_id,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.player_id,
                    record.player_name,
                    record.score,
                    record.rank,
                    record.stage_progress,
                    record.source_type.value,
                    record.source_file,
                    record.source_ref,
                    record.review_status.value,
                    record.anomaly_type.value,
                    record.anomaly_note,
                    record.version,
                    record.import_batch_id,
                    record.created_at.isoformat(),
                    record.updated_at.isoformat(),
                ),
            )
            record.id = cursor.lastrowid
        return record

    def update_leaderboard_record(
        self, record: LeaderboardRecord
    ) -> LeaderboardRecord:
        record.updated_at = datetime.now()

        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE leaderboard_records
                SET player_name = ?, score = ?, rank = ?, stage_progress = ?,
                    source_type = ?, source_file = ?, source_ref = ?,
                    review_status = ?, anomaly_type = ?, anomaly_note = ?,
                    version = ?, import_batch_id = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    record.player_name,
                    record.score,
                    record.rank,
                    record.stage_progress,
                    record.source_type.value,
                    record.source_file,
                    record.source_ref,
                    record.review_status.value,
                    record.anomaly_type.value,
                    record.anomaly_note,
                    record.version,
                    record.import_batch_id,
                    record.updated_at.isoformat(),
                    record.id,
                ),
            )
        return record

    def get_leaderboard_record(self, record_id: int) -> Optional[LeaderboardRecord]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM leaderboard_records WHERE id = ?", (record_id,)
            )
            row = cursor.fetchone()
            return self._row_to_leaderboard(row) if row else None

    def find_leaderboard_by_player(self, player_id: str) -> List[LeaderboardRecord]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM leaderboard_records WHERE player_id = ? ORDER BY version DESC",
                (player_id,),
            )
            return [self._row_to_leaderboard(row) for row in cursor.fetchall()]

    def find_leaderboard_by_batch(self, batch_id: str) -> List[LeaderboardRecord]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM leaderboard_records WHERE import_batch_id = ?",
                (batch_id,),
            )
            return [self._row_to_leaderboard(row) for row in cursor.fetchall()]

    def query_leaderboard(
        self,
        review_status: ReviewStatus = None,
        anomaly_type: AnomalyType = None,
        min_score: int = None,
        max_score: int = None,
        include_revoked: bool = False,
        limit: int = None,
    ) -> List[LeaderboardRecord]:
        sql = "SELECT * FROM leaderboard_records WHERE 1=1"
        params = []

        if not include_revoked:
            sql += " AND review_status != ?"
            params.append(ReviewStatus.REJECTED.value)

        if review_status:
            sql += " AND review_status = ?"
            params.append(review_status.value)

        if anomaly_type:
            sql += " AND anomaly_type = ?"
            params.append(anomaly_type.value)

        if min_score is not None:
            sql += " AND score >= ?"
            params.append(min_score)

        if max_score is not None:
            sql += " AND score <= ?"
            params.append(max_score)

        sql += " ORDER BY score DESC, rank ASC"

        if limit:
            sql += " LIMIT ?"
            params.append(limit)

        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return [self._row_to_leaderboard(row) for row in cursor.fetchall()]

    def insert_version_history(self, history: VersionHistory) -> VersionHistory:
        history.created_at = datetime.now()

        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO version_history (
                    batch_id, record_type, record_id, old_version, new_version,
                    change_summary, changed_fields, old_values, new_values,
                    operator, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    history.batch_id,
                    history.record_type,
                    history.record_id,
                    history.old_version,
                    history.new_version,
                    history.change_summary,
                    json.dumps(history.changed_fields, ensure_ascii=False),
                    json.dumps(history.old_values, ensure_ascii=False),
                    json.dumps(history.new_values, ensure_ascii=False),
                    history.operator,
                    history.created_at.isoformat(),
                ),
            )
            history.id = cursor.lastrowid
        return history

    def get_version_history(
        self, record_type: str, record_id: int
    ) -> List[VersionHistory]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM version_history
                WHERE record_type = ? AND record_id = ?
                ORDER BY created_at DESC
                """,
                (record_type, record_id),
            )
            return [self._row_to_version_history(row) for row in cursor.fetchall()]

    def get_drop_configs(self, stage: str = None, active_only: bool = True) -> List[DropConfig]:
        sql = "SELECT * FROM drop_configs WHERE 1=1"
        params = []

        if active_only:
            sql += " AND is_active = 1"

        if stage:
            sql += " AND stage = ?"
            params.append(stage)

        sql += " ORDER BY stage, version DESC"

        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return [self._row_to_drop_config(row) for row in cursor.fetchall()]

    def _row_to_import_batch(self, row: sqlite3.Row) -> ImportBatch:
        return ImportBatch(
            id=row["id"],
            batch_id=row["batch_id"],
            source_file=row["source_file"],
            record_type=row["record_type"],
            record_count=row["record_count"],
            is_revoked=bool(row["is_revoked"]),
            revoke_reason=row["revoke_reason"],
            operator=row["operator"],
            created_at=datetime.fromisoformat(row["created_at"]),
            revoked_at=datetime.fromisoformat(row["revoked_at"])
            if row["revoked_at"]
            else None,
        )

    def _row_to_drop_config(self, row: sqlite3.Row) -> DropConfig:
        return DropConfig(
            id=row["id"],
            stage=row["stage"],
            item_name=row["item_name"],
            drop_rate=row["drop_rate"],
            source_file=row["source_file"],
            version=row["version"],
            is_active=bool(row["is_active"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            note=row["note"],
        )

    def _row_to_leaderboard(self, row: sqlite3.Row) -> LeaderboardRecord:
        return LeaderboardRecord(
            id=row["id"],
            player_id=row["player_id"],
            player_name=row["player_name"],
            score=row["score"],
            rank=row["rank"],
            stage_progress=row["stage_progress"],
            source_type=SourceType(row["source_type"]),
            source_file=row["source_file"],
            source_ref=row["source_ref"],
            review_status=ReviewStatus(row["review_status"]),
            anomaly_type=AnomalyType(row["anomaly_type"]),
            anomaly_note=row["anomaly_note"],
            version=row["version"],
            import_batch_id=row["import_batch_id"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )

    def _row_to_version_history(self, row: sqlite3.Row) -> VersionHistory:
        return VersionHistory(
            id=row["id"],
            batch_id=row["batch_id"],
            record_type=row["record_type"],
            record_id=row["record_id"],
            old_version=row["old_version"],
            new_version=row["new_version"],
            change_summary=row["change_summary"],
            changed_fields=json.loads(row["changed_fields"])
            if row["changed_fields"]
            else [],
            old_values=json.loads(row["old_values"]) if row["old_values"] else {},
            new_values=json.loads(row["new_values"]) if row["new_values"] else {},
            operator=row["operator"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )
