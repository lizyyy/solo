import json
import sqlite3
from datetime import datetime
from typing import List, Optional, Dict, Any

from .models import Attachment, ReviewDecision, BudgetOccupancy
from .normalizer import NormalizedRecord


SCHEMA = """
CREATE TABLE IF NOT EXISTS records (
    record_id TEXT PRIMARY KEY,
    raw_date TEXT,
    date TEXT,
    raw_amount TEXT,
    amount REAL,
    currency TEXT,
    raw_handler TEXT,
    handler TEXT,
    department TEXT,
    vendor TEXT,
    purpose TEXT,
    budget_code TEXT,
    approval_ref TEXT,
    remark TEXT,
    normalization_notes TEXT,
    batch_id TEXT,
    imported_at TEXT
);

CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id TEXT,
    attachment_type TEXT,
    file_name TEXT,
    received_date TEXT,
    source TEXT,
    batch_id TEXT,
    imported_at TEXT,
    FOREIGN KEY (record_id) REFERENCES records(record_id)
);

CREATE TABLE IF NOT EXISTS decisions (
    record_id TEXT PRIMARY KEY,
    status TEXT,
    reason TEXT,
    confirmed_amount REAL,
    missing_docs TEXT,
    review_notes TEXT,
    reviewer TEXT,
    decision_time TEXT,
    budget_occupancy_note TEXT,
    batch_id TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS decision_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id TEXT,
    old_status TEXT,
    new_status TEXT,
    old_reason TEXT,
    new_reason TEXT,
    old_confirmed_amount REAL,
    new_confirmed_amount REAL,
    old_review_notes TEXT,
    new_review_notes TEXT,
    changed_by TEXT,
    changed_at TEXT,
    change_reason TEXT
);

CREATE TABLE IF NOT EXISTS budget_occupancy (
    budget_code TEXT PRIMARY KEY,
    total_occupied REAL,
    record_ids TEXT,
    details TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS batch_log (
    batch_id TEXT PRIMARY KEY,
    action TEXT,
    record_count INTEGER,
    created_at TEXT,
    notes TEXT
);
"""


