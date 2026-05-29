from __future__ import annotations

import json
from datetime import datetime
from app.database import get_connection


def create_rule(data: dict) -> dict:
    conn = get_connection()
    try:
        now = datetime.utcnow().isoformat()
        field_paths_json = json.dumps(data["field_paths"], ensure_ascii=False)
        conn.execute(
            """INSERT INTO rules
               (version, name, description, pattern, replacement_template,
                field_paths, mask_start, mask_end, mask_char, is_active,
                parent_version, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)""",
            (data["version"], data["name"], data.get("description", ""),
             data["pattern"], data["replacement_template"],
             field_paths_json, data["mask_start"], data["mask_end"],
             data["mask_char"], data.get("parent_version"), now),
        )
        conn.commit()
        return get_rule_by_version(data["version"])
    finally:
        conn.close()


def get_rule_by_version(version: str) -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM rules WHERE version = ?", (version,)).fetchone()
        if not row:
            return None
        return _row_to_dict(row)
    finally:
        conn.close()


def list_rules() -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM rules ORDER BY created_at DESC").fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def activate_rule(version: str) -> dict | None:
    conn = get_connection()
    try:
        rule = conn.execute("SELECT * FROM rules WHERE version = ?", (version,)).fetchone()
        if not rule:
            return None
        conn.execute("UPDATE rules SET is_active = 0 WHERE is_active = 1")
        conn.execute("UPDATE rules SET is_active = 1 WHERE version = ?", (version,))
        conn.commit()
        return _row_to_dict(conn.execute("SELECT * FROM rules WHERE version = ?", (version,)).fetchone())
    finally:
        conn.close()


def rollback_rule(version: str) -> dict | None:
    return activate_rule(version)


def get_active_rule() -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM rules WHERE is_active = 1").fetchone()
        if not row:
            return None
        return _row_to_dict(row)
    finally:
        conn.close()


def get_version_chain(version: str) -> list[dict]:
    conn = get_connection()
    try:
        chain = []
        current = conn.execute("SELECT * FROM rules WHERE version = ?", (version,)).fetchone()
        while current:
            chain.append(_row_to_dict(current))
            pv = current["parent_version"]
            if not pv:
                break
            current = conn.execute("SELECT * FROM rules WHERE version = ?", (pv,)).fetchone()
        return chain
    finally:
        conn.close()


def _row_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "version": row["version"],
        "name": row["name"],
        "description": row["description"],
        "pattern": row["pattern"],
        "replacement_template": row["replacement_template"],
        "field_paths": json.loads(row["field_paths"]),
        "mask_start": row["mask_start"],
        "mask_end": row["mask_end"],
        "mask_char": row["mask_char"],
        "is_active": bool(row["is_active"]),
        "parent_version": row["parent_version"],
        "created_at": row["created_at"],
    }
