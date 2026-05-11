import sqlite3
from datetime import datetime
from typing import List, Dict, Optional
from .models import Agent, Call, QCTask, QCInspector, CallStatus


DB_SCHEMA = """
CREATE TABLE IF NOT EXISTS agents (
    agent_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    team TEXT,
    risk_score REAL DEFAULT 50.0,
    historical_avg_score REAL DEFAULT 85.0,
    total_qc_calls INTEGER DEFAULT 0,
    last_updated TEXT
);

CREATE TABLE IF NOT EXISTS calls (
    call_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    call_time TEXT,
    duration_sec INTEGER,
    business_type TEXT,
    is_complaint INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    sampled_at TEXT,
    qc_assigned_to TEXT,
    qc_score REAL,
    qc_notes TEXT,
    sampling_reason TEXT
);

CREATE TABLE IF NOT EXISTS qc_inspectors (
    inspector_id TEXT PRIMARY KEY,
    name TEXT,
    active INTEGER DEFAULT 1,
    current_task_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS qc_tasks (
    task_id TEXT PRIMARY KEY,
    call_id TEXT,
    agent_id TEXT,
    business_type TEXT,
    is_complaint INTEGER DEFAULT 0,
    qc_assigned_to TEXT,
    sampling_reason TEXT,
    created_at TEXT,
    completed_at TEXT,
    score REAL,
    result TEXT
);
"""


