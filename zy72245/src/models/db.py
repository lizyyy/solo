import sqlite3
import json
import uuid
from datetime import datetime
from typing import Optional


DB_PATH = "green_bond.db"

VERIFICATION_STEP_IMPORT = "柜台流水尾号导入"
VERIFICATION_STEP_EMAIL_REVIEW = "基金会计补看客户经理补充邮件"
VERIFICATION_STEP_BALANCE_UPDATE = "余额变化表更新"

ALL_STEPS = [
    VERIFICATION_STEP_IMPORT,
    VERIFICATION_STEP_EMAIL_REVIEW,
    VERIFICATION_STEP_BALANCE_UPDATE,
]

APPROVER_STATUS_PINYIN_ONLY = "pinyin_only"
APPROVER_STATUS_NORMAL = "normal"
APPROVER_STATUS_PENDING_REVIEW = "pending_review"

VERIFICATION_STATUS_PENDING = "pending"
VERIFICATION_STATUS_APPROVED = "approved"
VERIFICATION_STATUS_REJECTED = "rejected"


def get_db(db_path: Optional[str] = None):
    path = db_path or DB_PATH
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db(db_path: Optional[str] = None):
    conn = get_db(db_path)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS counter_transactions (
            id TEXT PRIMARY KEY,
            tail_number TEXT NOT NULL,
            amount REAL NOT NULL,
            approver TEXT NOT NULL,
            approver_status TEXT NOT NULL DEFAULT 'normal',
            remark TEXT DEFAULT '',
            batch_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS transaction_history (
            id TEXT PRIMARY KEY,
            transaction_id TEXT NOT NULL,
            field_name TEXT NOT NULL,
            old_value TEXT DEFAULT '',
            new_value TEXT DEFAULT '',
            changed_by TEXT DEFAULT '',
            changed_at TEXT NOT NULL,
            FOREIGN KEY (transaction_id) REFERENCES counter_transactions(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS green_bond_verifications (
            id TEXT PRIMARY KEY,
            transaction_id TEXT NOT NULL,
            green_ratio REAL NOT NULL,
            verification_step TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            reviewer TEXT DEFAULT '',
            supplementary_email_id TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (transaction_id) REFERENCES counter_transactions(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS import_batches (
            batch_id TEXT PRIMARY KEY,
            tail_numbers TEXT NOT NULL,
            imported_at TEXT NOT NULL,
            transaction_count INTEGER NOT NULL DEFAULT 0
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS supplementary_emails (
            id TEXT PRIMARY KEY,
            transaction_id TEXT NOT NULL,
            sender TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (transaction_id) REFERENCES counter_transactions(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS balance_changes (
            id TEXT PRIMARY KEY,
            transaction_id TEXT NOT NULL,
            old_balance REAL DEFAULT 0,
            new_balance REAL NOT NULL,
            changed_at TEXT NOT NULL,
            FOREIGN KEY (transaction_id) REFERENCES counter_transactions(id)
        )
    """)

    c.execute("CREATE INDEX IF NOT EXISTS idx_txn_tail ON counter_transactions(tail_number)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_txn_batch ON counter_transactions(batch_id)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_hist_txn ON transaction_history(transaction_id)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_verif_txn ON green_bond_verifications(transaction_id)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_verif_step ON green_bond_verifications(verification_step)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_email_txn ON supplementary_emails(transaction_id)")
    c.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_tail_approver ON counter_transactions(tail_number, approver, batch_id)")

    conn.commit()
    conn.close()


def _now():
    return datetime.now().isoformat()


def _uuid():
    return str(uuid.uuid4())
