"""
SQLite 持久化层
表结构映射 cabinet_warning_system.py 的 dataclass
对外暴露的 SqliteWarningRepository 与原 WarningRepository 方法签名完全一致
"""
import sqlite3
import json
import os
import threading
from typing import Optional, List, Dict, Any

from cabinet_warning_system import (
    WarningRecord, Material, HistoryEntry,
    canonical_name,
)


DB_PATH = os.environ.get(
    "CABINET_WARNING_DB",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "cabinet_warning.db"),
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS warning_records (
    record_id           TEXT PRIMARY KEY,
    canonical_object    TEXT NOT NULL,
    display_name        TEXT NOT NULL,
    conclusion          TEXT NOT NULL,
    block_reason        TEXT DEFAULT '',
    block_level         TEXT DEFAULT '',
    hold_results_json   TEXT DEFAULT '[]',
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    is_supplemented     INTEGER DEFAULT 0,
    is_judgment_changed INTEGER DEFAULT 0,
    version             INTEGER DEFAULT 1,
    dedup_key           TEXT UNIQUE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_warning_dedup ON warning_records(dedup_key);

CREATE TABLE IF NOT EXISTS materials (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id        TEXT NOT NULL REFERENCES warning_records(record_id) ON DELETE CASCADE,
    material_id      TEXT NOT NULL,
    material_type    TEXT NOT NULL,
    title            TEXT NOT NULL,
    detail           TEXT NOT NULL,
    mismatch_flag    INTEGER DEFAULT 0,
    mismatch_detail  TEXT DEFAULT '',
    uploaded_at      TEXT NOT NULL,
    operator         TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_materials_record ON materials(record_id);

CREATE TABLE IF NOT EXISTS history_entries (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id         TEXT NOT NULL REFERENCES warning_records(record_id) ON DELETE CASCADE,
    version           INTEGER NOT NULL,
    timestamp         TEXT NOT NULL,
    event             TEXT NOT NULL,
    conclusion_before TEXT,
    conclusion_after  TEXT,
    materials_before_json  TEXT DEFAULT '[]',
    materials_after_json   TEXT DEFAULT '[]',
    remark            TEXT DEFAULT '',
    operator          TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_history_record ON history_entries(record_id);
"""


_lock = threading.RLock()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with _lock, _connect() as conn:
        conn.executescript(_SCHEMA)


def reset_db() -> None:
    """仅测试用：清空并重建"""
    with _lock:
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
    init_db()


# ============================================================
# 序列化 / 反序列化
# ============================================================

def _row_to_material(row: sqlite3.Row) -> Material:
    return Material(
        material_id=row["material_id"],
        material_type=row["material_type"],
        title=row["title"],
        detail=row["detail"],
        mismatch_flag=bool(row["mismatch_flag"]),
        mismatch_detail=row["mismatch_detail"] or "",
        uploaded_at=row["uploaded_at"],
        operator=row["operator"] or "",
    )


def _row_to_history(row: sqlite3.Row) -> HistoryEntry:
    return HistoryEntry(
        version=row["version"],
        timestamp=row["timestamp"],
        event=row["event"],
        conclusion_before=row["conclusion_before"],
        conclusion_after=row["conclusion_after"],
        materials_before=json.loads(row["materials_before_json"] or "[]"),
        materials_after=json.loads(row["materials_after_json"] or "[]"),
        remark=row["remark"] or "",
        operator=row["operator"] or "",
    )


def _hydrate(record_row: sqlite3.Row, conn: sqlite3.Connection) -> WarningRecord:
    mat_rows = conn.execute(
        "SELECT * FROM materials WHERE record_id = ? ORDER BY id",
        (record_row["record_id"],),
    ).fetchall()
    hist_rows = conn.execute(
        "SELECT * FROM history_entries WHERE record_id = ? ORDER BY id",
        (record_row["record_id"],),
    ).fetchall()

    return WarningRecord(
        record_id=record_row["record_id"],
        canonical_object=record_row["canonical_object"],
        display_name=record_row["display_name"],
        conclusion=record_row["conclusion"],
        block_reason=record_row["block_reason"] or "",
        block_level=record_row["block_level"] or "",
        hold_results=json.loads(record_row["hold_results_json"] or "[]"),
        materials=[_row_to_material(r) for r in mat_rows],
        history=[_row_to_history(r) for r in hist_rows],
        created_at=record_row["created_at"],
        updated_at=record_row["updated_at"],
        is_supplemented=bool(record_row["is_supplemented"]),
        is_judgment_changed=bool(record_row["is_judgment_changed"]),
        version=record_row["version"],
        dedup_key=record_row["dedup_key"],
    )


# ============================================================
# Repository
# ============================================================

class SqliteWarningRepository:
    """SQLite 仓储实现，接口与 WarningRepository 完全一致"""

    def __init__(self):
        init_db()

    def _make_dedup_key(self, canonical: str, date_str: str) -> str:
        return f"{canonical}|{date_str}"

    # ---------- 查询 ----------
    def find_by_dedup(self, raw_name: str, date_str: str) -> Optional[WarningRecord]:
        canon = canonical_name(raw_name)
        key = self._make_dedup_key(canon, date_str)
        with _lock, _connect() as conn:
            row = conn.execute(
                "SELECT * FROM warning_records WHERE dedup_key = ? LIMIT 1",
                (key,),
            ).fetchone()
            if not row:
                return None
            return _hydrate(row, conn)

    def get(self, record_id: str) -> Optional[WarningRecord]:
        with _lock, _connect() as conn:
            row = conn.execute(
                "SELECT * FROM warning_records WHERE record_id = ? LIMIT 1",
                (record_id,),
            ).fetchone()
            if not row:
                return None
            return _hydrate(row, conn)

    def all(self) -> List[WarningRecord]:
        with _lock, _connect() as conn:
            rows = conn.execute(
                "SELECT * FROM warning_records ORDER BY created_at DESC"
            ).fetchall()
            return [_hydrate(r, conn) for r in rows]

    # ---------- 写入（先整体删再重插，简化实现） ----------
    def save(self, record: WarningRecord) -> None:
        with _lock, _connect() as conn:
            # 主记录
            conn.execute(
                """
                INSERT INTO warning_records (
                    record_id, canonical_object, display_name, conclusion,
                    block_reason, block_level, hold_results_json,
                    created_at, updated_at,
                    is_supplemented, is_judgment_changed, version, dedup_key
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(record_id) DO UPDATE SET
                    canonical_object=excluded.canonical_object,
                    display_name=excluded.display_name,
                    conclusion=excluded.conclusion,
                    block_reason=excluded.block_reason,
                    block_level=excluded.block_level,
                    hold_results_json=excluded.hold_results_json,
                    updated_at=excluded.updated_at,
                    is_supplemented=excluded.is_supplemented,
                    is_judgment_changed=excluded.is_judgment_changed,
                    version=excluded.version,
                    dedup_key=excluded.dedup_key
                """,
                (
                    record.record_id,
                    record.canonical_object,
                    record.display_name,
                    record.conclusion,
                    record.block_reason,
                    record.block_level,
                    json.dumps(record.hold_results, ensure_ascii=False),
                    record.created_at,
                    record.updated_at,
                    int(record.is_supplemented),
                    int(record.is_judgment_changed),
                    record.version,
                    record.dedup_key,
                ),
            )
            # 材料：先删后插
            conn.execute("DELETE FROM materials WHERE record_id = ?", (record.record_id,))
            for m in record.materials:
                conn.execute(
                    """
                    INSERT INTO materials (
                        record_id, material_id, material_type, title, detail,
                        mismatch_flag, mismatch_detail, uploaded_at, operator
                    ) VALUES (?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        record.record_id,
                        m.material_id,
                        m.material_type,
                        m.title,
                        m.detail,
                        int(m.mismatch_flag),
                        m.mismatch_detail,
                        m.uploaded_at,
                        m.operator,
                    ),
                )
            # 历史：先删后插
            conn.execute(
                "DELETE FROM history_entries WHERE record_id = ?",
                (record.record_id,),
            )
            for h in record.history:
                conn.execute(
                    """
                    INSERT INTO history_entries (
                        record_id, version, timestamp, event,
                        conclusion_before, conclusion_after,
                        materials_before_json, materials_after_json,
                        remark, operator
                    ) VALUES (?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        record.record_id,
                        h.version,
                        h.timestamp,
                        h.event,
                        h.conclusion_before,
                        h.conclusion_after,
                        json.dumps(h.materials_before, ensure_ascii=False),
                        json.dumps(h.materials_after, ensure_ascii=False),
                        h.remark,
                        h.operator,
                    ),
                )
            conn.commit()
