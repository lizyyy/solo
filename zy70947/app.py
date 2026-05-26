import os
import json
import sqlite3
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, g

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "deposit_refund.db")

REQUIRED_FIELDS = [
    "deposit_no", "owner_name", "owner_phone", "property_address",
    "deposit_amount", "renovation_no", "acceptor", "acceptance_date",
    "renovation_start_date", "renovation_end_date", "submit_date",
    "approval_chain", "final_handler",
]

APPROVAL_ROLES = ["物业管家", "工程主管", "客服主管", "项目经理", "财务", "项目经理"]

CATEGORY_NORMAL = "normal"
CATEGORY_PENDING = "pending"
CATEGORY_BLOCKED = "blocked"

STATUS_RECEIVED = "received"
STATUS_PROCESSING = "processing"
STATUS_FAILED = "failed"
STATUS_MANUAL = "manual_confirmation"
STATUS_EXPORTED = "exported"


app = Flask(__name__)


# ---------- DB helpers ----------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON;")
    return g.db


@app.teardown_appcontext
def close_db(_e):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_uuid TEXT UNIQUE NOT NULL,
        raw_json TEXT NOT NULL,
        source_file TEXT,
        source_row INTEGER,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        error_summary TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_uuid TEXT NOT NULL,
        field TEXT,
        error_type TEXT NOT NULL,
        message TEXT NOT NULL,
        source_location TEXT,
        FOREIGN KEY (submission_uuid) REFERENCES submissions(submission_uuid)
    );
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_uuid TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        reason TEXT NOT NULL,
        follow_up_action TEXT NOT NULL,
        FOREIGN KEY (submission_uuid) REFERENCES submissions(submission_uuid)
    );
    CREATE INDEX IF NOT EXISTS idx_subs_status ON submissions(status);
    CREATE INDEX IF NOT EXISTS idx_subs_cat ON submissions(category);
    """)
    conn.commit()
    conn.close()


# ---------- Validation / classification ----------
def _add_error(errors, submission_uuid, field, error_type, message, source_location):
    errors.append({
        "submission_uuid": submission_uuid,
        "field": field,
        "error_type": error_type,
        "message": message,
        "source_location": source_location,
    })


def _source_loc(source_file, source_row, field=None):
    loc = []
    if source_file:
        loc.append(f"file:{source_file}")
    if source_row is not None:
        loc.append(f"row:{source_row}")
    if field:
        loc.append(f"field:{field}")
    return " > ".join(loc) if loc else "unknown"


def _is_missing(value):
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    return False


def validate_and_classify(data, source_file, source_row):
    """
    Returns dict: {category, reason, follow_up_action, errors: [...]}
    """
    suuid = data.get("_uuid")
    errors = []
    missing = [f for f in REQUIRED_FIELDS if _is_missing(data.get(f))]
    for f in missing:
        _add_error(errors, suuid, f, "missing_field",
                    f"缺少必填字段: {f}",
                    _source_loc(source_file, source_row, f))

    time_conflicts = []
    try:
        start = data.get("renovation_start_date")
        end = data.get("renovation_end_date")
        acc = data.get("acceptance_date")
        submit = data.get("submit_date")
        if start and end and start > end:
            time_conflicts.append("装修开始日期晚于结束日期")
            _add_error(errors, suuid, "renovation_start_date", "time_conflict",
                       "装修开始日期晚于结束日期",
                       _source_loc(source_file, source_row, "renovation_start_date"))
        if acc and start and acc < start:
            time_conflicts.append("装修验收日期早于装修开始日期")
            _add_error(errors, suuid, "acceptance_date", "time_conflict",
                       "装修验收日期早于装修开始日期",
                       _source_loc(source_file, source_row, "acceptance_date"))
        if submit and end and submit < end:
            time_conflicts.append("提交日期早于装修结束日期")
            _add_error(errors, suuid, "submit_date", "time_conflict",
                       "提交日期早于装修结束日期",
                       _source_loc(source_file, source_row, "submit_date"))
    except Exception as e:  # noqa
        _add_error(errors, suuid, None, "invalid_date", f"日期解析失败: {e}",
                   _source_loc(source_file, source_row))

    amount_conflicts = []
    try:
        amt = float(data.get("deposit_amount") or 0)
        deduct = float(data.get("violation_deduction") or 0)
        if deduct > amt:
            amount_conflicts.append("违规扣款金额超过押金本金")
            _add_error(errors, suuid, "violation_deduction", "amount_conflict",
                       "违规扣款金额超过押金本金",
                       _source_loc(source_file, source_row, "violation_deduction"))
    except Exception:
        pass

    # Blocked conditions
    blocked_reasons = []
    if time_conflicts:
        blocked_reasons.extend(time_conflicts)
    if amount_conflicts:
        blocked_reasons.extend(amount_conflicts)

    # Normal: no missing, no time_conflict, no duplicate (duplicate checked outside)
    if missing:
        category = CATEGORY_PENDING
        reason = "待补充：缺少 " + "、".join(missing)
        follow_up = "联系物业客服补齐缺失字段后重新提交"
    elif blocked_reasons:
        category = CATEGORY_BLOCKED
        reason = "已拦截：" + "；".join(blocked_reasons)
        follow_up = "退回原始材料，请修正时间矛盾或金额矛盾后重新发起"
    else:
        category = CATEGORY_NORMAL
        reason = "材料完整且校验通过"
        follow_up = "进入退还押金审批流程"

    return {
        "category": category,
        "reason": reason,
        "follow_up_action": follow_up,
        "errors": errors,
    }


def check_duplicate(conn, deposit_no, suuid):
    cur = conn.execute(
        "SELECT submission_uuid, raw_json FROM submissions WHERE json_extract(raw_json, '$.deposit_no') = ? AND submission_uuid <> ?",
        (deposit_no, suuid),
    )
    rows = cur.fetchall()
    return rows


# ---------- Core processing ----------
def process_submission(conn, data, source_file=None, source_row=None):
    suuid = data.get("_uuid") or str(uuid.uuid4())
    data["_uuid"] = suuid

    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO submissions (submission_uuid, raw_json, source_file, source_row, category, status, error_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (suuid, json.dumps(data, ensure_ascii=False), source_file, source_row,
         "received", STATUS_PROCESSING, None, now, now),
    )

    # Duplicate check
    deposit_no = data.get("deposit_no")
    dupes = []
    if deposit_no:
        dupes = check_duplicate(conn, deposit_no, suuid)
    if dupes:
        # Update this as blocked
        msg = f"已拦截：装修编号重复，与历史记录 {dupes[0]['submission_uuid']} 冲突"
        conn.execute(
            "UPDATE submissions SET category=?, status=?, error_summary=?, updated_at=? WHERE submission_uuid=?",
            (CATEGORY_BLOCKED, STATUS_MANUAL, msg, datetime.utcnow().isoformat(), suuid),
        )
        conn.execute(
            "INSERT INTO errors (submission_uuid, field, error_type, message, source_location) VALUES (?, ?, ?, ?, ?)",
            (suuid, "deposit_no", "duplicate_no", msg,
             _source_loc(source_file, source_row, "deposit_no")),
        )
        conn.execute(
            "INSERT INTO categories (submission_uuid, category, reason, follow_up_action) VALUES (?, ?, ?, ?)",
            (suuid, CATEGORY_BLOCKED, msg, "合并或修正重复编号后再发起退还"),
        )
        conn.commit()
        return suuid, CATEGORY_BLOCKED

    result = validate_and_classify(data, source_file, source_row)
    category = result["category"]
    status = STATUS_MANUAL if category != CATEGORY_NORMAL else STATUS_PROCESSING

    # Persist errors
    for e in result["errors"]:
        conn.execute(
            "INSERT INTO errors (submission_uuid, field, error_type, message, source_location) VALUES (?, ?, ?, ?, ?)",
            (e["submission_uuid"], e["field"], e["error_type"], e["message"], e["source_location"]),
        )

    err_summary = None
    if result["errors"]:
        err_summary = "; ".join({e["message"] for e in result["errors"]})[:500]

    conn.execute(
        "UPDATE submissions SET category=?, status=?, error_summary=?, updated_at=? WHERE submission_uuid=?",
        (category, status, err_summary, datetime.utcnow().isoformat(), suuid),
    )
    conn.execute(
        "INSERT INTO categories (submission_uuid, category, reason, follow_up_action) VALUES (?, ?, ?, ?)",
        (suuid, category, result["reason"], result["follow_up_action"]),
    )

    # For normal items, simulate approval completion -> move to ready-to-export
    if category == CATEGORY_NORMAL:
        try:
            finalize_normal_approval(conn, suuid, data)
            conn.execute(
                "UPDATE submissions SET status=?, updated_at=? WHERE submission_uuid=?",
                ("completed", datetime.utcnow().isoformat(), suuid),
            )
        except Exception as ex:
            conn.execute(
                "UPDATE submissions SET status=?, error_summary=?, updated_at=? WHERE submission_uuid=?",
                (STATUS_FAILED, f"处理失败: {ex}", datetime.utcnow().isoformat(), suuid),
            )

    conn.commit()
    return suuid, category


def finalize_normal_approval(conn, suuid, data):
    """Simulate the messy approval chain. Records each approver's decision."""
    chain = data.get("approval_chain") or []
    if isinstance(chain, str):
        try:
            chain = json.loads(chain)
        except Exception:
            chain = [{"role": r, "approved": True, "comment": ""} for r in APPROVAL_ROLES]
    if not chain:
        chain = [{"role": r, "approved": True, "comment": ""} for r in APPROVAL_ROLES]
    for idx, node in enumerate(chain):
        role = node.get("role") or APPROVAL_ROLES[idx % len(APPROVAL_ROLES)]
        approved = node.get("approved", True)
        comment = node.get("comment", "")
        conn.execute(
            "UPDATE submissions SET updated_at=? WHERE submission_uuid=?",
            (datetime.utcnow().isoformat(), suuid),
        )
        if not approved:
            raise RuntimeError(f"审批人 {role} 未通过：{comment}")


