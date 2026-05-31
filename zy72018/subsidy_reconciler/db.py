import sqlite3
import hashlib
import json
from datetime import datetime
from subsidy_reconciler.models import (
    SOURCE_TYPES,
    ALL_STATUSES,
    STATUS_CONFIRMED,
    STATUS_PENDING_MATERIAL,
    STATUS_PENDING_MANUAL,
    STATUS_OLD_STANDARD,
    ACTION_IMPORTED,
    ACTION_SKIPPED,
    ACTION_UPDATED,
    ACTION_CONFLICT,
)


DB_PATH = "subsidy_reconciler.db"


def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def compute_hash(subsidy_date, movie_name, source_type, subsidy_amount):
    raw = f"{subsidy_date}|{movie_name}|{source_type}|{subsidy_amount}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


class Database:
    def __init__(self, db_path=None):
        self.db_path = db_path or DB_PATH
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self._init_tables()

    def _init_tables(self):
        cur = self.conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS settlement_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_hash TEXT UNIQUE NOT NULL,
                subsidy_date TEXT NOT NULL,
                movie_name TEXT NOT NULL,
                ticket_count INTEGER DEFAULT 0,
                subsidy_amount REAL NOT NULL,
                source_type TEXT NOT NULL,
                source_file TEXT,
                source_line INTEGER,
                status TEXT NOT NULL DEFAULT 'pending_material',
                judgment_reason TEXT,
                match_group TEXT,
                remark TEXT,
                import_batch TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS import_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                total_rows INTEGER DEFAULT 0,
                imported INTEGER DEFAULT 0,
                skipped INTEGER DEFAULT 0,
                updated INTEGER DEFAULT 0,
                conflicted INTEGER DEFAULT 0,
                timestamp TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS audit_trail (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_hash TEXT NOT NULL,
                action TEXT NOT NULL,
                detail TEXT,
                timestamp TEXT NOT NULL,
                operator TEXT DEFAULT 'system'
            )
        """)
        self.conn.commit()

    def insert_record(self, record_hash, subsidy_date, movie_name, ticket_count,
                      subsidy_amount, source_type, source_file, source_line,
                      status, judgment_reason, import_batch):
        now = _now()
        try:
            cur = self.conn.cursor()
            cur.execute("""
                INSERT INTO settlement_records
                    (record_hash, subsidy_date, movie_name, ticket_count,
                     subsidy_amount, source_type, source_file, source_line,
                     status, judgment_reason, import_batch, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (record_hash, subsidy_date, movie_name, ticket_count,
                  subsidy_amount, source_type, source_file, source_line,
                  status, judgment_reason, import_batch, now, now))
            self.conn.commit()
            self._add_audit(record_hash, ACTION_IMPORTED, json.dumps({
                "source_type": source_type, "source_file": source_file,
                "source_line": source_line, "status": status,
                "judgment_reason": judgment_reason
            }, ensure_ascii=False))
            return "imported"
        except sqlite3.IntegrityError:
            return self._handle_duplicate(
                record_hash, subsidy_date, movie_name, ticket_count,
                subsidy_amount, source_type, source_file, source_line,
                status, judgment_reason, import_batch
            )

    def _handle_duplicate(self, record_hash, subsidy_date, movie_name,
                          ticket_count, subsidy_amount, source_type,
                          source_file, source_line, status, judgment_reason,
                          import_batch):
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM settlement_records WHERE record_hash = ?",
                     (record_hash,))
        existing = dict(cur.fetchone())

        core_data_changed = (
            existing["ticket_count"] != ticket_count
            or existing["subsidy_amount"] != subsidy_amount
        )

        if not core_data_changed:
            status_diverged = existing["status"] != status
            if status_diverged:
                self._add_audit(record_hash, ACTION_SKIPPED, json.dumps({
                    "reason": "重复导入，核心数据一致，状态已被对账/补录修改，保留现有状态",
                    "source_file": source_file, "source_line": source_line,
                    "existing_status": existing["status"], "import_status": status
                }, ensure_ascii=False))
            else:
                self._add_audit(record_hash, ACTION_SKIPPED, json.dumps({
                    "reason": "重复导入，数据完全一致",
                    "source_file": source_file, "source_line": source_line
                }, ensure_ascii=False))
            self.conn.commit()
            return "skipped"

        old_values = {
            "ticket_count": existing["ticket_count"],
            "subsidy_amount": existing["subsidy_amount"],
            "status": existing["status"],
            "judgment_reason": existing["judgment_reason"],
        }

        if existing["source_type"] != source_type:
            now = _now()
            cur.execute("""
                UPDATE settlement_records
                SET judgment_reason = ?,
                    remark = COALESCE(remark, '') || ?,
                    updated_at = ?
                WHERE record_hash = ?
            """, (
                f"冲突: 原来源={existing['source_type']}, 新来源={source_type}",
                f"\n[冲突] {now} 来源{source_type}({source_file}#{source_line})与已有来源{existing['source_type']}不一致",
                now, record_hash
            ))
            self._add_audit(record_hash, ACTION_CONFLICT, json.dumps({
                "reason": "核心数据变更且来源类型冲突",
                "old_source": existing["source_type"],
                "new_source": source_type,
                "old_values": old_values,
                "new_values": {"ticket_count": ticket_count,
                               "subsidy_amount": subsidy_amount, "status": status}
            }, ensure_ascii=False))
            self.conn.commit()
            return "conflict"

        now = _now()
        cur.execute("""
            UPDATE settlement_records
            SET ticket_count = ?, subsidy_amount = ?,
                judgment_reason = ?,
                remark = COALESCE(remark, '') || ?,
                updated_at = ?
            WHERE record_hash = ?
        """, (
            ticket_count, subsidy_amount,
            f"核心数据变更: {judgment_reason}",
            f"\n[更新] {now} {json.dumps(old_values, ensure_ascii=False)} → {json.dumps({'ticket_count': ticket_count, 'subsidy_amount': subsidy_amount}, ensure_ascii=False)}",
            now, record_hash
        ))
        self._add_audit(record_hash, ACTION_UPDATED, json.dumps({
            "old_values": old_values,
            "new_values": {"ticket_count": ticket_count,
                           "subsidy_amount": subsidy_amount}
        }, ensure_ascii=False))
        self.conn.commit()
        return "updated"

    def supplement_record(self, record_hash, remark=None, status=None,
                          operator="manual"):
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM settlement_records WHERE record_hash = ?",
                     (record_hash,))
        row = cur.fetchone()
        if not row:
            return None

        existing = dict(row)
        now = _now()
        updates = []
        params = []

        if remark:
            updates.append("remark = COALESCE(remark, '') || ?")
            params.append(f"\n[补录] {now} {remark}")
        if status:
            updates.append("status = ?")
            params.append(status)
            updates.append("judgment_reason = ?")
            old_status = existing["status"]
            params.append(f"人工补录: {old_status} → {status}")
        updates.append("updated_at = ?")
        params.append(now)
        params.append(record_hash)

        cur.execute(
            f"UPDATE settlement_records SET {', '.join(updates)} WHERE record_hash = ?",
            params
        )
        self._add_audit(record_hash, "supplemented", json.dumps({
            "remark": remark, "new_status": status,
            "old_status": existing["status"], "operator": operator
        }, ensure_ascii=False))
        self.conn.commit()
        return dict(cur.execute(
            "SELECT * FROM settlement_records WHERE record_hash = ?",
            (record_hash,)).fetchone())

    def get_all_records(self):
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM settlement_records ORDER BY subsidy_date, movie_name")
        return [dict(r) for r in cur.fetchall()]

    def get_records_by_status(self, status):
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM settlement_records WHERE status = ? ORDER BY subsidy_date",
                     (status,))
        return [dict(r) for r in cur.fetchall()]

    def get_record_by_hash(self, record_hash):
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM settlement_records WHERE record_hash = ?",
                     (record_hash,))
        row = cur.fetchone()
        return dict(row) if row else None

    def update_match_group(self, record_hash, match_group):
        now = _now()
        cur = self.conn.cursor()
        cur.execute("UPDATE settlement_records SET match_group = ?, updated_at = ? WHERE record_hash = ?",
                     (match_group, now, record_hash))
        self.conn.commit()

    def update_status(self, record_hash, status, judgment_reason):
        now = _now()
        cur = self.conn.cursor()
        cur.execute("UPDATE settlement_records SET status = ?, judgment_reason = ?, updated_at = ? WHERE record_hash = ?",
                     (status, judgment_reason, now, record_hash))
        self._add_audit(record_hash, status, json.dumps({
            "status": status, "judgment_reason": judgment_reason
        }, ensure_ascii=False))
        self.conn.commit()

    def add_import_log(self, batch_id, file_name, file_type, total_rows,
                       imported, skipped, updated, conflicted):
        cur = self.conn.cursor()
        cur.execute("""
            INSERT INTO import_log
                (batch_id, file_name, file_type, total_rows, imported,
                 skipped, updated, conflicted, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (batch_id, file_name, file_type, total_rows, imported,
              skipped, updated, conflicted, _now()))
        self.conn.commit()

    def get_import_logs(self):
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM import_log ORDER BY timestamp DESC")
        return [dict(r) for r in cur.fetchall()]

    def _add_audit(self, record_hash, action, detail):
        cur = self.conn.cursor()
        cur.execute("""
            INSERT INTO audit_trail (record_hash, action, detail, timestamp, operator)
            VALUES (?, ?, ?, ?, 'system')
        """, (record_hash, action, detail, _now()))

    def get_audit_trail(self, record_hash=None):
        cur = self.conn.cursor()
        if record_hash:
            cur.execute("SELECT * FROM audit_trail WHERE record_hash = ? ORDER BY timestamp",
                         (record_hash,))
        else:
            cur.execute("SELECT * FROM audit_trail ORDER BY timestamp DESC LIMIT 200")
        return [dict(r) for r in cur.fetchall()]

    def get_status_summary(self):
        cur = self.conn.cursor()
        cur.execute("""
            SELECT status, COUNT(*) as cnt, SUM(subsidy_amount) as total_amount
            FROM settlement_records GROUP BY status
        """)
        return {r["status"]: {"count": r["cnt"], "amount": r["total_amount"] or 0}
                for r in cur.fetchall()}

    def close(self):
        self.conn.close()
