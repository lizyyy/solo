import sqlite3
import json
from typing import List, Optional, Tuple
from models import GpsReleaseRecord, ImportLog, Status, ImportMode


DB_PATH = "gps_release.db"

SCHEMA_RECORDS = """
CREATE TABLE IF NOT EXISTS gps_release_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_no TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    plate_no TEXT,
    vehicle_model TEXT,
    gps_fee REAL,
    payment_ref TEXT,
    payment_date TEXT,
    payment_amount REAL,
    refund_applied INTEGER,
    refund_amount REAL,
    approval_email TEXT,
    remarks TEXT,
    receipt_info TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'initial',
    is_old_format INTEGER NOT NULL DEFAULT 0,
    confirmed_by TEXT,
    confirmed_at TEXT,
    batch_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""

SCHEMA_IMPORT_LOGS = """
CREATE TABLE IF NOT EXISTS import_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    import_time TEXT NOT NULL,
    total_records INTEGER NOT NULL DEFAULT 0,
    inserted INTEGER NOT NULL DEFAULT 0,
    skipped INTEGER NOT NULL DEFAULT 0,
    updated INTEGER NOT NULL DEFAULT 0,
    conflicted INTEGER NOT NULL DEFAULT 0,
    details TEXT NOT NULL DEFAULT '[]'
);
"""


def get_conn(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db(db_path: str = DB_PATH):
    conn = get_conn(db_path)
    conn.executescript(SCHEMA_RECORDS)
    conn.executescript(SCHEMA_IMPORT_LOGS)
    conn.commit()
    conn.close()


def _row_to_record(row) -> GpsReleaseRecord:
    return GpsReleaseRecord(
        id=row["id"],
        contract_no=row["contract_no"],
        customer_name=row["customer_name"],
        plate_no=row["plate_no"],
        vehicle_model=row["vehicle_model"],
        gps_fee=row["gps_fee"],
        payment_ref=row["payment_ref"],
        payment_date=row["payment_date"],
        payment_amount=row["payment_amount"],
        refund_applied=row["refund_applied"],
        refund_amount=row["refund_amount"],
        approval_email=row["approval_email"],
        remarks=row["remarks"],
        receipt_info=row["receipt_info"],
        status=row["status"],
        source=row["source"],
        is_old_format=row["is_old_format"],
        confirmed_by=row["confirmed_by"],
        confirmed_at=row["confirmed_at"],
        batch_id=row["batch_id"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _row_to_import_log(row) -> ImportLog:
    return ImportLog(
        id=row["id"],
        batch_id=row["batch_id"],
        file_name=row["file_name"],
        import_time=row["import_time"],
        total_records=row["total_records"],
        inserted=row["inserted"],
        skipped=row["skipped"],
        updated=row["updated"],
        conflicted=row["conflicted"],
        details=row["details"],
    )


INSERT_SQL = """
INSERT INTO gps_release_records (
    contract_no, customer_name, plate_no, vehicle_model, gps_fee,
    payment_ref, payment_date, payment_amount, refund_applied, refund_amount,
    approval_email, remarks, receipt_info, status, source,
    is_old_format, confirmed_by, confirmed_at, batch_id, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""

UPDATE_SQL = """
UPDATE gps_release_records SET
    customer_name=?, plate_no=?, vehicle_model=?, gps_fee=?,
    payment_ref=?, payment_date=?, payment_amount=?, refund_applied=?, refund_amount=?,
    approval_email=?, remarks=?, receipt_info=?, is_old_format=?,
    batch_id=?, updated_at=?
WHERE contract_no=?
"""


def insert_record(conn: sqlite3.Connection, rec: GpsReleaseRecord) -> int:
    cur = conn.execute(INSERT_SQL, (
        rec.contract_no, rec.customer_name, rec.plate_no, rec.vehicle_model,
        rec.gps_fee, rec.payment_ref, rec.payment_date, rec.payment_amount,
        rec.refund_applied, rec.refund_amount, rec.approval_email, rec.remarks,
        rec.receipt_info, rec.status, rec.source, rec.is_old_format,
        rec.confirmed_by, rec.confirmed_at, rec.batch_id, rec.created_at, rec.updated_at,
    ))
    conn.commit()
    return cur.lastrowid


def update_record(conn: sqlite3.Connection, rec: GpsReleaseRecord):
    existing = get_record(conn, rec.contract_no)
    conn.execute(UPDATE_SQL, (
        rec.customer_name, rec.plate_no, rec.vehicle_model, rec.gps_fee,
        rec.payment_ref, rec.payment_date, rec.payment_amount, rec.refund_applied,
        rec.refund_amount, rec.approval_email, rec.remarks, rec.receipt_info,
        rec.is_old_format,
        rec.batch_id, rec.updated_at, rec.contract_no,
    ))
    conn.commit()


def get_record(conn: sqlite3.Connection, contract_no: str) -> Optional[GpsReleaseRecord]:
    row = conn.execute(
        "SELECT * FROM gps_release_records WHERE contract_no=?", (contract_no,)
    ).fetchone()
    if row:
        return _row_to_record(row)
    return None


def list_records(
    conn: sqlite3.Connection,
    status: Optional[str] = None,
    batch_id: Optional[str] = None,
) -> List[GpsReleaseRecord]:
    sql = "SELECT * FROM gps_release_records WHERE 1=1"
    params = []
    if status:
        sql += " AND status=?"
        params.append(status)
    if batch_id:
        sql += " AND batch_id=?"
        params.append(batch_id)
    sql += " ORDER BY id"
    rows = conn.execute(sql, params).fetchall()
    return [_row_to_record(r) for r in rows]


def update_status(
    conn: sqlite3.Connection,
    contract_no: str,
    status: str,
    confirmed_by: Optional[str] = None,
):
    from datetime import datetime
    confirmed_at = datetime.now().isoformat() if confirmed_by else None
    conn.execute(
        "UPDATE gps_release_records SET status=?, confirmed_by=?, confirmed_at=?, updated_at=? WHERE contract_no=?",
        (status, confirmed_by, confirmed_at, datetime.now().isoformat(), contract_no),
    )
    conn.commit()


def supplement_record(conn: sqlite3.Connection, contract_no: str, fields: dict):
    existing = get_record(conn, contract_no)
    if not existing:
        return False
    from datetime import datetime
    updates = {}
    for k, v in fields.items():
        if k in ("contract_no", "id", "created_at"):
            continue
        if v is not None and v != "":
            updates[k] = v
    if updates:
        updates["updated_at"] = datetime.now().isoformat()
        sets = ", ".join(f"{k}=?" for k in updates)
        vals = list(updates.values()) + [contract_no]
        conn.execute(f"UPDATE gps_release_records SET {sets} WHERE contract_no=?", vals)
        conn.commit()
    return True


def get_import_log(conn: sqlite3.Connection, batch_id: str) -> Optional[ImportLog]:
    row = conn.execute(
        "SELECT * FROM import_logs WHERE batch_id=?", (batch_id,)
    ).fetchone()
    if row:
        return _row_to_import_log(row)
    return None


def list_import_logs(conn: sqlite3.Connection) -> List[ImportLog]:
    rows = conn.execute(
        "SELECT * FROM import_logs ORDER BY id DESC"
    ).fetchall()
    return [_row_to_import_log(r) for r in rows]


def insert_import_log(conn: sqlite3.Connection, log: ImportLog) -> int:
    cur = conn.execute(
        "INSERT INTO import_logs (batch_id, file_name, import_time, total_records, inserted, skipped, updated, conflicted, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (log.batch_id, log.file_name, log.import_time, log.total_records, log.inserted, log.skipped, log.updated, log.conflicted, log.details),
    )
    conn.commit()
    return cur.lastrowid


def get_stats(conn: sqlite3.Connection) -> dict:
    rows = conn.execute(
        "SELECT status, COUNT(*) as cnt FROM gps_release_records GROUP BY status"
    ).fetchall()
    stats = {r["status"]: r["cnt"] for r in rows}
    total = conn.execute("SELECT COUNT(*) as cnt FROM gps_release_records").fetchone()["cnt"]
    batches = conn.execute("SELECT COUNT(DISTINCT batch_id) as cnt FROM gps_release_records").fetchone()["cnt"]
    conflicts = conn.execute("SELECT COUNT(*) as cnt FROM gps_release_records WHERE status='needs_review'").fetchone()["cnt"]
    return {
        "total": total,
        "batches": batches,
        "by_status": stats,
        "needs_review_count": conflicts,
    }


def record_exists(conn: sqlite3.Connection, contract_no: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM gps_release_records WHERE contract_no=?", (contract_no,)
    ).fetchone()
    return row is not None


def fields_differ(conn: sqlite3.Connection, rec: GpsReleaseRecord) -> bool:
    existing = get_record(conn, rec.contract_no)
    if not existing:
        return False
    for f in ["customer_name", "plate_no", "vehicle_model", "gps_fee",
              "payment_ref", "payment_date", "payment_amount",
              "refund_applied", "refund_amount", "approval_email",
              "remarks", "receipt_info"]:
        new_v = getattr(rec, f)
        old_v = getattr(existing, f)
        if new_v is not None and new_v != "" and new_v != 0:
            if old_v is not None and old_v != "" and old_v != 0:
                if str(new_v) != str(old_v):
                    return True
    return False
