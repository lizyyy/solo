from __future__ import annotations

import re
from datetime import datetime
from app.database import get_connection


def create_exception(data: dict) -> dict:
    conn = get_connection()
    try:
        now = datetime.utcnow().isoformat()
        conn.execute(
            """INSERT INTO exceptions
               (phone_pattern, reason, source, field_path, expires_at,
                status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 'active', ?, ?)""",
            (data["phone_pattern"], data.get("reason", ""), data.get("source", "all"),
             data.get("field_path"), data.get("expires_at"), now, now),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM exceptions ORDER BY id DESC LIMIT 1").fetchone()
        return _row_to_dict(row)
    finally:
        conn.close()


def list_exceptions(status_filter: str | None = None) -> list[dict]:
    refresh_expired()
    conn = get_connection()
    try:
        if status_filter:
            rows = conn.execute(
                "SELECT * FROM exceptions WHERE status = ? ORDER BY created_at DESC",
                (status_filter,),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM exceptions ORDER BY created_at DESC").fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def list_active_exceptions() -> list[dict]:
    refresh_expired()
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM exceptions WHERE status = 'active' ORDER BY created_at DESC"
        ).fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def get_exception(exc_id: int) -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM exceptions WHERE id = ?", (exc_id,)).fetchone()
        if not row:
            return None
        return _row_to_dict(row)
    finally:
        conn.close()


def update_exception(exc_id: int, data: dict) -> dict | None:
    conn = get_connection()
    try:
        existing = conn.execute("SELECT * FROM exceptions WHERE id = ?", (exc_id,)).fetchone()
        if not existing:
            return None
        now = datetime.utcnow().isoformat()
        updates = []
        params = []
        for field in ("reason", "expires_at", "status"):
            if field in data and data[field] is not None:
                updates.append(f"{field} = ?")
                params.append(data[field])
        if updates:
            updates.append("updated_at = ?")
            params.append(now)
            params.append(exc_id)
            conn.execute(f"UPDATE exceptions SET {', '.join(updates)} WHERE id = ?", params)
            conn.commit()
        return get_exception(exc_id)
    finally:
        conn.close()


def refresh_expired() -> int:
    conn = get_connection()
    try:
        now = datetime.utcnow().isoformat()
        cursor = conn.execute(
            """UPDATE exceptions
               SET status = 'expired', updated_at = ?
               WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < ?""",
            (now, now),
        )
        conn.commit()
        return cursor.rowcount
    finally:
        conn.close()


def check_exception_status(exc_id: int) -> dict | None:
    exc = get_exception(exc_id)
    if not exc:
        return None
    if exc["expires_at"] and exc["status"] == "active":
        now = datetime.utcnow().isoformat()
        if exc["expires_at"] < now:
            updated = update_exception(exc_id, {"status": "expired"})
            if updated:
                updated["is_expired"] = True
                return updated
    return exc


def _row_to_dict(row) -> dict:
    now = datetime.utcnow().isoformat()
    expires_at = row["expires_at"]
    is_expired = False
    if expires_at and row["status"] == "active" and expires_at < now:
        is_expired = True
    elif row["status"] in ("expired", "revoked"):
        is_expired = True
    return {
        "id": row["id"],
        "phone_pattern": row["phone_pattern"],
        "reason": row["reason"],
        "source": row["source"],
        "field_path": row["field_path"],
        "expires_at": row["expires_at"],
        "status": row["status"],
        "is_expired": is_expired,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
