import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

DB_PATH = Path(__file__).parent.parent / "etf_review.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_conn()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS clearing_batch (
        batch_id TEXT PRIMARY KEY,
        batch_date TEXT NOT NULL,
        etf_code TEXT NOT NULL,
        etf_name TEXT,
        status TEXT NOT NULL DEFAULT 'imported',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS basket_component (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT NOT NULL,
        component_code TEXT NOT NULL,
        component_name TEXT NOT NULL,
        expected_weight REAL,
        actual_weight REAL,
        deviation REAL,
        approver_name TEXT,
        approver_is_pinyin INTEGER NOT NULL DEFAULT 0,
        holiday_extension_note TEXT,
        status TEXT NOT NULL DEFAULT 'flagged',
        flag_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (batch_id) REFERENCES clearing_batch(batch_id)
    );

    CREATE TABLE IF NOT EXISTS balance_change (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        component_id INTEGER NOT NULL,
        before_balance REAL,
        after_balance REAL,
        change_amount REAL,
        reason_kept TEXT,
        missing_materials TEXT,
        next_action TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (component_id) REFERENCES basket_component(id)
    );

    CREATE INDEX IF NOT EXISTS idx_component_batch ON basket_component(batch_id);
    CREATE INDEX IF NOT EXISTS idx_component_status ON basket_component(status);
    CREATE INDEX IF NOT EXISTS idx_balance_component ON balance_change(component_id);
    """)
    conn.commit()
    conn.close()


def insert_batch(batch_id: str, batch_date: str, etf_code: str, etf_name: str = "") -> dict:
    conn = get_conn()
    now = datetime.now().isoformat()
    try:
        conn.execute(
            "INSERT INTO clearing_batch (batch_id, batch_date, etf_code, etf_name, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
            (batch_id, batch_date, etf_code, etf_name, "imported", now, now),
        )
        conn.commit()
        return {"batch_id": batch_id, "status": "imported"}
    except sqlite3.IntegrityError:
        return {"batch_id": batch_id, "error": "批次号已存在"}
    finally:
        conn.close()


def insert_component(
    batch_id: str,
    component_code: str,
    component_name: str,
    expected_weight: float,
    actual_weight: float,
    approver_name: str,
    approver_is_pinyin: bool,
    holiday_extension_note: str = "",
    flag_reason: str = "",
) -> int:
    conn = get_conn()
    now = datetime.now().isoformat()
    deviation = round(actual_weight - expected_weight, 6)
    if approver_is_pinyin:
        status = "pending_review"
    elif deviation != 0 and not holiday_extension_note:
        status = "missing_note"
    else:
        status = "normal"

    cur = conn.execute(
        """INSERT INTO basket_component
        (batch_id, component_code, component_name, expected_weight, actual_weight,
         deviation, approver_name, approver_is_pinyin, holiday_extension_note,
         status, flag_reason, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (batch_id, component_code, component_name, expected_weight, actual_weight,
         deviation, approver_name, int(approver_is_pinyin), holiday_extension_note,
         status, flag_reason, now, now),
    )
    component_id = cur.lastrowid

    conn.execute(
        """INSERT INTO balance_change
        (component_id, before_balance, after_balance, change_amount,
         reason_kept, missing_materials, next_action, updated_at)
        VALUES (?,?,?,?,?,?,?,?)""",
        (component_id, expected_weight, actual_weight, deviation,
         _build_reason_kept(approver_is_pinyin, holiday_extension_note, deviation),
         _build_missing_materials(approver_is_pinyin, holiday_extension_note),
         _build_next_action(approver_is_pinyin),
         now),
    )
    conn.commit()
    conn.close()
    return component_id


def _build_reason_kept(is_pinyin: bool, note: str, deviation: float) -> str:
    parts = []
    if is_pinyin:
        parts.append("审批人仅留拼音，身份未确认，暂留待客户经理复核")
    if deviation != 0 and not note:
        parts.append("权重偏差且缺少节假日顺延说明")
    if deviation != 0 and note:
        parts.append(f"权重偏差已有顺延说明：{note}")
    if deviation == 0:
        parts.append("权重无偏差")
    return "；".join(parts) if parts else "待复核"


def _build_missing_materials(is_pinyin: bool, note: str) -> str:
    parts = []
    if is_pinyin:
        parts.append("审批人中文全名")
    if not note:
        parts.append("节假日顺延说明")
    return "；".join(parts) if parts else "无"


def _build_next_action(is_pinyin: bool) -> str:
    if is_pinyin:
        return "找客户经理确认审批人身份"
    return "找投研助理小周补充材料"


