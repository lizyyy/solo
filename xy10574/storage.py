import json
import sqlite3
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path

from models import (
    Lead, LeadStatus, BlockReason, CallResult,
    BlacklistEntry, CallHistory, CallbackSchedule,
    TimezoneRule, ComplianceRule, OperationLog
)


class Storage:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.data_dir / "call_center.db"
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.executescript("""
        CREATE TABLE IF NOT EXISTS leads (
            id TEXT PRIMARY KEY,
            phone TEXT NOT NULL,
            name TEXT,
            type TEXT,
            region TEXT,
            timezone TEXT,
            created_at TEXT,
            status TEXT,
            block_reason TEXT,
            manual_release_reason TEXT,
            source_file TEXT,
            extra_data TEXT
        );

        CREATE TABLE IF NOT EXISTS blacklist (
            id TEXT PRIMARY KEY,
            phone TEXT NOT NULL,
            reason TEXT,
            created_at TEXT,
            source TEXT,
            is_active INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS call_history (
            id TEXT PRIMARY KEY,
            lead_id TEXT,
            phone TEXT,
            call_time TEXT,
            result TEXT,
            agent TEXT,
            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS callback_schedule (
            id TEXT PRIMARY KEY,
            lead_id TEXT,
            phone TEXT,
            scheduled_time TEXT,
            timezone TEXT,
            reason TEXT,
            created_by TEXT,
            created_at TEXT,
            is_done INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS timezone_rules (
            id TEXT PRIMARY KEY,
            region TEXT,
            timezone TEXT,
            call_window_start INTEGER,
            call_window_end INTEGER,
            is_active INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS compliance_rules (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            phone_pattern TEXT,
            time_window_start INTEGER,
            time_window_end INTEGER
        );

        CREATE TABLE IF NOT EXISTS operation_logs (
            id TEXT PRIMARY KEY,
            operation_type TEXT,
            target_id TEXT,
            target_type TEXT,
            operator TEXT,
            timestamp TEXT,
            previous_state TEXT,
            new_state TEXT,
            reason TEXT
        );

        CREATE TABLE IF NOT EXISTS import_sessions (
            id TEXT PRIMARY KEY,
            file_name TEXT,
            file_type TEXT,
            imported_at TEXT,
            record_count INTEGER,
            status TEXT
        );

        CREATE TABLE IF NOT EXISTS check_sessions (
            id TEXT PRIMARY KEY,
            check_time TEXT,
            total_leads INTEGER,
            callable_count INTEGER,
            deferred_count INTEGER,
            blocked_count INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
        CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
        CREATE INDEX IF NOT EXISTS idx_blacklist_phone ON blacklist(phone);
        CREATE INDEX IF NOT EXISTS idx_callback_phone ON callback_schedule(phone);
        CREATE INDEX IF NOT EXISTS idx_logs_target ON operation_logs(target_id, target_type);
        """)
        
        conn.commit()
        conn.close()

    def _to_datetime(self, s: Optional[str]) -> Optional[datetime]:
        return datetime.fromisoformat(s) if s else None

    def _from_datetime(self, dt: Optional[datetime]) -> Optional[str]:
        return dt.isoformat() if dt else None

    def _to_json(self, obj: Any) -> str:
        return json.dumps(obj, ensure_ascii=False)

    def _from_json(self, s: Optional[str]) -> Dict[str, Any]:
        return json.loads(s) if s else {}

    def _execute(self, sql: str, params: tuple = ()):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(sql, params)
        conn.commit()
        conn.close()

    def _query_one(self, sql: str, params: tuple = ()):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(sql, params)
        row = cursor.fetchone()
        conn.close()
        return row

    def _query_all(self, sql: str, params: tuple = ()):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        conn.close()
        return rows

    def save_lead(self, lead: Lead) -> bool:
        existing = self._query_one("SELECT id FROM leads WHERE id = ?", (lead.id,))
        block_reason_value = lead.block_reason.value if lead.block_reason else None
        if existing:
            sql = "UPDATE leads SET phone=?, name=?, type=?, region=?, timezone=?, status=?, block_reason=?, manual_release_reason=?, extra_data=? WHERE id=?"
            params = (
                lead.phone, lead.name, lead.type, lead.region, lead.timezone,
                lead.status.value, block_reason_value,
                lead.manual_release_reason, self._to_json(lead.extra_data),
                lead.id
            )
            self._execute(sql, params)
            return False
        else:
            sql = "INSERT INTO leads (id, phone, name, type, region, timezone, created_at, status, block_reason, manual_release_reason, source_file, extra_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            params = (
                lead.id, lead.phone, lead.name, lead.type, lead.region,
                lead.timezone, self._from_datetime(lead.created_at),
                lead.status.value, block_reason_value,
                lead.manual_release_reason, lead.source_file,
                self._to_json(lead.extra_data)
            )
            self._execute(sql, params)
            return True

    def get_lead(self, lead_id: str) -> Optional[Lead]:
        row = self._query_one("SELECT * FROM leads WHERE id = ?", (lead_id,))
        if not row:
            return None
        return Lead(
            id=row[0], phone=row[1], name=row[2], type=row[3], region=row[4],
            timezone=row[5], created_at=self._to_datetime(row[6]),
            status=LeadStatus(row[7]),
            block_reason=BlockReason(row[8]) if row[8] else None,
            manual_release_reason=row[9], source_file=row[10],
            extra_data=self._from_json(row[11])
        )

    def get_all_leads(self) -> List[Lead]:
        rows = self._query_all("SELECT * FROM leads")
        return [
            Lead(
                id=r[0], phone=r[1], name=r[2], type=r[3], region=r[4],
                timezone=r[5], created_at=self._to_datetime(r[6]),
                status=LeadStatus(r[7]),
                block_reason=BlockReason(r[8]) if r[8] else None,
                manual_release_reason=r[9], source_file=r[10],
                extra_data=self._from_json(r[11])
            ) for r in rows
        ]

    def get_leads_by_status(self, status: LeadStatus) -> List[Lead]:
        rows = self._query_all("SELECT * FROM leads WHERE status = ?", (status.value,))
        return [
            Lead(
                id=r[0], phone=r[1], name=r[2], type=r[3], region=r[4],
                timezone=r[5], created_at=self._to_datetime(r[6]),
                status=LeadStatus(r[7]),
                block_reason=BlockReason(r[8]) if r[8] else None,
                manual_release_reason=r[9], source_file=r[10],
                extra_data=self._from_json(r[11])
            ) for r in rows
        ]

    def get_leads_by_phone(self, phone: str) -> List[Lead]:
        rows = self._query_all("SELECT * FROM leads WHERE phone = ?", (phone,))
        return [
            Lead(
                id=r[0], phone=r[1], name=r[2], type=r[3], region=r[4],
                timezone=r[5], created_at=self._to_datetime(r[6]),
                status=LeadStatus(r[7]),
                block_reason=BlockReason(r[8]) if r[8] else None,
                manual_release_reason=r[9], source_file=r[10],
                extra_data=self._from_json(r[11])
            ) for r in rows
        ]

    def is_phone_in_blacklist(self, phone: str) -> bool:
        row = self._query_one(
            "SELECT 1 FROM blacklist WHERE phone = ? AND is_active = 1 LIMIT 1",
            (phone,)
        )
        return row is not None

    def get_blacklist_entry(self, phone: str) -> Optional[BlacklistEntry]:
        row = self._query_one(
            "SELECT * FROM blacklist WHERE phone = ? AND is_active = 1 LIMIT 1",
            (phone,)
        )
        if not row:
            return None
        return BlacklistEntry(
            id=row[0], phone=row[1], reason=row[2],
            created_at=self._to_datetime(row[3]), source=row[4],
            is_active=bool(row[5])
        )

    def save_blacklist(self, entry: BlacklistEntry):
        self._execute(
            "INSERT OR REPLACE INTO blacklist (id, phone, reason, created_at, source, is_active) VALUES (?, ?, ?, ?, ?, ?)",
            (entry.id, entry.phone, entry.reason,
             self._from_datetime(entry.created_at), entry.source,
             1 if entry.is_active else 0)
        )

    def get_active_callbacks(self, phone: str = None) -> List[CallbackSchedule]:
        if phone:
            rows = self._query_all(
                "SELECT * FROM callback_schedule WHERE phone = ? AND is_done = 0",
                (phone,)
            )
        else:
            rows = self._query_all("SELECT * FROM callback_schedule WHERE is_done = 0")
        return [
            CallbackSchedule(
                id=r[0], lead_id=r[1], phone=r[2],
                scheduled_time=self._to_datetime(r[3]), timezone=r[4],
                reason=r[5], created_by=r[6],
                created_at=self._to_datetime(r[7]), is_done=bool(r[8])
            ) for r in rows
        ]

    def save_callback(self, callback: CallbackSchedule):
        self._execute(
            "INSERT OR REPLACE INTO callback_schedule (id, lead_id, phone, scheduled_time, timezone, reason, created_by, created_at, is_done) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (callback.id, callback.lead_id, callback.phone,
             self._from_datetime(callback.scheduled_time), callback.timezone,
             callback.reason, callback.created_by,
             self._from_datetime(callback.created_at),
             1 if callback.is_done else 0)
        )

    def mark_callback_done(self, callback_id: str):
        self._execute(
            "UPDATE callback_schedule SET is_done = 1 WHERE id = ?",
            (callback_id,)
        )

    def get_timezone_rules(self) -> List[TimezoneRule]:
        rows = self._query_all("SELECT * FROM timezone_rules WHERE is_active = 1")
        return [
            TimezoneRule(
                id=r[0], region=r[1], timezone=r[2],
                call_window_start=r[3], call_window_end=r[4],
                is_active=bool(r[5])
            ) for r in rows
        ]

    def get_timezone_rule(self, region: str) -> Optional[TimezoneRule]:
        rows = self._query_all(
            "SELECT * FROM timezone_rules WHERE region = ? AND is_active = 1 LIMIT 1",
            (region,)
        )
        if not rows:
            return None
        r = rows[0]
        return TimezoneRule(
            id=r[0], region=r[1], timezone=r[2],
            call_window_start=r[3], call_window_end=r[4],
            is_active=bool(r[5])
        )

    def save_timezone_rule(self, rule: TimezoneRule):
        self._execute(
            "INSERT OR REPLACE INTO timezone_rules (id, region, timezone, call_window_start, call_window_end, is_active) VALUES (?, ?, ?, ?, ?, ?)",
            (rule.id, rule.region, rule.timezone,
             rule.call_window_start, rule.call_window_end,
             1 if rule.is_active else 0)
        )

    def get_compliance_rules(self) -> List[ComplianceRule]:
        rows = self._query_all("SELECT * FROM compliance_rules WHERE is_active = 1")
        return [
            ComplianceRule(
                id=r[0], name=r[1], description=r[2],
                is_active=bool(r[3]), phone_pattern=r[4],
                time_window_start=r[5], time_window_end=r[6]
            ) for r in rows
        ]

    def save_compliance_rule(self, rule: ComplianceRule):
        self._execute(
            "INSERT OR REPLACE INTO compliance_rules (id, name, description, is_active, phone_pattern, time_window_start, time_window_end) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (rule.id, rule.name, rule.description,
             1 if rule.is_active else 0, rule.phone_pattern,
             rule.time_window_start, rule.time_window_end)
        )

    def get_call_history(self, phone: str) -> List[CallHistory]:
        rows = self._query_all(
            "SELECT * FROM call_history WHERE phone = ? ORDER BY call_time DESC",
            (phone,)
        )
        return [
            CallHistory(
                id=r[0], lead_id=r[1], phone=r[2],
                call_time=self._to_datetime(r[3]), result=CallResult(r[4]),
                agent=r[5], notes=r[6]
            ) for r in rows
        ]

    def save_call_history(self, history: CallHistory):
        self._execute(
            "INSERT OR REPLACE INTO call_history (id, lead_id, phone, call_time, result, agent, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (history.id, history.lead_id, history.phone,
             self._from_datetime(history.call_time), history.result.value,
             history.agent, history.notes)
        )

    def log_operation(self, operation_type: str, target_id: str, target_type: str,
                      operator: str, previous_state: str, new_state: str,
                      reason: str = ""):
        log = OperationLog(
            id=str(uuid.uuid4()),
            operation_type=operation_type,
            target_id=target_id,
            target_type=target_type,
            operator=operator,
            timestamp=datetime.now(),
            previous_state=previous_state,
            new_state=new_state,
            reason=reason
        )
        self._execute(
            "INSERT INTO operation_logs (id, operation_type, target_id, target_type, operator, timestamp, previous_state, new_state, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (log.id, log.operation_type, log.target_id, log.target_type,
             log.operator, self._from_datetime(log.timestamp),
             log.previous_state, log.new_state, log.reason)
        )

    def get_operation_logs(self, target_id: str = None,
                           target_type: str = None) -> List[OperationLog]:
        if target_id and target_type:
            rows = self._query_all(
                "SELECT * FROM operation_logs WHERE target_id = ? AND target_type = ? ORDER BY timestamp DESC",
                (target_id, target_type)
            )
        elif target_type:
            rows = self._query_all(
                "SELECT * FROM operation_logs WHERE target_type = ? ORDER BY timestamp DESC",
                (target_type,)
            )
        else:
            rows = self._query_all(
                "SELECT * FROM operation_logs ORDER BY timestamp DESC"
            )
        return [
            OperationLog(
                id=r[0], operation_type=r[1], target_id=r[2],
                target_type=r[3], operator=r[4],
                timestamp=self._to_datetime(r[5]),
                previous_state=r[6], new_state=r[7], reason=r[8]
            ) for r in rows
        ]

    def record_import_session(self, file_name: str, file_type: str,
                             record_count: int, status: str = "completed"):
        self._execute(
            "INSERT INTO import_sessions (id, file_name, file_type, imported_at, record_count, status) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), file_name, file_type,
             self._from_datetime(datetime.now()),
             record_count, status)
        )

    def get_import_sessions(self) -> List[Dict]:
        rows = self._query_all(
            "SELECT * FROM import_sessions ORDER BY imported_at DESC LIMIT 10"
        )
        return [
            {
                "id": r[0],
                "file_name": r[1],
                "file_type": r[2],
                "imported_at": r[3],
                "record_count": r[4],
                "status": r[5]
            } for r in rows
        ]

    def get_import_session_exists(self, file_name: str) -> bool:
        row = self._query_one(
            "SELECT 1 FROM import_sessions WHERE file_name = ? LIMIT 1",
            (file_name,)
        )
        return row is not None

    def record_check_session(self, total_leads: int, callable_count: int,
                           deferred_count: int, blocked_count: int):
        self._execute(
            "INSERT INTO check_sessions (id, check_time, total_leads, callable_count, deferred_count, blocked_count) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()),
             self._from_datetime(datetime.now()),
             total_leads, callable_count, deferred_count, blocked_count)
        )

    def get_check_sessions(self) -> List[Dict]:
        rows = self._query_all(
            "SELECT * FROM check_sessions ORDER BY check_time DESC LIMIT 10"
        )
        return [
            {
                "id": r[0],
                "check_time": r[1],
                "total_leads": r[2],
                "callable_count": r[3],
                "deferred_count": r[4],
                "blocked_count": r[5]
            } for r in rows
        ]

    def clear_all(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        for table in [
            "leads", "blacklist", "call_history", "callback_schedule",
            "timezone_rules", "compliance_rules", "operation_logs",
            "import_sessions", "check_sessions"
        ]:
            cursor.execute(f"DELETE FROM {table}")
        conn.commit()
        conn.close()