# ---------- Routes ----------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "db": DB_PATH})


@app.route("/api/submissions", methods=["POST"])
def submit_batch():
    payload = request.get_json(force=True, silent=True) or {}
    items = payload.get("items") or ([payload] if payload else [])
    source_file = payload.get("source_file")
    results = []
    conn = get_db()
    for idx, item in enumerate(items):
        suuid, cat = process_submission(
            conn, item, source_file=source_file, source_row=idx + 1
        )
        results.append({"submission_uuid": suuid, "category": cat})
    return jsonify({"count": len(results), "results": results})


@app.route("/api/submissions", methods=["GET"])
def list_submissions():
    status = request.args.get("status")
    category = request.args.get("category")
    conn = get_db()
    sql = "SELECT submission_uuid, category, status, error_summary, created_at, updated_at, raw_json FROM submissions WHERE 1=1"
    params = []
    if status:
        sql += " AND status = ?"
        params.append(status)
    if category:
        sql += " AND category = ?"
        params.append(category)
    sql += " ORDER BY id DESC LIMIT 500"
    rows = conn.execute(sql, params).fetchall()
    return jsonify([
        {
            "submission_uuid": r["submission_uuid"],
            "category": r["category"],
            "status": r["status"],
            "error_summary": r["error_summary"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "deposit_no": json.loads(r["raw_json"]).get("deposit_no"),
            "owner_name": json.loads(r["raw_json"]).get("owner_name"),
        }
        for r in rows
    ])


@app.route("/api/submissions/<suuid>", methods=["GET"])
def get_submission(suuid):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM submissions WHERE submission_uuid=?", (suuid,)
    ).fetchone()
    if not row:
        return jsonify({"error": "not_found"}), 404
    errs = conn.execute(
        "SELECT field, error_type, message, source_location FROM errors WHERE submission_uuid=?",
        (suuid,),
    ).fetchall()
    cat = conn.execute(
        "SELECT category, reason, follow_up_action FROM categories WHERE submission_uuid=?",
        (suuid,),
    ).fetchone()
    return jsonify({
        "submission_uuid": row["submission_uuid"],
        "category": row["category"],
        "status": row["status"],
        "error_summary": row["error_summary"],
        "source_file": row["source_file"],
        "source_row": row["source_row"],
        "raw": json.loads(row["raw_json"]),
        "classification": dict(cat) if cat else None,
        "errors": [dict(e) for e in errs],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    })


