from models import get_db
from datetime import datetime


def get_conflicts_for_record(record_id):
    conn = get_db()
    conflicts = conn.execute("SELECT * FROM conflict WHERE record_id=? ORDER BY created_at", (record_id,)).fetchall()
    conn.close()
    return conflicts


def get_all_conflicts(status=None):
    conn = get_db()
    if status == "unresolved":
        conflicts = conn.execute(
            "SELECT c.*, r.transfer_date, r.from_branch, r.to_branch, r.amount FROM conflict c JOIN record r ON c.record_id=r.id WHERE c.resolution IS NULL ORDER BY c.created_at DESC"
        ).fetchall()
    elif status == "resolved":
        conflicts = conn.execute(
            "SELECT c.*, r.transfer_date, r.from_branch, r.to_branch, r.amount FROM conflict c JOIN record r ON c.record_id=r.id WHERE c.resolution IS NOT NULL ORDER BY c.resolved_at DESC"
        ).fetchall()
    else:
        conflicts = conn.execute(
            "SELECT c.*, r.transfer_date, r.from_branch, r.to_branch, r.amount FROM conflict c JOIN record r ON c.record_id=r.id ORDER BY c.created_at DESC"
        ).fetchall()
    conn.close()
    return conflicts


def resolve_conflict(conflict_id, resolution, resolved_by):
    conn = get_db()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conflict = conn.execute("SELECT * FROM conflict WHERE id=?", (conflict_id,)).fetchone()
    if not conflict:
        conn.close()
        return None

    conn.execute(
        "UPDATE conflict SET resolution=?, resolved_by=?, resolved_at=? WHERE id=?",
        (resolution, resolved_by, now, conflict_id),
    )

    if resolution in ("use_import", "use_email"):
        record = conn.execute("SELECT * FROM record WHERE id=?", (conflict["record_id"],)).fetchone()
        if record:
            field = conflict["field_name"]
            value = conflict["import_value"] if resolution == "use_import" else conflict["email_value"]
            try:
                if field == "amount":
                    value = float(value)
            except (ValueError, TypeError):
                pass
            conn.execute(f"UPDATE record SET {field}=?, updated_at=? WHERE id=?", (value, now, conflict["record_id"]))

            unresolved = conn.execute("SELECT COUNT(*) as cnt FROM conflict WHERE record_id=? AND resolution IS NULL", (conflict["record_id"],)).fetchone()
            if unresolved["cnt"] == 0:
                conn.execute("UPDATE record SET status='confirmed', updated_at=? WHERE id=?", (now, conflict["record_id"]))

    conn.execute(
        "INSERT INTO audit_log (record_id, action, old_value, new_value, operator, source, created_at) VALUES (?, 'conflict_resolved', ?, ?, ?, 'manual', ?)",
        (conflict["record_id"], conflict["email_value"], conflict["import_value"], resolution, now),
    )

    conn.commit()
    conn.close()
    return {"conflict_id": conflict_id, "resolution": resolution, "resolved_at": now}


def build_conflict_evidence(record_id):
    conn = get_db()
    record = conn.execute("SELECT * FROM record WHERE id=?", (record_id,)).fetchone()
    conflicts = conn.execute("SELECT * FROM conflict WHERE record_id=? AND resolution IS NULL ORDER BY created_at", (record_id,)).fetchall()
    audit_trail = conn.execute("SELECT * FROM audit_log WHERE record_id=? ORDER BY created_at", (record_id,)).fetchall()
    conn.close()

    if not record or not conflicts:
        return None

    evidence = {
        "record": dict(record),
        "conflicts": [],
        "audit_trail": [dict(a) for a in audit_trail],
    }

    for c in conflicts:
        evidence["conflicts"].append(
            {
                "conflict_id": c["id"],
                "field": c["field_name"],
                "email_side": {"value": c["email_value"], "source": c["email_source"]},
                "import_side": {"value": c["import_value"], "source": c["import_source"]},
                "suggested_action": c["suggested_action"],
            }
        )

    return evidence
