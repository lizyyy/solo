import csv
import io
import os
from datetime import datetime
from models import get_db


def export_batch_report(batch_id, format="csv"):
    conn = get_db()
    batch = conn.execute("SELECT * FROM batch WHERE id=?", (batch_id,)).fetchone()
    records = conn.execute("SELECT * FROM record WHERE batch_id=? ORDER BY transfer_date, from_branch", (batch_id,)).fetchall()
    conn.close()

    if not batch:
        return None

    report = {
        "batch": dict(batch),
        "records": [dict(r) for r in records],
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    return report


def export_conflict_report(format="csv"):
    conn = get_db()
    conflicts = conn.execute(
        "SELECT c.*, r.transfer_date, r.from_branch, r.to_branch, r.amount as record_amount, r.voucher_no, r.operator as record_operator, r.status as record_status FROM conflict c JOIN record r ON c.record_id=r.id ORDER BY c.created_at DESC"
    ).fetchall()
    conn.close()

    report_rows = []
    for c in conflicts:
        report_rows.append(
            {
                "conflict_id": c["id"],
                "record_id": c["record_id"],
                "transfer_date": c["transfer_date"],
                "from_branch": c["from_branch"],
                "to_branch": c["to_branch"],
                "record_amount": c["record_amount"],
                "voucher_no": c["voucher_no"],
                "conflict_field": c["field_name"],
                "email_value": c["email_value"],
                "import_value": c["import_value"],
                "email_source": c["email_source"],
                "import_source": c["import_source"],
                "suggested_action": c["suggested_action"],
                "resolution": c["resolution"] or "",
                "resolved_by": c["resolved_by"] or "",
                "resolved_at": c["resolved_at"] or "",
                "record_status": c["record_status"],
                "created_at": c["created_at"],
            }
        )
    return report_rows


def export_full_report(format="csv"):
    conn = get_db()
    records = conn.execute(
        "SELECT r.*, b.name as batch_name, b.source_type as batch_source_type FROM record r JOIN batch b ON r.batch_id=b.id ORDER BY r.transfer_date, r.from_branch"
    ).fetchall()
    conn.close()

    report_rows = []
    for r in records:
        report_rows.append(
            {
                "record_id": r["id"],
                "batch_name": r["batch_name"],
                "batch_source_type": r["batch_source_type"],
                "transfer_date": r["transfer_date"],
                "from_branch": r["from_branch"],
                "to_branch": r["to_branch"],
                "amount": r["amount"],
                "currency": r["currency"],
                "operator": r["operator"],
                "transfer_type": r["transfer_type"],
                "voucher_no": r["voucher_no"],
                "approval_email_ref": r["approval_email_ref"],
                "status": r["status"],
                "original_source": r["original_source"],
                "is_supplement": "是" if r["is_supplement"] else "否",
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            }
        )
    return report_rows


def to_csv(rows, fields):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def export_diff_report(batch_id_1, batch_id_2):
    conn = get_db()
    b1 = conn.execute("SELECT * FROM batch WHERE id=?", (batch_id_1,)).fetchone()
    b2 = conn.execute("SELECT * FROM batch WHERE id=?", (batch_id_2,)).fetchone()
    if not b1 or not b2:
        conn.close()
        return None

    r1 = conn.execute("SELECT * FROM record WHERE batch_id=?", (batch_id_1,)).fetchall()
    r2 = conn.execute("SELECT * FROM record WHERE batch_id=?", (batch_id_2,)).fetchall()
    conn.close()

    key_fields = ["transfer_date", "from_branch", "to_branch", "amount"]
    map1 = {}
    for r in r1:
        key = "|".join(str(r[f]) for f in key_fields)
        map1[key] = dict(r)
    map2 = {}
    for r in r2:
        key = "|".join(str(r[f]) for f in key_fields)
        map2[key] = dict(r)

    diffs = []
    all_keys = set(map1.keys()) | set(map2.keys())
    compare_fields = ["amount", "currency", "operator", "transfer_type", "voucher_no", "approval_email_ref"]

    for key in sorted(all_keys):
        in_1 = key in map1
        in_2 = key in map2
        if in_1 and not in_2:
            diffs.append({"key": key, "type": "only_in_batch_1", "batch_1": map1[key], "batch_2": None})
        elif not in_1 and in_2:
            diffs.append({"key": key, "type": "only_in_batch_2", "batch_1": None, "batch_2": map2[key]})
        else:
            field_diffs = {}
            for f in compare_fields:
                v1 = str(map1[key].get(f, "")) if map1[key].get(f) is not None else ""
                v2 = str(map2[key].get(f, "")) if map2[key].get(f) is not None else ""
                if v1 != v2:
                    field_diffs[f] = {"batch_1": v1, "batch_2": v2}
            if field_diffs:
                diffs.append({"key": key, "type": "field_diff", "field_diffs": field_diffs, "batch_1": map1[key], "batch_2": map2[key]})

    return {"batch_1": dict(b1), "batch_2": dict(b2), "diffs": diffs}