class Storage:
    def __init__(self, db_path: str = "qc_sampling.db"):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        self.conn.executescript(DB_SCHEMA)
        self.conn.commit()

    def close(self):
        self.conn.close()

    def upsert_agent(self, agent: Agent):
        self.conn.execute("""
        INSERT OR REPLACE INTO agents 
        (agent_id, name, team, risk_score, historical_avg_score, total_qc_calls, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            agent.agent_id, agent.name, agent.team,
            agent.risk_score,
            agent.historical_avg_score,
            agent.total_qc_calls,
            agent.last_updated or datetime.now().isoformat()
        ))
        self.conn.commit()

    def get_agent(self, agent_id: str) -> Optional[Agent]:
        row = self.conn.execute(
            "SELECT * FROM agents WHERE agent_id = ?", (agent_id,)).fetchone()
        if row:
            return Agent(**dict(row))
        return None

    def get_all_agents(self) -> List[Agent]:
        rows = self.conn.execute("SELECT * FROM agents").fetchall()
        return [Agent(**dict(row)) for row in rows]

    def upsert_call(self, call: Call) -> bool:
        existing = self.conn.execute(
            "SELECT call_id FROM calls WHERE call_id = ?", (call.call_id,)).fetchone()
        is_new = existing is None
        self.conn.execute("""
        INSERT OR REPLACE INTO calls
        (call_id, agent_id, call_time, duration_sec, business_type,
        is_complaint, status, sampled_at, qc_assigned_to,
        qc_score, qc_notes, sampling_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            call.call_id, call.agent_id, call.call_time,
            call.duration_sec, call.business_type,
            1 if call.is_complaint else 0,
            call.status.value,
            call.sampled_at,
            call.qc_assigned_to,
            call.qc_score,
            call.qc_notes,
            call.sampling_reason
        ))
        self.conn.commit()
        return is_new

    def get_call(self, call_id: str) -> Optional[Call]:
        row = self.conn.execute(
            "SELECT * FROM calls WHERE call_id = ?", (call_id,)).fetchone()
        if row:
            d = dict(row)
            d["is_complaint"] = bool(d["is_complaint"])
            d["status"] = CallStatus(d["status"])
            return Call(**d)
        return None

    def get_all_calls(self, status: Optional[CallStatus] = None) -> List[Call]:
        if status:
            rows = self.conn.execute(
                "SELECT * FROM calls WHERE status = ?", (status.value,)).fetchall()
        else:
            rows = self.conn.execute("SELECT * FROM calls").fetchall()
        result = []
        for row in rows:
            d = dict(row)
            d["is_complaint"] = bool(d["is_complaint"])
            d["status"] = CallStatus(d["status"])
            result.append(Call(**d))
        return result

    def get_pending_calls(self) -> List[Call]:
        return self.get_all_calls(CallStatus.PENDING)

    def upsert_inspector(self, inspector: QCInspector):
        self.conn.execute("""
        INSERT OR REPLACE INTO qc_inspectors
        (inspector_id, name, active, current_task_count)
        VALUES (?, ?, ?, ?)
        """, (
            inspector.inspector_id, inspector.name,
            1 if inspector.active else 0,
            inspector.current_task_count
        ))
        self.conn.commit()

    def get_inspector(self, inspector_id: str) -> Optional[QCInspector]:
        row = self.conn.execute(
            "SELECT * FROM qc_inspectors WHERE inspector_id = ?", (inspector_id,)).fetchone()
        if row:
            d = dict(row)
            d["active"] = bool(d["active"])
            return QCInspector(**d)
        return None

    def get_all_inspectors(self, active_only: bool = True) -> List[QCInspector]:
        if active_only:
            rows = self.conn.execute(
                "SELECT * FROM qc_inspectors WHERE active = 1").fetchall()
        else:
            rows = self.conn.execute(
                "SELECT * FROM qc_inspectors").fetchall()
        result = []
        for row in rows:
            d = dict(row)
            d["active"] = bool(d["active"])
            result.append(QCInspector(**d))
        return result

    def create_task(self, task: QCTask):
        self.conn.execute("""
        INSERT OR REPLACE INTO qc_tasks
        (task_id, call_id, agent_id, business_type,
        is_complaint, qc_assigned_to, sampling_reason,
        created_at, completed_at, score, result)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            task.task_id, task.call_id, task.agent_id,
            task.business_type,
            1 if task.is_complaint else 0,
            task.qc_assigned_to,
            task.sampling_reason,
            task.created_at,
            task.completed_at,
            task.score,
            task.result
        ))
        self.conn.commit()

    def get_task(self, task_id: str) -> Optional[QCTask]:
        row = self.conn.execute(
            "SELECT * FROM qc_tasks WHERE task_id = ?", (task_id,)).fetchone()
        if row:
            d = dict(row)
            d["is_complaint"] = bool(d["is_complaint"])
            return QCTask(**d)
        return None

    def get_tasks_by_call(self, call_id: str) -> List[QCTask]:
        rows = self.conn.execute(
            "SELECT * FROM qc_tasks WHERE call_id = ?", (call_id,)).fetchall()
        result = []
        for row in rows:
            d = dict(row)
            d["is_complaint"] = bool(d["is_complaint"])
            result.append(QCTask(**d))
        return result

    def get_all_tasks(self) -> List[QCTask]:
        rows = self.conn.execute(
            "SELECT * FROM qc_tasks ORDER BY created_at DESC").fetchall()
        result = []
        for row in rows:
            d = dict(row)
            d["is_complaint"] = bool(d["is_complaint"])
            result.append(QCTask(**d))
        return result

    def update_task_result(
        self,
        task_id: str,
        score: float,
        result: str,
        notes: str = ""
    ):
        now = datetime.now().isoformat()
        self.conn.execute("""
        UPDATE qc_tasks
        SET score = ?, result = ?, completed_at = ?
        WHERE task_id = ?
        """, (score, result, now, task_id))
        self.conn.commit()

        task = self.get_task(task_id)
        if task:
            self.conn.execute("""
            UPDATE calls
            SET qc_score = ?,
                status = ?,
                qc_notes = ?
            WHERE call_id = ?
            """, (
                score,
                CallStatus.QC_PASS.value if result == "pass" else CallStatus.QC_FAIL.value,
                notes,
                task.call_id
            ))
            self.conn.commit()

            inspector = self.get_inspector(task.qc_assigned_to)
            if inspector and inspector.current_task_count > 0:
                inspector.current_task_count -= 1
                self.upsert_inspector(inspector)

    def get_inspector_task_count(self, inspector_id: str) -> int:
        row = self.conn.execute("""
        SELECT COUNT(*) as cnt FROM qc_tasks
        WHERE qc_assigned_to = ? AND completed_at IS NULL
        """, (inspector_id,)).fetchone()
        return row["cnt"] if row else 0

    def recalculate_agent_risk(self, agent_id: str):
        rows = self.conn.execute("""
        SELECT qc_score FROM calls
        WHERE agent_id = ? AND qc_score IS NOT NULL
        ORDER BY call_time DESC
        LIMIT 20
        """, (agent_id,)).fetchall()

        scores = [r["qc_score"] for r in rows]

        if not scores:
            return

        avg_score = sum(scores) / len(scores)
        fail_rate = sum(1 for s in scores if s < 60) / len(scores)

        complaint_rows = self.conn.execute("""
        SELECT COUNT(*) as cnt FROM calls
        WHERE agent_id = ? AND is_complaint = 1
        """, (agent_id,)).fetchone()
        complaint_count = complaint_rows["cnt"] if complaint_rows else 0

        base_score = avg_score
        risk = 50.0
        if avg_score < 60:
            risk = 80.0
        elif avg_score < 70:
            risk = 65.0
        elif avg_score < 80:
            risk = 55.0
        else:
            risk = 45.0

        if fail_rate > 0.3:
            risk += 15.0
        if complaint_count > 0:
            risk += 10.0

        risk = min(100.0, risk)
        risk = max(0.0, risk)

        self.conn.execute("""
        UPDATE agents
        SET historical_avg_score = ?, risk_score = ?, total_qc_calls = ?
        WHERE agent_id = ?
        """, (avg_score, risk, len(scores), agent_id))
        self.conn.commit()

    def execute_sql(self, sql: str, params: tuple = ()) -> List[Dict]:
        cursor = self.conn.execute(sql, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
