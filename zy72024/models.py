import sqlite3
import hashlib
import json
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "reconciliation.db"


class Database:
    def __init__(self, db_path=None):
        self.db_path = db_path or DB_PATH
        self._init_schema()

    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self):
        with self._connect() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS source_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_file TEXT NOT NULL,
                    sheet_name TEXT,
                    row_number INTEGER NOT NULL,
                    raw_data TEXT NOT NULL,
                    data_hash TEXT NOT NULL UNIQUE,
                    import_batch TEXT NOT NULL,
                    imported_at TEXT NOT NULL,
                    import_status TEXT NOT NULL DEFAULT 'pending',
                    status_note TEXT
                );

                CREATE TABLE IF NOT EXISTS standardized_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_id INTEGER NOT NULL UNIQUE,
                    trans_date TEXT NOT NULL,
                    trans_type TEXT NOT NULL,
                    amount REAL NOT NULL,
                    currency TEXT DEFAULT 'CNY',
                    handler TEXT,
                    department TEXT,
                    bill_no TEXT,
                    remark TEXT,
                    standardized_at TEXT NOT NULL,
                    warnings TEXT,
                    FOREIGN KEY (source_id) REFERENCES source_records(id)
                );

                CREATE TABLE IF NOT EXISTS reconciliation_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    record_id INTEGER NOT NULL UNIQUE,
                    period TEXT NOT NULL,
                    prepaid_balance REAL NOT NULL,
                    reconcile_status TEXT NOT NULL,
                    conflict_detail TEXT,
                    reconciled_at TEXT NOT NULL,
                    FOREIGN KEY (record_id) REFERENCES standardized_records(id)
                );

                CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    record_id INTEGER NOT NULL,
                    note_text TEXT NOT NULL,
                    created_by TEXT DEFAULT 'operator',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (record_id) REFERENCES standardized_records(id)
                );

                CREATE TABLE IF NOT EXISTS import_batches (
                    batch_id TEXT PRIMARY KEY,
                    source_file TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    completed_at TEXT,
                    total_records INTEGER DEFAULT 0,
                    skipped INTEGER DEFAULT 0,
                    updated INTEGER DEFAULT 0,
                    conflicts INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'running'
                );

                CREATE TABLE IF NOT EXISTS change_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    record_id INTEGER NOT NULL,
                    field_name TEXT NOT NULL,
                    old_value TEXT,
                    new_value TEXT,
                    changed_at TEXT NOT NULL,
                    changed_by TEXT DEFAULT 'system',
                    change_note TEXT,
                    FOREIGN KEY (record_id) REFERENCES standardized_records(id)
                );

                CREATE INDEX IF NOT EXISTS idx_source_hash ON source_records(data_hash);
                CREATE INDEX IF NOT EXISTS idx_std_date ON standardized_records(trans_date);
                CREATE INDEX IF NOT EXISTS idx_rec_period ON reconciliation_results(period);
            """)
            conn.commit()

    def compute_hash(self, raw_data: dict) -> str:
        sorted_data = json.dumps(raw_data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(sorted_data.encode('utf-8')).hexdigest()

    def start_batch(self, source_file: str) -> str:
        batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{abs(hash(source_file)) % 10000}"
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO import_batches (batch_id, source_file, started_at) VALUES (?, ?, ?)",
                (batch_id, source_file, datetime.now().isoformat())
            )
            conn.commit()
        return batch_id

    def complete_batch(self, batch_id: str, total: int, skipped: int, updated: int, conflicts: int):
        with self._connect() as conn:
            conn.execute(
                """UPDATE import_batches 
                   SET completed_at = ?, total_records = ?, skipped = ?, updated = ?, conflicts = ?, status = 'completed'
                   WHERE batch_id = ?""",
                (datetime.now().isoformat(), total, skipped, updated, conflicts, batch_id)
            )
            conn.commit()

    def find_existing_record(self, data_hash: str):
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id, raw_data, import_status FROM source_records WHERE data_hash = ?",
                (data_hash,)
            ).fetchone()
            return dict(row) if row else None

    def insert_source_record(self, source_file: str, sheet_name: str, row_number: int,
                             raw_data: dict, batch_id: str, status: str = 'pending', status_note: str = None):
        data_hash = self.compute_hash(raw_data)
        with self._connect() as conn:
            cur = conn.execute(
                """INSERT INTO source_records 
                   (source_file, sheet_name, row_number, raw_data, data_hash, import_batch, imported_at, import_status, status_note)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (source_file, sheet_name, row_number, json.dumps(raw_data, ensure_ascii=False),
                 data_hash, batch_id, datetime.now().isoformat(), status, status_note)
            )
            return cur.lastrowid, data_hash

    def update_source_record_status(self, source_id: int, status: str, status_note: str = None):
        with self._connect() as conn:
            conn.execute(
                "UPDATE source_records SET import_status = ?, status_note = ? WHERE id = ?",
                (status, status_note, source_id)
            )
            conn.commit()

    def insert_standardized_record(self, source_id: int, clean_data: dict, warnings: list = None):
        warnings_json = json.dumps(warnings, ensure_ascii=False) if warnings else None
        with self._connect() as conn:
            cur = conn.execute(
                """INSERT INTO standardized_records 
                   (source_id, trans_date, trans_type, amount, currency, handler, department, bill_no, remark, standardized_at, warnings)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (source_id, clean_data['trans_date'], clean_data['trans_type'],
                 clean_data['amount'], clean_data.get('currency', 'CNY'),
                 clean_data.get('handler'), clean_data.get('department'),
                 clean_data.get('bill_no'), clean_data.get('remark'),
                 datetime.now().isoformat(), warnings_json)
            )
            return cur.lastrowid

    def update_standardized_record(self, record_id: int, clean_data: dict, warnings: list = None):
        old_record = self.get_standardized_record(record_id)
        warnings_json = json.dumps(warnings, ensure_ascii=False) if warnings else None

        changes = []
        for key in ['trans_date', 'trans_type', 'amount', 'currency', 'handler', 'department', 'bill_no', 'remark']:
            old_val = str(old_record.get(key, '')) if old_record.get(key) is not None else ''
            new_val = str(clean_data.get(key, '')) if clean_data.get(key) is not None else ''
            if old_val != new_val:
                changes.append((key, old_val, new_val))

        with self._connect() as conn:
            conn.execute(
                """UPDATE standardized_records 
                   SET trans_date = ?, trans_type = ?, amount = ?, currency = ?, handler = ?, 
                       department = ?, bill_no = ?, remark = ?, standardized_at = ?, warnings = ?
                   WHERE id = ?""",
                (clean_data['trans_date'], clean_data['trans_type'],
                 clean_data['amount'], clean_data.get('currency', 'CNY'),
                 clean_data.get('handler'), clean_data.get('department'),
                 clean_data.get('bill_no'), clean_data.get('remark'),
                 datetime.now().isoformat(), warnings_json, record_id)
            )

            for field_name, old_val, new_val in changes:
                conn.execute(
                    """INSERT INTO change_log (record_id, field_name, old_value, new_value, changed_at, change_note)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (record_id, field_name, old_val, new_val, datetime.now().isoformat(), 'reimport update')
                )
            conn.commit()
        return len(changes)

    def get_standardized_record(self, record_id: int):
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM standardized_records WHERE id = ?", (record_id,)).fetchone()
            return dict(row) if row else None

    def get_standardized_by_source(self, source_id: int):
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM standardized_records WHERE source_id = ?", (source_id,)).fetchone()
            return dict(row) if row else None

    def get_source_record(self, source_id: int):
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM source_records WHERE id = ?", (source_id,)).fetchone()
            return dict(row) if row else None

    def insert_reconciliation_result(self, record_id: int, period: str, balance: float,
                                     status: str, conflict_detail: str = None):
        with self._connect() as conn:
            cur = conn.execute(
                """INSERT OR REPLACE INTO reconciliation_results 
                   (record_id, period, prepaid_balance, reconcile_status, conflict_detail, reconciled_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (record_id, period, balance, status, conflict_detail, datetime.now().isoformat())
            )
            return cur.lastrowid

    def add_note(self, record_id: int, note_text: str, created_by: str = 'operator'):
        with self._connect() as conn:
            cur = conn.execute(
                "INSERT INTO notes (record_id, note_text, created_by, created_at) VALUES (?, ?, ?, ?)",
                (record_id, note_text, created_by, datetime.now().isoformat())
            )
            return cur.lastrowid

    def get_record_with_source(self, record_id: int):
        with self._connect() as conn:
            row = conn.execute(
                """SELECT s.*, r.source_file, r.sheet_name, r.row_number, r.raw_data,
                          rc.period, rc.prepaid_balance, rc.reconcile_status, rc.conflict_detail
                   FROM standardized_records s
                   JOIN source_records r ON s.source_id = r.id
                   LEFT JOIN reconciliation_results rc ON rc.record_id = s.id
                   WHERE s.id = ?""",
                (record_id,)
            ).fetchone()
            return dict(row) if row else None

    def get_record_notes(self, record_id: int):
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM notes WHERE record_id = ? ORDER BY created_at",
                (record_id,)
            ).fetchall()
            return [dict(r) for r in rows]

    def get_record_changes(self, record_id: int):
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM change_log WHERE record_id = ? ORDER BY changed_at",
                (record_id,)
            ).fetchall()
            return [dict(r) for r in rows]

    def get_all_records(self, period: str = None):
        with self._connect() as conn:
            query = """
                SELECT s.*, r.source_file, r.sheet_name, r.row_number,
                       rc.period, rc.prepaid_balance, rc.reconcile_status, rc.conflict_detail
                FROM standardized_records s
                JOIN source_records r ON s.source_id = r.id
                LEFT JOIN reconciliation_results rc ON rc.record_id = s.id
            """
            params = []
            if period:
                query += " WHERE rc.period = ?"
                params.append(period)
            query += " ORDER BY s.trans_date"
            rows = conn.execute(query, params).fetchall()
            return [dict(r) for r in rows]

    def get_import_summary(self, batch_id: str = None):
        with self._connect() as conn:
            if batch_id:
                row = conn.execute(
                    "SELECT * FROM import_batches WHERE batch_id = ?", (batch_id,)
                ).fetchone()
                return dict(row) if row else None
            else:
                rows = conn.execute(
                    "SELECT * FROM import_batches ORDER BY started_at DESC LIMIT 10"
                ).fetchall()
                return [dict(r) for r in rows]

    def get_balance_summary(self, period: str = None):
        with self._connect() as conn:
            query = """
                SELECT 
                    COUNT(*) as total_records,
                    SUM(CASE WHEN trans_type = 'prepay' THEN amount ELSE 0 END) as total_prepay,
                    SUM(CASE WHEN trans_type = 'usage' THEN amount ELSE 0 END) as total_usage,
                    SUM(CASE WHEN reconcile_status = 'matched' THEN 1 ELSE 0 END) as matched,
                    SUM(CASE WHEN reconcile_status = 'conflict' THEN 1 ELSE 0 END) as conflicts,
                    SUM(CASE WHEN reconcile_status = 'warning' THEN 1 ELSE 0 END) as warnings,
                    SUM(CASE WHEN reconcile_status = 'pending' THEN 1 ELSE 0 END) as pending
                FROM standardized_records s
                LEFT JOIN reconciliation_results rc ON rc.record_id = s.id
            """
            params = []
            if period:
                query += " WHERE rc.period = ?"
                params.append(period)
            row = conn.execute(query, params).fetchone()
            return dict(row)

    def get_conflicts(self):
        with self._connect() as conn:
            rows = conn.execute(
                """SELECT s.id, s.trans_date, s.trans_type, s.amount, s.handler,
                          rc.conflict_detail, r.source_file, r.row_number
                   FROM standardized_records s
                   JOIN reconciliation_results rc ON rc.record_id = s.id
                   JOIN source_records r ON r.id = s.source_id
                   WHERE rc.reconcile_status = 'conflict'
                   ORDER BY s.trans_date"""
            ).fetchall()
            return [dict(r) for r in rows]

    def delete_database(self):
        if self.db_path.exists():
            self.db_path.unlink()
