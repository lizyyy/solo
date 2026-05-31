import sqlite3
from datetime import datetime
from typing import List, Optional, Dict, Any
from contextlib import contextmanager
import json

from .models import AlarmRecord, OperationLog, RecordStatus, ThresholdConfig


class Database:
    def __init__(self, db_path: str = "bridge_alarm.db"):
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
            conn.execute("""
                CREATE TABLE IF NOT EXISTS alarm_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source TEXT NOT NULL,
                    record_no TEXT NOT NULL,
                    bridge_name TEXT,
                    position TEXT,
                    displacement REAL,
                    threshold REAL,
                    threshold_level TEXT,
                    alarm_time TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    pending_reason TEXT,
                    is_manual_modified INTEGER DEFAULT 0,
                    operator TEXT,
                    remark TEXT,
                    vibration_file TEXT,
                    team TEXT,
                    created_at TEXT,
                    updated_at TEXT,
                    UNIQUE(source, record_no)
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS operation_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    record_id INTEGER NOT NULL,
                    action TEXT NOT NULL,
                    old_status TEXT,
                    new_status TEXT,
                    operator TEXT,
                    reason TEXT,
                    field_name TEXT,
                    old_value TEXT,
                    new_value TEXT,
                    created_at TEXT,
                    FOREIGN KEY (record_id) REFERENCES alarm_records(id)
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS threshold_configs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    level TEXT UNIQUE NOT NULL,
                    min_value REAL,
                    max_value REAL,
                    description TEXT
                )
            """)

            self._init_thresholds(conn)

    def _init_thresholds(self, conn):
        thresholds = [
            ("一级", 0.0, 5.0, "正常范围"),
            ("二级", 5.0, 10.0, "注意范围"),
            ("三级", 10.0, 15.0, "警戒范围"),
            ("四级", 15.0, 999.0, "危险范围"),
        ]
        for level, min_val, max_val, desc in thresholds:
            conn.execute("""
                INSERT OR IGNORE INTO threshold_configs (level, min_value, max_value, description)
                VALUES (?, ?, ?, ?)
            """, (level, min_val, max_val, desc))

    def get_thresholds(self) -> List[ThresholdConfig]:
        with self._get_conn() as conn:
            rows = conn.execute("SELECT level, min_value, max_value, description FROM threshold_configs ORDER BY min_value").fetchall()
            return [ThresholdConfig(**dict(r)) for r in rows]

    def get_threshold_level(self, displacement: float) -> str:
        with self._get_conn() as conn:
            row = conn.execute("""
                SELECT level FROM threshold_configs
                WHERE min_value <= ? AND max_value > ?
                ORDER BY min_value DESC LIMIT 1
            """, (displacement, displacement)).fetchone()
            return row["level"] if row else "未知"

    def insert_record(self, record: AlarmRecord) -> Optional[AlarmRecord]:
        with self._get_conn() as conn:
            existing = conn.execute("""
                SELECT id FROM alarm_records WHERE source = ? AND record_no = ?
            """, (record.source, record.record_no)).fetchone()
            if existing:
                return None

            now = datetime.now()
            cur = conn.execute("""
                INSERT INTO alarm_records (
                    source, record_no, bridge_name, position, displacement,
                    threshold, threshold_level, alarm_time, status,
                    pending_reason, is_manual_modified, operator, remark,
                    vibration_file, team, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record.source, record.record_no, record.bridge_name,
                record.position, record.displacement, record.threshold,
                record.threshold_level, record.alarm_time.strftime("%Y-%m-%d %H:%M:%S"),
                record.status.value, record.pending_reason,
                1 if record.is_manual_modified else 0, record.operator,
                record.remark, record.vibration_file, record.team,
                now.strftime("%Y-%m-%d %H:%M:%S"),
                now.strftime("%Y-%m-%d %H:%M:%S"),
            ))
            record.id = cur.lastrowid
            self._log_operation(conn, record.id, "import", "", record.status.value,
                               record.operator, "首次导入")
            return record

    def update_record(self, record: AlarmRecord, operator: str, reason: str = "") -> bool:
        with self._get_conn() as conn:
            old = conn.execute("SELECT * FROM alarm_records WHERE id = ?", (record.id,)).fetchone()
            if not old:
                return False

            old_status = old["status"]
            now = datetime.now()
            conn.execute("""
                UPDATE alarm_records SET
                    bridge_name = ?, position = ?, displacement = ?,
                    threshold = ?, threshold_level = ?,
                    alarm_time = ?, status = ?, pending_reason = ?,
                    is_manual_modified = ?, operator = ?, remark = ?,
                    vibration_file = ?, team = ?, updated_at = ?
                WHERE id = ?
            """, (
                record.bridge_name, record.position, record.displacement,
                record.threshold, record.threshold_level,
                record.alarm_time.strftime("%Y-%m-%d %H:%M:%S"),
                record.status.value, record.pending_reason,
                1 if record.is_manual_modified else 0, record.operator,
                record.remark, record.vibration_file, record.team,
                now.strftime("%Y-%m-%d %H:%M:%S"),
                record.id,
            ))
            self._log_operation(conn, record.id, "update", old_status, record.status.value,
                               operator, reason)
            return True

    def update_status(self, record_id: int, new_status: RecordStatus,
                      operator: str, reason: str = "",
                      pending_reason: str = "") -> bool:
        with self._get_conn() as conn:
            old = conn.execute("SELECT * FROM alarm_records WHERE id = ?", (record_id,)).fetchone()
            if not old:
                return False

            old_status = old["status"]
            now = datetime.now()
            conn.execute("""
                UPDATE alarm_records
                SET status = ?, pending_reason = ?, operator = ?, updated_at = ?,
                    is_manual_modified = CASE WHEN status != ? THEN 1 ELSE is_manual_modified END
                WHERE id = ?
            """, (new_status.value, pending_reason, operator,
                   now.strftime("%Y-%m-%d %H:%M:%S"),
                   new_status.value, record_id))
            self._log_operation(conn, record_id, "status_change", old_status,
                               new_status.value, operator, reason)
            return True

    def update_field(self, record_id: int, field_name: str, old_value: str,
                   new_value: str, operator: str, reason: str) -> bool:
        with self._get_conn() as conn:
            old = conn.execute("SELECT status FROM alarm_records WHERE id = ?", (record_id,)).fetchone()
            if not old:
                return False

            now = datetime.now()
            conn.execute(f"""
                UPDATE alarm_records SET {field_name} = ?, operator = ?,
                    is_manual_modified = 1, updated_at = ?
                WHERE id = ?
            """, (new_value, operator, now.strftime("%Y-%m-%d %H:%M:%S"), record_id))
            self._log_operation(conn, record_id, "field_edit", old["status"], old["status"],
                               operator, reason, field_name, old_value, new_value)
            return True

    def withdraw_record(self, record_id: int, operator: str, reason: str) -> bool:
        with self._get_conn() as conn:
            old = conn.execute("SELECT status FROM alarm_records WHERE id = ?", (record_id,)).fetchone()
            if not old:
                return False
            old_status = old["status"]
            now = datetime.now()
            conn.execute("""
                UPDATE alarm_records
                SET status = 'withdrawn', operator = ?, updated_at = ?,
                    is_manual_modified = 1
                WHERE id = ?
            """, (operator, now.strftime("%Y-%m-%d %H:%M:%S"), record_id))
            self._log_operation(conn, record_id, "withdraw", old_status, "withdrawn",
                               operator, reason)
            return True

    def get_record(self, record_id: int) -> Optional[AlarmRecord]:
        with self._get_conn() as conn:
            row = conn.execute("SELECT * FROM alarm_records WHERE id = ?", (record_id,)).fetchone()
            return self._row_to_record(row) if row else None

    def get_records(self, filters: Optional[Dict] = None) -> List[AlarmRecord]:
        with self._get_conn() as conn:
            query = "SELECT * FROM alarm_records WHERE 1=1"
            params = []
            if filters:
                if "status" in filters and filters["status"]:
                    query += " AND status = ?"
                    params.append(filters["status"])
                if "source" in filters and filters["source"]:
                    query += " AND source = ?"
                    params.append(filters["source"])
                if "bridge_name" in filters and filters["bridge_name"]:
                    query += " AND bridge_name LIKE ?"
                    params.append(f"%{filters['bridge_name']}%")
                if "team" in filters and filters["team"]:
                    query += " AND team = ?"
                    params.append(filters["team"])
                if "start_time" in filters and filters["start_time"]:
                    query += " AND alarm_time >= ?"
                    params.append(filters["start_time"])
                if "end_time" in filters and filters["end_time"]:
                    query += " AND alarm_time <= ?"
                    params.append(filters["end_time"])
                if "is_manual_modified" in filters:
                    query += " AND is_manual_modified = ?"
                    params.append(1 if filters["is_manual_modified"] else 0)
            query += " ORDER BY alarm_time DESC"
            rows = conn.execute(query, params).fetchall()
            return [self._row_to_record(r) for r in rows]

    def get_operation_logs(self, record_id: Optional[int] = None) -> List[OperationLog]:
        with self._get_conn() as conn:
            query = "SELECT * FROM operation_logs WHERE 1=1"
            params = []
            if record_id:
                query += " AND record_id = ?"
                params.append(record_id)
            query += " ORDER BY created_at DESC"
            rows = conn.execute(query, params).fetchall()
            return [self._row_to_log(r) for r in rows]

    def _log_operation(self, conn, record_id: int, action: str,
                         old_status: str, new_status: str, operator: str,
                         reason: str, field_name: str = "",
                         old_value: str = "", new_value: str = ""):
        now = datetime.now()
        conn.execute("""
            INSERT INTO operation_logs (
                record_id, action, old_status, new_status, operator,
                reason, field_name, old_value, new_value, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            record_id, action, old_status, new_status, operator,
            reason, field_name, old_value, new_value,
            now.strftime("%Y-%m-%d %H:%M:%S"),
        ))

    def _row_to_record(self, row: Any) -> AlarmRecord:
        return AlarmRecord(
            id=row["id"],
            source=row["source"],
            record_no=row["record_no"],
            bridge_name=row["bridge_name"],
            position=row["position"],
            displacement=row["displacement"],
            threshold=row["threshold"],
            threshold_level=row["threshold_level"],
            alarm_time=datetime.strptime(row["alarm_time"], "%Y-%m-%d %H:%M:%S"),
            status=RecordStatus.from_str(row["status"]),
            pending_reason=row["pending_reason"],
            is_manual_modified=bool(row["is_manual_modified"]),
            operator=row["operator"],
            remark=row["remark"],
            vibration_file=row["vibration_file"],
            team=row["team"],
            created_at=datetime.strptime(row["created_at"], "%Y-%m-%d %H:%M:%S"),
            updated_at=datetime.strptime(row["updated_at"], "%Y-%m-%d %H:%M:%S"),
        )

    def _row_to_log(self, row: Any) -> OperationLog:
        return OperationLog(
            id=row["id"],
            record_id=row["record_id"],
            action=row["action"],
            old_status=row["old_status"],
            new_status=row["new_status"],
            operator=row["operator"],
            reason=row["reason"],
            field_name=row["field_name"],
            old_value=row["old_value"],
            new_value=row["new_value"],
            created_at=datetime.strptime(row["created_at"], "%Y-%m-%d %H:%M:%S"),
        )
