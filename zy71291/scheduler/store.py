from __future__ import annotations

import json
import logging
import os
import sqlite3
from typing import Dict, List, Optional

from .models import ScheduleInput, ScheduleResult

logger = logging.getLogger(__name__)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    feasible INTEGER NOT NULL,
    objective_value REAL,
    input_hash TEXT NOT NULL,
    solver_status TEXT NOT NULL,
    input_json TEXT NOT NULL,
    result_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integrity_log (
    run_id TEXT NOT NULL,
    check_time TEXT NOT NULL,
    input_hash_stored TEXT NOT NULL,
    input_hash_computed TEXT NOT NULL,
    result_hash_stored TEXT NOT NULL,
    result_hash_computed TEXT NOT NULL,
    passed INTEGER NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON runs(timestamp);
CREATE INDEX IF NOT EXISTS idx_runs_input_hash ON runs(input_hash);
"""


class Store:
    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            db_dir = os.path.join(os.getcwd(), ".scheduler")
            os.makedirs(db_dir, exist_ok=True)
            db_path = os.path.join(db_dir, "scheduler.db")
        self.db_path = db_path
        self._ensure_schema()

    def _ensure_schema(self):
        conn = sqlite3.connect(self.db_path)
        try:
            conn.executescript(_SCHEMA)
            conn.commit()
        finally:
            conn.close()

    def save(self, data: ScheduleInput, result: ScheduleResult) -> None:
        input_json = data.to_json()
        result_json = result.to_json()
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute(
                "INSERT OR REPLACE INTO runs "
                "(run_id, timestamp, feasible, objective_value, input_hash, "
                "solver_status, input_json, result_json) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    result.run_id,
                    result.timestamp,
                    1 if result.feasible else 0,
                    result.objective_value,
                    result.input_hash,
                    result.solver_status,
                    input_json,
                    result_json,
                ),
            )
            conn.commit()
        finally:
            conn.close()

    def load(self, run_id: str) -> Optional[tuple]:
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.execute(
                "SELECT input_json, result_json FROM runs WHERE run_id = ?",
                (run_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None
            input_data = ScheduleInput.from_json(row[0])
            result_data = ScheduleResult.from_json(row[1])
            return (input_data, result_data)
        finally:
            conn.close()

    def list_runs(self, limit: int = 20) -> List[Dict]:
        conn = sqlite3.connect(self.db_path)
        try:
            conn.row_factory = sqlite3.Row
            cur = conn.execute(
                "SELECT run_id, timestamp, feasible, objective_value, "
                "input_hash, solver_status "
                "FROM runs ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            )
            return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()

    def delete_run(self, run_id: str) -> bool:
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.execute("DELETE FROM runs WHERE run_id = ?", (run_id,))
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()

    def verify_integrity(self, run_id: str) -> Dict:
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.execute(
                "SELECT input_json, result_json, input_hash FROM runs WHERE run_id = ?",
                (run_id,),
            )
            row = cur.fetchone()
            if row is None:
                return {"error": f"运行 {run_id} 不存在"}
            input_json, result_json, stored_input_hash = row
            input_data = ScheduleInput.from_json(input_json)
            result_data = ScheduleResult.from_json(result_json)
            from .solver import _input_hash
            computed_input_hash = _input_hash(input_data)
            import hashlib
            computed_result_hash = hashlib.sha256(
                result_json.encode("utf-8")
            ).hexdigest()[:16]
            stored_result_hash = hashlib.sha256(
                json.dumps(
                    result_data.to_dict(), sort_keys=True, ensure_ascii=False
                ).encode("utf-8")
            ).hexdigest()[:16]
            passed = computed_input_hash == stored_input_hash
            check_time = (
                __import__("datetime").datetime.now().isoformat()
            )
            conn.execute(
                "INSERT INTO integrity_log "
                "(run_id, check_time, input_hash_stored, input_hash_computed, "
                "result_hash_stored, result_hash_computed, passed) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    run_id,
                    check_time,
                    stored_input_hash,
                    computed_input_hash,
                    computed_result_hash,
                    stored_result_hash,
                    1 if passed else 0,
                ),
            )
            conn.commit()
            return {
                "run_id": run_id,
                "input_hash_match": passed,
                "stored_input_hash": stored_input_hash,
                "computed_input_hash": computed_input_hash,
                "timestamp": check_time,
            }
        finally:
            conn.close()

    def supplement_and_resolve(
        self, run_id: str, extra: ScheduleInput, time_limit: int = 300
    ) -> Optional[ScheduleResult]:
        loaded = self.load(run_id)
        if loaded is None:
            return None
        original_input, original_result = loaded
        merged = original_input.supplement(extra)
        from .solver import IPSolver

        solver = IPSolver(merged)
        new_result = solver.solve(time_limit=time_limit)
        self.save(merged, new_result)
        return new_result
