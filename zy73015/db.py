import sqlite3
import os
import hashlib
from datetime import datetime, timezone
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "litterbox.db")

MATERIAL_TYPES = {
    "NORMAL": "正常材料",
    "OLD_FOSTER_FORM": "寄养登记表旧版",
    "NAME_INCONSISTENT": "名称写法不一致",
    "ORAL_NOTE": "口头备注",
}

RECORD_STATUSES = {
    "PENDING": "待复核",
    "CONFIRMED_ABNORMAL": "已确认异常",
    "CONFIRMED_NORMAL": "已确认正常",
    "VACCINE_MISSING": "疫苗日期缺失",
    "REJECTED": "已驳回",
}

STATUS_SNAPSHOT_NOTES = {
    "PENDING": "材料已导入，等待兽医助理复核异常情况",
    "CONFIRMED_ABNORMAL": "复核确认存在猫砂盆使用异常，截图已留存",
    "CONFIRMED_NORMAL": "复核后排除异常，属正常记录",
    "VACCINE_MISSING": "寄养登记表中疫苗接种日期缺失，需补录后再复核",
    "REJECTED": "材料来源存疑，结论不采纳",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def compute_hash(*parts: str) -> str:
    h = hashlib.sha256()
    for p in parts:
        h.update(str(p).encode("utf-8"))
    return h.hexdigest()[:32]


def normalize_cat_name(raw: str) -> str:
    return raw.strip().replace(" ", "").replace("　", "").lower()


@contextmanager
def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        c = conn.cursor()
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS review_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_no TEXT UNIQUE NOT NULL,
                operator TEXT NOT NULL DEFAULT 'system',
                remark TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS review_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id INTEGER NOT NULL,
                record_key TEXT NOT NULL,
                cat_name TEXT NOT NULL,
                cat_name_normalized TEXT NOT NULL,
                foster_no TEXT,
                litter_box_issue TEXT NOT NULL,
                vaccine_date TEXT,
                is_vaccine_missing INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'PENDING',
                version INTEGER NOT NULL DEFAULT 1,
                conclusion TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(record_key),
                FOREIGN KEY (batch_id) REFERENCES review_batches(id)
            );

            CREATE TABLE IF NOT EXISTS materials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER NOT NULL,
                batch_id INTEGER NOT NULL,
                material_type TEXT NOT NULL DEFAULT 'NORMAL',
                source_name TEXT,
                raw_content TEXT,
                import_hash TEXT NOT NULL,
                affects_conclusion INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (record_id) REFERENCES review_records(id) ON DELETE CASCADE,
                FOREIGN KEY (batch_id) REFERENCES review_batches(id)
            );

            CREATE TABLE IF NOT EXISTS manual_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER NOT NULL,
                author TEXT NOT NULL,
                content TEXT NOT NULL,
                note_hash TEXT NOT NULL,
                protected INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                FOREIGN KEY (record_id) REFERENCES review_records(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS status_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER NOT NULL,
                batch_id INTEGER NOT NULL,
                record_version INTEGER NOT NULL,
                status TEXT NOT NULL,
                screenshot_note TEXT NOT NULL,
                affected_material_ids TEXT,
                linked_note_ids TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (record_id) REFERENCES review_records(id) ON DELETE CASCADE,
                FOREIGN KEY (batch_id) REFERENCES review_batches(id)
            );

            CREATE INDEX IF NOT EXISTS idx_records_status ON review_records(status);
            CREATE INDEX IF NOT EXISTS idx_records_vaccine ON review_records(is_vaccine_missing);
            CREATE INDEX IF NOT EXISTS idx_materials_hash ON materials(import_hash);
            CREATE INDEX IF NOT EXISTS idx_snapshots_record ON status_snapshots(record_id);
            """
        )


def row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()} if row else None
