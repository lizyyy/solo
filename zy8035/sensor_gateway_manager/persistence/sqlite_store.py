import json
import sqlite3
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class SnapshotRecord:
    id: int
    device_id: str
    timestamp: str
    snapshot_json: str
    target_yaml: str
    diff_summary: str


class SQLiteStore:
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = str(Path.home() / ".sensor_gateway_manager" / "history.db")
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    device_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    snapshot_json TEXT NOT NULL,
                    target_yaml TEXT,
                    diff_summary TEXT
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_device_id ON snapshots(device_id)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_timestamp ON snapshots(timestamp)
            """)

    def save_snapshot(self, device_id: str, snapshot: Dict[str, Any],
                     target_yaml: str = None, diff_summary: str = None) -> int:
        snapshot_json = json.dumps(snapshot)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                INSERT INTO snapshots (device_id, timestamp, snapshot_json, target_yaml, diff_summary)
                VALUES (?, ?, ?, ?, ?)
            """, (device_id, timestamp, snapshot_json, target_yaml, diff_summary))
            return cursor.lastrowid

    def get_snapshots(self, device_id: str = None, limit: int = 100) -> List[SnapshotRecord]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            if device_id:
                rows = conn.execute("""
                    SELECT id, device_id, timestamp, snapshot_json, target_yaml, diff_summary
                    FROM snapshots WHERE device_id = ?
                    ORDER BY timestamp DESC LIMIT ?
                """, (device_id, limit)).fetchall()
            else:
                rows = conn.execute("""
                    SELECT id, device_id, timestamp, snapshot_json, target_yaml, diff_summary
                    FROM snapshots ORDER BY timestamp DESC LIMIT ?
                """, (limit,)).fetchall()
            return [SnapshotRecord(**dict(row)) for row in rows]

    def get_snapshot_by_id(self, snapshot_id: int) -> Optional[SnapshotRecord]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("""
                SELECT id, device_id, timestamp, snapshot_json, target_yaml, diff_summary
                FROM snapshots WHERE id = ?
            """, (snapshot_id,)).fetchone()
            if row:
                return SnapshotRecord(**dict(row))
            return None

    def delete_snapshot(self, snapshot_id: int) -> bool:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("DELETE FROM snapshots WHERE id = ?", (snapshot_id,))
            return cursor.rowcount > 0

    def get_latest_snapshot(self, device_id: str) -> Optional[SnapshotRecord]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("""
                SELECT id, device_id, timestamp, snapshot_json, target_yaml, diff_summary
                FROM snapshots WHERE device_id = ?
                ORDER BY timestamp DESC LIMIT 1
            """, (device_id,)).fetchone()
            if row:
                return SnapshotRecord(**dict(row))
            return None

    def clear_history(self, device_id: str = None):
        with sqlite3.connect(self.db_path) as conn:
            if device_id:
                conn.execute("DELETE FROM snapshots WHERE device_id = ?", (device_id,))
            else:
                conn.execute("DELETE FROM snapshots")