class Database:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    def close(self):
        self.conn.close()

    def save_records(
        self, records: List[NormalizedRecord], batch_id: str
    ):
        now = datetime.now().isoformat()
        for rec in records:
            self.conn.execute(
                """INSERT OR REPLACE INTO records
                (record_id, raw_date, date, raw_amount, amount, currency,
                 raw_handler, handler, department, vendor, purpose,
                 budget_code, approval_ref, remark, normalization_notes,
                 batch_id, imported_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    rec.record_id,
                    rec.raw_date,
                    rec.date_str,
                    rec.raw_amount,
                    rec.amount,
                    rec.currency,
                    rec.raw_handler,
                    rec.handler,
                    rec.department,
                    rec.vendor,
                    rec.purpose,
                    rec.budget_code,
                    rec.approval_ref,
                    rec.remark,
                    json.dumps(rec.normalization_notes, ensure_ascii=False),
                    batch_id,
                    now,
                ),
            )
        self.conn.commit()

    def save_attachments(
        self, attachments: List[Attachment], batch_id: str
    ):
        now = datetime.now().isoformat()
        for att in attachments:
            self.conn.execute(
                """INSERT INTO attachments
                (record_id, attachment_type, file_name, received_date,
                 source, batch_id, imported_at)
                VALUES (?,?,?,?,?,?,?)""",
                (
                    att.record_id,
                    att.attachment_type,
                    att.file_name,
                    att.received_date,
                    att.source,
                    batch_id,
                    now,
                ),
            )
        self.conn.commit()

    def save_decisions(
        self, decisions: List[ReviewDecision], batch_id: str
    ):
        now = datetime.now().isoformat()
        for dec in decisions:
            existing = self.conn.execute(
                "SELECT status, reason, confirmed_amount, review_notes FROM decisions WHERE record_id=?",
                (dec.record_id,),
            ).fetchone()
            if existing:
                self.conn.execute(
                    """INSERT INTO decision_history
                    (record_id, old_status, new_status, old_reason, new_reason,
                     old_confirmed_amount, new_confirmed_amount,
                     old_review_notes, new_review_notes,
                     changed_by, changed_at, change_reason)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        dec.record_id,
                        existing["status"],
                        dec.status,
                        existing["reason"],
                        dec.reason,
                        existing["confirmed_amount"],
                        dec.confirmed_amount,
                        existing["review_notes"],
                        dec.review_notes,
                        dec.reviewer,
                        now,
                        dec.reason,
                    ),
                )
            self.conn.execute(
                """INSERT OR REPLACE INTO decisions
                (record_id, status, reason, confirmed_amount, missing_docs,
                 review_notes, reviewer, decision_time, budget_occupancy_note,
                 batch_id, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    dec.record_id,
                    dec.status,
                    dec.reason,
                    dec.confirmed_amount,
                    json.dumps(dec.missing_docs, ensure_ascii=False),
                    dec.review_notes,
                    dec.reviewer,
                    dec.decision_time.isoformat(),
                    dec.budget_occupancy_note,
                    batch_id,
                    now,
                ),
            )
        self.conn.commit()

    def save_budget_occupancy(self, occupancy: Dict[str, BudgetOccupancy]):
        now = datetime.now().isoformat()
        for code, occ in occupancy.items():
            self.conn.execute(
                """INSERT OR REPLACE INTO budget_occupancy
                (budget_code, total_occupied, record_ids, details, updated_at)
                VALUES (?,?,?,?,?)""",
                (
                    code,
                    occ.total_occupied,
                    json.dumps(occ.record_ids, ensure_ascii=False),
                    json.dumps(occ.details, ensure_ascii=False),
                    now,
                ),
            )
        self.conn.commit()

    def save_batch_log(
        self, batch_id: str, action: str, count: int, notes: str
    ):
        now = datetime.now().isoformat()
        self.conn.execute(
            """INSERT OR REPLACE INTO batch_log
            (batch_id, action, record_count, created_at, notes)
            VALUES (?,?,?,?,?)""",
            (batch_id, action, count, now, notes),
        )
        self.conn.commit()

    def get_decision(self, record_id: str) -> Optional[dict]:
        row = self.conn.execute(
            "SELECT * FROM decisions WHERE record_id=?", (record_id,)
        ).fetchone()
        return dict(row) if row else None

    def get_record(self, record_id: str) -> Optional[dict]:
        row = self.conn.execute(
            "SELECT * FROM records WHERE record_id=?", (record_id,)
        ).fetchone()
        return dict(row) if row else None

    def get_attachments_for_record(self, record_id: str) -> List[dict]:
        rows = self.conn.execute(
            "SELECT * FROM attachments WHERE record_id=?", (record_id,)
        ).fetchall()
        return [dict(r) for r in rows]

    def get_all_decisions(self, status: Optional[str] = None) -> List[dict]:
        if status:
            rows = self.conn.execute(
                "SELECT * FROM decisions WHERE status=? ORDER BY decision_time",
                (status,),
            ).fetchall()
        else:
            rows = self.conn.execute(
                "SELECT * FROM decisions ORDER BY decision_time"
            ).fetchall()
        return [dict(r) for r in rows]

    def get_decision_history(self, record_id: str) -> List[dict]:
        rows = self.conn.execute(
            "SELECT * FROM decision_history WHERE record_id=? ORDER BY changed_at",
            (record_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_budget_occupancy(self) -> Dict[str, BudgetOccupancy]:
        rows = self.conn.execute(
            "SELECT * FROM budget_occupancy"
        ).fetchall()
        result = {}
        for row in rows:
            r = dict(row)
            result[r["budget_code"]] = BudgetOccupancy(
                budget_code=r["budget_code"],
                total_occupied=r["total_occupied"],
                record_ids=json.loads(r["record_ids"]),
                details=json.loads(r["details"]),
            )
        return result

    def get_all_records(self) -> List[dict]:
        rows = self.conn.execute(
            "SELECT * FROM records ORDER BY record_id"
        ).fetchall()
        return [dict(r) for r in rows]

    def add_attachment(self, record_id: str, att: Attachment, batch_id: str):
        now = datetime.now().isoformat()
        self.conn.execute(
            """INSERT INTO attachments
            (record_id, attachment_type, file_name, received_date,
             source, batch_id, imported_at)
            VALUES (?,?,?,?,?,?,?)""",
            (
                att.record_id,
                att.attachment_type,
                att.file_name,
                att.received_date,
                att.source,
                batch_id,
                now,
            ),
        )
        self.conn.commit()

    def load_attachments_map(self) -> Dict[str, List[Attachment]]:
        rows = self.conn.execute(
            "SELECT * FROM attachments"
        ).fetchall()
        result: Dict[str, List[Attachment]] = {}
        for row in rows:
            r = dict(row)
            att = Attachment(
                record_id=r["record_id"],
                attachment_type=r["attachment_type"],
                file_name=r["file_name"],
                received_date=r["received_date"],
                source=r["source"],
            )
            result.setdefault(r["record_id"], []).append(att)
        return result

    def load_records_for_review(self, record_ids: Optional[List[str]] = None) -> List[NormalizedRecord]:
        if record_ids:
            placeholders = ",".join("?" * len(record_ids))
            rows = self.conn.execute(
                f"SELECT * FROM records WHERE record_id IN ({placeholders})",
                record_ids,
            ).fetchall()
        else:
            rows = self.conn.execute(
                "SELECT * FROM records"
            ).fetchall()
        result = []
        for row in rows:
            r = dict(row)
            date_val = None
            if r["date"]:
                try:
                    date_val = datetime.strptime(r["date"], "%Y-%m-%d")
                except ValueError:
                    pass
            result.append(NormalizedRecord(
                record_id=r["record_id"],
                raw_date=r["raw_date"],
                date=date_val,
                raw_amount=r["raw_amount"],
                amount=r["amount"],
                currency=r["currency"] or "CNY",
                raw_handler=r["raw_handler"],
                handler=r["handler"],
                department=r["department"],
                vendor=r["vendor"],
                purpose=r["purpose"],
                budget_code=r["budget_code"],
                approval_ref=r["approval_ref"],
                remark=r["remark"],
                normalization_notes=json.loads(r["normalization_notes"]) if r["normalization_notes"] else [],
            ))
        return result
