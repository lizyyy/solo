from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator, Optional

from .models import RiskEvent, RiskType, SimulationStats


class SQLiteStorage:
    def __init__(self, db_path: str = "cache_forensics.db"):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def get_connection(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS runs (
                    id TEXT PRIMARY KEY,
                    policy_name TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    finished_at TEXT NOT NULL,
                    total_requests INTEGER DEFAULT 0,
                    cache_hits INTEGER DEFAULT 0,
                    cache_misses INTEGER DEFAULT 0,
                    db_queries INTEGER DEFAULT 0,
                    db_writes INTEGER DEFAULT 0,
                    local_hits INTEGER DEFAULT 0,
                    local_misses INTEGER DEFAULT 0,
                    redis_hits INTEGER DEFAULT 0,
                    redis_misses INTEGER DEFAULT 0,
                    consistency_violations INTEGER DEFAULT 0,
                    stale_reads INTEGER DEFAULT 0,
                    hit_rate REAL DEFAULT 0.0,
                    local_hit_rate REAL DEFAULT 0.0,
                    redis_hit_rate REAL DEFAULT 0.0,
                    key_access_counts TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS risk_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id TEXT NOT NULL,
                    risk_type TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    key TEXT NOT NULL,
                    description TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    context TEXT,
                    FOREIGN KEY (run_id) REFERENCES runs (id)
                )
                """
            )

            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_risk_events_run_id ON risk_events (run_id)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs (created_at)"
            )

            conn.commit()

    def save_run(self, stats: SimulationStats) -> None:
        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                INSERT INTO runs (
                    id, policy_name, started_at, finished_at,
                    total_requests, cache_hits, cache_misses,
                    db_queries, db_writes, local_hits, local_misses,
                    redis_hits, redis_misses, consistency_violations,
                    stale_reads, hit_rate, local_hit_rate, redis_hit_rate,
                    key_access_counts, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    stats.run_id,
                    stats.policy_name,
                    stats.started_at.isoformat(),
                    stats.finished_at.isoformat(),
                    stats.total_requests,
                    stats.cache_hits,
                    stats.cache_misses,
                    stats.db_queries,
                    stats.db_writes,
                    stats.local_hits,
                    stats.local_misses,
                    stats.redis_hits,
                    stats.redis_misses,
                    stats.consistency_violations,
                    stats.stale_reads,
                    stats.hit_rate,
                    stats.local_hit_rate,
                    stats.redis_hit_rate,
                    json.dumps(stats.key_access_counts, ensure_ascii=False),
                    datetime.now().isoformat(),
                ),
            )

            for risk in stats.risk_events:
                cursor.execute(
                    """
                    INSERT INTO risk_events (
                        run_id, risk_type, timestamp, key, description, severity, context
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        stats.run_id,
                        risk.risk_type.value,
                        risk.timestamp.isoformat(),
                        risk.key,
                        risk.description,
                        risk.severity,
                        json.dumps(risk.context, ensure_ascii=False) if risk.context else None,
                    ),
                )

            conn.commit()

    def get_run(self, run_id: str) -> Optional[dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
            row = cursor.fetchone()
            if row:
                result = dict(row)
                result["key_access_counts"] = json.loads(result["key_access_counts"])
                return result
            return None

    def get_runs(self, limit: int = 10) -> list[dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM runs ORDER BY created_at DESC LIMIT ?", (limit,)
            )
            rows = cursor.fetchall()
            results = []
            for row in rows:
                result = dict(row)
                result["key_access_counts"] = json.loads(result["key_access_counts"])
                results.append(result)
            return results

    def get_risk_events(self, run_id: str) -> list[dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM risk_events WHERE run_id = ? ORDER BY timestamp", (run_id,)
            )
            rows = cursor.fetchall()
            results = []
            for row in rows:
                result = dict(row)
                if result["context"]:
                    result["context"] = json.loads(result["context"])
                results.append(result)
            return results

    def delete_run(self, run_id: str) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM risk_events WHERE run_id = ?", (run_id,))
            cursor.execute("DELETE FROM runs WHERE id = ?", (run_id,))
            deleted = cursor.rowcount > 0
            conn.commit()
            return deleted

    def clear_all(self) -> None:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM risk_events")
            cursor.execute("DELETE FROM runs")
            conn.commit()