def update_holiday_note(component_id: int, note: str) -> dict:
    conn = get_conn()
    now = datetime.now().isoformat()
    comp = conn.execute("SELECT * FROM basket_component WHERE id=?", (component_id,)).fetchone()
    if not comp:
        conn.close()
        return {"error": "成分记录不存在"}

    new_status = "normal" if not comp["approver_is_pinyin"] and note else comp["status"]
    conn.execute(
        "UPDATE basket_component SET holiday_extension_note=?, status=?, updated_at=? WHERE id=?",
        (note, new_status, now, component_id),
    )

    deviation = comp["deviation"]
    bc = conn.execute("SELECT * FROM balance_change WHERE component_id=?", (component_id,)).fetchone()
    if bc:
        conn.execute(
            """UPDATE balance_change SET
            reason_kept=?, missing_materials=?, next_action=?, updated_at=?
            WHERE component_id=?""",
            (
                _build_reason_kept(bool(comp["approver_is_pinyin"]), note, deviation),
                _build_missing_materials(bool(comp["approver_is_pinyin"]), note),
                _build_next_action(bool(comp["approver_is_pinyin"])),
                now,
                component_id,
            ),
        )
    else:
        conn.execute(
            """INSERT INTO balance_change
            (component_id, before_balance, after_balance, change_amount,
             reason_kept, missing_materials, next_action, updated_at)
            VALUES (?,?,?,?,?,?,?,?)""",
            (component_id, comp["expected_weight"], comp["actual_weight"], deviation,
             _build_reason_kept(bool(comp["approver_is_pinyin"]), note, deviation),
             _build_missing_materials(bool(comp["approver_is_pinyin"]), note),
             _build_next_action(bool(comp["approver_is_pinyin"])),
             now),
        )
    conn.commit()
    conn.close()
    return {"component_id": component_id, "status": new_status, "note_updated": True}


def confirm_approver(component_id: int, real_name: str) -> dict:
    conn = get_conn()
    now = datetime.now().isoformat()
    comp = conn.execute("SELECT * FROM basket_component WHERE id=?", (component_id,)).fetchone()
    if not comp:
        conn.close()
        return {"error": "成分记录不存在"}

    new_status = "normal" if comp["holiday_extension_note"] else "missing_note"
    conn.execute(
        "UPDATE basket_component SET approver_name=?, approver_is_pinyin=0, status=?, flag_reason='', updated_at=? WHERE id=?",
        (real_name, new_status, now, component_id),
    )

    deviation = comp["deviation"]
    has_note = bool(comp["holiday_extension_note"])
    bc = conn.execute("SELECT * FROM balance_change WHERE component_id=?", (component_id,)).fetchone()
    if bc:
        conn.execute(
            """UPDATE balance_change SET
            reason_kept=?, missing_materials=?, next_action=?, updated_at=?
            WHERE component_id=?""",
            (
                _build_reason_kept(False, comp["holiday_extension_note"] or "", deviation),
                _build_missing_materials(False, comp["holiday_extension_note"] or ""),
                _build_next_action(False),
                now,
                component_id,
            ),
        )
    conn.commit()
    conn.close()
    return {"component_id": component_id, "status": new_status, "approver_confirmed": True}


def get_batch(batch_id: str) -> Optional[dict]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM clearing_batch WHERE batch_id=?", (batch_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def list_batches() -> List[dict]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM clearing_batch ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_components(batch_id: str) -> list[dict]:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM basket_component WHERE batch_id=?", (batch_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_component(component_id: int) -> Optional[dict]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM basket_component WHERE id=?", (component_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_balance_changes(batch_id: str) -> List[dict]:
    conn = get_conn()
    rows = conn.execute("""
        SELECT bc.*, comp.component_code, comp.component_name, comp.approver_name,
               comp.approver_is_pinyin, comp.holiday_extension_note, comp.status as comp_status,
               comp.batch_id
        FROM balance_change bc
        JOIN basket_component comp ON bc.component_id = comp.id
        WHERE comp.batch_id=?
        ORDER BY comp.component_code
    """, (batch_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_stats() -> dict:
    conn = get_conn()
    total_batches = conn.execute("SELECT COUNT(*) FROM clearing_batch").fetchone()[0]
    total_components = conn.execute("SELECT COUNT(*) FROM basket_component").fetchone()[0]
    pinyin_count = conn.execute("SELECT COUNT(*) FROM basket_component WHERE approver_is_pinyin=1").fetchone()[0]
    missing_note = conn.execute("SELECT COUNT(*) FROM basket_component WHERE (holiday_extension_note IS NULL OR holiday_extension_note='') AND deviation!=0").fetchone()[0]
    normal_count = conn.execute("SELECT COUNT(*) FROM basket_component WHERE status='normal'").fetchone()[0]
    pending_count = conn.execute("SELECT COUNT(*) FROM basket_component WHERE status='pending_review'").fetchone()[0]
    conn.close()
    return {
        "total_batches": total_batches,
        "total_components": total_components,
        "pinyin_approvers": pinyin_count,
        "missing_notes": missing_note,
        "normal": normal_count,
        "pending_review": pending_count,
    }