@app.route("/api/submissions/<suuid>/confirm", methods=["POST"])
def confirm_manual(suuid):
    payload = request.get_json(force=True, silent=True) or {}
    decision = payload.get("decision")  # approve | reject
    comment = payload.get("comment", "")
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM submissions WHERE submission_uuid=?", (suuid,)
    ).fetchone()
    if not row:
        return jsonify({"error": "not_found"}), 404
    if row["status"] != STATUS_MANUAL:
        return jsonify({"error": "not_in_manual_status"}), 400
    if decision == "approve":
        new_status = "completed"
        new_summary = f"人工确认通过: {comment}" if comment else "人工确认通过"
    else:
        new_status = STATUS_FAILED
        new_summary = f"人工确认驳回: {comment}" if comment else "人工确认驳回"
    conn.execute(
        "UPDATE submissions SET status=?, error_summary=?, updated_at=? WHERE submission_uuid=?",
        (new_status, new_summary, datetime.utcnow().isoformat(), suuid),
    )
    conn.commit()
    return jsonify({"submission_uuid": suuid, "status": new_status})


@app.route("/api/export", methods=["GET"])
def export_records():
    category = request.args.get("category")
    status = request.args.get("status", "completed")
    conn = get_db()
    sql = "SELECT submission_uuid, raw_json, category, status FROM submissions WHERE status = ?"
    params = [status]
    if category:
        sql += " AND category = ?"
        params.append(category)
    rows = conn.execute(sql, params).fetchall()
    exported = []
    for r in rows:
        data = json.loads(r["raw_json"])
        exported.append({
            "submission_uuid": r["submission_uuid"],
            "deposit_no": data.get("deposit_no"),
            "owner_name": data.get("owner_name"),
            "owner_phone": data.get("owner_phone"),
            "property_address": data.get("property_address"),
            "deposit_amount": data.get("deposit_amount"),
            "violation_deduction": data.get("violation_deduction", 0),
            "refund_amount": float(data.get("deposit_amount") or 0) - float(data.get("violation_deduction") or 0),
            "acceptance_date": data.get("acceptance_date"),
            "acceptor": data.get("acceptor"),
            "approval_chain": data.get("approval_chain", []),
            "final_handler": data.get("final_handler"),
            "category": r["category"],
            "status": r["status"],
        })
    # Mark exported
    for e in exported:
        conn.execute(
            "UPDATE submissions SET status=?, updated_at=? WHERE submission_uuid=?",
            (STATUS_EXPORTED, datetime.utcnow().isoformat(), e["submission_uuid"]),
        )
    conn.commit()
    return jsonify({"count": len(exported), "records": exported})


@app.route("/api/stats", methods=["GET"])
def stats():
    conn = get_db()
    by_cat = conn.execute(
        "SELECT category, COUNT(*) AS c FROM submissions GROUP BY category"
    ).fetchall()
    by_status = conn.execute(
        "SELECT status, COUNT(*) AS c FROM submissions GROUP BY status"
    ).fetchall()
    return jsonify({
        "by_category": {r["category"]: r["c"] for r in by_cat},
        "by_status": {r["status"]: r["c"] for r in by_status},
        "total": sum(r["c"] for r in by_cat),
    })


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)
